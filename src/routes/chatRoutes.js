import { Router } from 'express'
import { deleteChat, editMessage, getChat, listChats, renameChat, sendMessage } from '../controllers/chatController.js'
import { authenticate } from '../middleware/auth.js'
import { chatRateLimit } from '../middleware/rateLimits.js'

const router = Router()

router.use(authenticate)
router.post('/message', chatRateLimit, sendMessage)
router.get('/', listChats)
router.patch('/:id', renameChat)
router.patch('/:id/messages/:index', chatRateLimit, editMessage)
router.get('/:id', getChat)
router.delete('/:id', deleteChat)

export default router
