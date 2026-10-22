import { Router } from 'express'
import { getMyUsage, getMyUsageDaily, getMyUsageHistory } from '../controllers/usageController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)
router.get('/me', getMyUsage)
router.get('/me/daily', getMyUsageDaily)
router.get('/me/history', getMyUsageHistory)
export default router
