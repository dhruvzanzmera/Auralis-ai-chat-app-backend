import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  isBlocked: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0, select: false },
  lastActivityAt: { type: Date, default: null, index: true },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
}, { timestamps: true })

userSchema.index({ createdAt: -1 })
userSchema.index({ isBlocked: 1, role: 1 })
export default mongoose.model('User', userSchema)
