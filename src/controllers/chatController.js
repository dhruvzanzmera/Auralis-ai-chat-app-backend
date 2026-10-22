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

export async function renameChat(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid chat ID.' })
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    if (!title || title.length > 80) {
      return res.status(400).json({ message: 'Chat title must be between 1 and 80 characters.' })
    }

    const chat = await Chat.findByIdAndUpdate(
      req.params.id,
      { title },
      { new: true, runValidators: true },
    ).select('title updatedAt').lean()
    if (!chat) return res.status(404).json({ message: 'Chat not found.' })

    return res.json(chat)
  } catch (error) {
    return next(error)
  }
}

export async function editMessage(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid chat ID.' })
    }

    const messageIndex = Number(req.params.index)
    if (!Number.isInteger(messageIndex) || messageIndex < 0) {
      return res.status(400).json({ message: 'Invalid message index.' })
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt must be a non-empty string.' })
    }

    const chat = await Chat.findById(req.params.id)
    if (!chat) return res.status(404).json({ message: 'Chat not found.' })
    if (messageIndex >= chat.messages.length || chat.messages[messageIndex].role !== 'user') {
      return res.status(400).json({ message: 'Only existing user prompts can be edited.' })
    }

    const previousMessages = chat.messages.slice(0, messageIndex)
    const aiContent = await generateReply(previousMessages, prompt)
    chat.messages.splice(messageIndex)
    chat.messages.push(
      { role: 'user', content: prompt, createdAt: new Date() },
      { role: 'model', content: aiContent, createdAt: new Date() },
    )
    await chat.save()

    return res.json({ messages: chat.messages })
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
