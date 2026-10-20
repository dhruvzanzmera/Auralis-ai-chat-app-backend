import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import { generateReply } from '../services/groqService.js'

export async function sendMessage(req, res, next) {
  try {
    const { chatId, prompt } = req.body || {}
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt must be a non-empty string.' })
    }
    if (chatId && !mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID.' })
    }

    const cleanPrompt = prompt.trim()
    let chat = chatId ? await Chat.findById(chatId) : null
    if (chatId && !chat) return res.status(404).json({ message: 'Chat not found.' })
    if (!chat) chat = new Chat({ title: cleanPrompt.slice(0, 40) })

    const userMessage = { role: 'user', content: cleanPrompt, createdAt: new Date() }
    const aiContent = await generateReply(chat.messages, cleanPrompt)
    const aiMessage = { role: 'model', content: aiContent, createdAt: new Date() }

    chat.messages.push(userMessage, aiMessage)
    await chat.save()

    return res.status(200).json({
      chatId: chat._id,
      userMessage: chat.messages.at(-2),
      aiMessage: chat.messages.at(-1),
    })
  } catch (error) {
    return next(error)
  }
}

export async function listChats(_req, res, next) {
  try {
    const chats = await Chat.find().select('title updatedAt').sort({ updatedAt: -1 }).lean()
    return res.json(chats.map(({ _id, title, updatedAt }) => ({ _id, id: _id, title, updatedAt })))
  } catch (error) {
    return next(error)
  }
}

export async function getChat(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid chat ID.' })
    }
    const chat = await Chat.findById(req.params.id).lean()
    if (!chat) return res.status(404).json({ message: 'Chat not found.' })
    return res.json(chat)
  } catch (error) {
    return next(error)
  }
}

export async function deleteChat(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid chat ID.' })
    }
    const chat = await Chat.findByIdAndDelete(req.params.id)
    if (!chat) return res.status(404).json({ message: 'Chat not found.' })
    return res.json({ message: 'Chat deleted.' })
  } catch (error) {
    return next(error)
  }
}
