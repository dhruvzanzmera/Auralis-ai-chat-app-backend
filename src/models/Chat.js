import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const chatSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
)

export default mongoose.model('Chat', chatSchema)
