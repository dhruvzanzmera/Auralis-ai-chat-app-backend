import { Router } from 'express'
import {
  analyticsErrors,
  analyticsModels,
  analyticsPrompts,
  analyticsTokens,
  analyticsUsers,
  dashboard,
  getUser,
  getUserUsage,
  listUsers,
  setUserRole,
  setUserStatus,
} from '../controllers/adminController.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(authenticate, requireAdmin)
router.get('/dashboard', dashboard)
router.get('/analytics', dashboard)
router.get('/analytics/prompts', analyticsPrompts)
router.get('/analytics/users', analyticsUsers)
router.get('/analytics/tokens', analyticsTokens)
router.get('/analytics/models', analyticsModels)
router.get('/analytics/errors', analyticsErrors)
router.get('/users', listUsers)
router.get('/users/:id', getUser)
router.get('/users/:id/usage', getUserUsage)
router.patch('/users/:id/status', setUserStatus)
router.patch('/users/:id/role', setUserRole)
export default router
