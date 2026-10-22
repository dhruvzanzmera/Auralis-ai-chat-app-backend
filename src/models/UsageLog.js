import mongoose from 'mongoose'

const usageLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default: null },
  operation: { type: String, enum: ['message', 'regeneration'], required: true },
  success: { type: Boolean, required: true, index: true },
  model: { type: String, required: true },
  promptTokens: { type: Number, default: null },
  completionTokens: { type: Number, default: null },
  totalTokens: { type: Number, default: null },
  responseTimeMs: { type: Number, required: true },
  errorCode: { type: String, default: null },
  prompt: { type: String, default: undefined },
}, { timestamps: true })

usageLogSchema.index({ user: 1, createdAt: -1 })
usageLogSchema.index({ createdAt: -1, model: 1 })
export default mongoose.model('UsageLog', usageLogSchema)
