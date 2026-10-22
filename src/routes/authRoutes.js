import { Router } from 'express'
import { changePassword, forgotPassword, login, logout, me, register, resetPassword } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { authRateLimit } from '../middleware/rateLimits.js'

const router = Router()
router.post('/register', authRateLimit, register)
router.post('/login', authRateLimit, login)
router.post('/logout', logout)
router.get('/me', authenticate, me)
router.patch('/password', authenticate, authRateLimit, changePassword)
router.patch('/change-password', authenticate, authRateLimit, changePassword)
router.put('/change-password', authenticate, authRateLimit, changePassword)
router.post('/forgot-password', authRateLimit, forgotPassword)
router.post('/reset-password', authRateLimit, resetPassword)
export default router
