import bcrypt from 'bcryptjs'
import User from '../models/User.js'

export async function seedAdmin({ name, email, password, userModel = User }) {
  if (!email?.trim()) {
    throw new Error('ADMIN_EMAIL must be set to seed an administrator.')
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  let user = await userModel.findOne({ email: normalizedEmail })
  if (user) {
    if (user.role !== 'ADMIN') {
      user.role = 'ADMIN'
      await user.save()
      return `Promoted existing account ${normalizedEmail} to ADMIN; password unchanged.`
    }
    return `Administrator account ${normalizedEmail} already exists.`
  }

  if (!name?.trim() || name.trim().length > 80) {
    throw new Error('No account exists for ADMIN_EMAIL. Set ADMIN_NAME (1-80 characters) to create a new administrator.')
  }
  if (!password || password.length < 10 || password.length > 128) {
    throw new Error('No account exists for ADMIN_EMAIL. Set ADMIN_PASSWORD (10-128 characters) to create a new administrator.')
  }

  user = await userModel.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    role: 'ADMIN',
  })
  return `Created administrator account ${user.email}.`
}
