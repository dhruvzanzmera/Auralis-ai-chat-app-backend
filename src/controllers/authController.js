import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import User from '../models/User.js'
import { createResetToken, hashToken } from '../utils/authTokens.js'

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  maxAge: sessionDurationMs(),
  path: '/',
})

function sessionDurationMs() {
  const duration = process.env.JWT_EXPIRES_IN || '1h'
  const match = /^(\d+)(s|m|h|d)$/.exec(duration)
  if (!match) throw new Error('JWT_EXPIRES_IN must use a duration such as 30m, 1h, or 7d.')
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[match[2]]
  return Number(match[1]) * unitMs
}

function setSessionCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  )
  res.cookie('auralis_token', token, cookieOptions())
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.isBlocked ? 'blocked' : 'active',
    createdAt: user.createdAt,
    lastActivityAt: user.lastActivityAt || null,
  }
}

export async function register(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body?.password
    if (!name || name.length > 80) return res.status(400).json({ message: 'Name must be between 1 and 80 characters.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 10 and 128 characters.' })
    }
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' })
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) })
    setSessionCookie(res, user)
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' })
    return next(error)
  }
}

export async function login(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body?.password
    if (!email || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' })
    const user = await User.findOne({ email }).select('+password +tokenVersion')
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }
    if (user.isBlocked) return res.status(403).json({ message: 'This account has been blocked.' })
    user.lastActivityAt = new Date()
    await user.save()
    setSessionCookie(res, user)
    return res.json({ user: publicUser(user) })
  } catch (error) { return next(error) }
}

export function logout(_req, res) {
  return res.clearCookie('auralis_token', { ...cookieOptions(), maxAge: undefined }).json({ message: 'Logged out.' })
}

export function me(req, res) {
  return res.json({ user: publicUser(req.user) })
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) {
      return res.status(400).json({ message: 'New password must be between 10 and 128 characters.' })
    }
    const user = await User.findById(req.user._id).select('+password +tokenVersion')
    if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.password))) {
      return res.status(401).json({ message: 'Current password is incorrect.' })
    }
    user.password = await bcrypt.hash(newPassword, 12)
    user.tokenVersion += 1
    user.passwordResetTokenHash = undefined
    user.passwordResetExpiresAt = undefined
    await user.save()
    setSessionCookie(res, user)
    return res.json({ message: 'Password changed.' })
  } catch (error) { return next(error) }
}

export async function forgotPassword(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const user = email ? await User.findOne({ email }) : null
    if (user) {
      const { token, hash } = createResetToken()
      user.passwordResetTokenHash = hash
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
      await user.save()
      if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        })
        const baseUrl = (process.env.PASSWORD_RESET_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')
        const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
        try {
          await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: 'Reset your Auralis password',
            text: `Use this link within 30 minutes to reset your password: ${link}`,
          })
        } catch (error) {
          console.error('Could not deliver password reset email.', {
            code: error.code || 'UNKNOWN',
            responseCode: error.responseCode || null,
          })
        }
      } else {
        console.error('Password reset email is not configured: SMTP_HOST and SMTP_FROM are required.')
      }
    }
    return res.json({ message: 'If an account exists for that email, password reset instructions will be sent.' })
  } catch (error) { return next(error) }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body || {}
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ message: 'A valid reset token is required.' })
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 10 and 128 characters.' })
    }
    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt +tokenVersion')
    if (!user) return res.status(400).json({ message: 'Reset token is invalid or expired.' })
    user.password = await bcrypt.hash(password, 12)
    user.tokenVersion += 1
    user.passwordResetTokenHash = undefined
    user.passwordResetExpiresAt = undefined
    await user.save()
    return res.json({ message: 'Password reset successfully. Please log in.' })
  } catch (error) { return next(error) }
}
