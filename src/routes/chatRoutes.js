import { Router } from 'express'
import { deleteChat, editMessage, getChat, listChats, renameChat, sendMessage } from '../controllers/chatController.js'

const router = Router()

router.post('/message', sendMessage)
router.get('/', listChats)
router.patch('/:id', renameChat)
router.patch('/:id/messages/:index', editMessage)
router.get('/:id', getChat)
router.delete('/:id', deleteChat)

export default router
