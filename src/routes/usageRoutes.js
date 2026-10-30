import { Router } from 'express'
import { getMyUsageDaily } from '../controllers/usageController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)
router.get('/me/daily', getMyUsageDaily)
export default router
