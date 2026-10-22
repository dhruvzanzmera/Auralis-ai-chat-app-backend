import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function authenticate(req, res, next) {
  const token = req.cookies?.auralis_token
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Session is invalid or expired. Please log in again.' })
  }
  try {
    const user = await User.findById(payload.sub).select('name email role isBlocked createdAt lastActivityAt +tokenVersion')
    if (!user) return res.status(401).json({ message: 'Authentication required.' })
    if (payload.tokenVersion !== user.tokenVersion) return res.status(401).json({ message: 'Session is invalid or expired. Please log in again.' })
    if (user.isBlocked) return res.status(403).json({ message: 'This account has been blocked.' })
    req.user = user
    return next()
  } catch (error) {
    return next(error)
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Administrator access required.' })
  return next()
}
