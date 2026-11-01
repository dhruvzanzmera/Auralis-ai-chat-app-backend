import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import UsageLog from '../models/UsageLog.js'
import User from '../models/User.js'
import { aggregateUsage, getPromptSeries, resolveRange, rangeFilter, resolveUtcWeekRange } from '../services/analyticsService.js'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function groupBy(bucket = 'daily') {
  if (!['daily', 'weekly', 'monthly'].includes(bucket)) {
    throw Object.assign(new Error('bucket must be daily, weekly, or monthly.'), { status: 400 })
  }
  return bucket === 'weekly' ? '%G-W%V' : bucket === 'monthly' ? '%Y-%m' : '%Y-%m-%d'
}

async function getTopUsers(range) {
  return UsageLog.aggregate([
    { $match: rangeFilter(range) },
    { $group: {
      _id: '$user',
      prompts: { $sum: 1 },
    } },
    { $sort: { prompts: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'profile' } },
    { $unwind: '$profile' },
    { $project: {
      _id: '$profile._id',
      name: '$profile.name',
      email: '$profile.email',
      prompts: 1,
    } },
  ])
}

export async function dashboard(req, res, next) {
  try {
    const range = resolveRange(req.query)
    const allTime = { start: new Date(0), end: new Date(Date.now() + 1) }
    const [users, activeUsers, blockedUsers, chats, totalUsage, selectedUsage, today, week, month, dailyPrompts, mostActiveUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBlocked: false }),
      User.countDocuments({ isBlocked: true }),
      Chat.countDocuments(),
      aggregateUsage(allTime),
      aggregateUsage(range),
      aggregateUsage(resolveRange({ range: 'today' })),
      aggregateUsage(resolveUtcWeekRange()),
      aggregateUsage(resolveRange({ range: 'month' })),
      getPromptSeries(range),
      getTopUsers(range),
    ])
    return res.json({
      range: range.range,
      timezone: 'UTC',
      metrics: {
        totalUsers: users,
        activeUsers,
        blockedUsers,
        totalChats: chats,
        totalPrompts: totalUsage.prompts,
        promptsToday: today.prompts,
        promptsThisWeek: week.prompts,
        promptsThisMonth: month.prompts,
        successfulRequests: selectedUsage.successfulRequests,
        failedRequests: selectedUsage.failedRequests,
        averageResponseTime: selectedUsage.averageResponseTime,
      },
      dailyPrompts,
      mostActiveUsers,
      messages: {
        mostActiveUsers: mostActiveUsers.length
          ? ''
          : 'No user activity has been recorded for this date range.',
      },
    })
  } catch (error) { return next(error) }
}

export async function analyticsPrompts(req, res, next) {
  try {
    const range = resolveRange(req.query)
    const bucket = req.query.bucket || 'daily'
    groupBy(bucket)
    const series = await getPromptSeries(range, bucket)
    const hasActivity = series.some((row) => row.count > 0)
    return res.json({
      range: range.range,
      bucket,
      timezone: 'UTC',
      series,
      message: hasActivity ? '' : 'No prompt activity has been recorded for this date range.',
    })
  } catch (error) { return next(error) }
}

export async function analyticsUsers(req, res, next) {
  try {
    const range = resolveRange(req.query)
    const bucket = req.query.bucket || 'daily'
    const format = groupBy(bucket)
    const [registrations, mostActiveUsers] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
        { $group: {
          _id: { $dateToString: { format, date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
      getTopUsers(range),
    ])
    return res.json({
      range: range.range,
      bucket,
      timezone: 'UTC',
      series: registrations,
      mostActiveUsers,
      message: registrations.length ? '' : 'No accounts were registered during this date range.',
    })
  } catch (error) { return next(error) }
}

export async function analyticsModels(req, res, next) {
  try {
    const range = resolveRange(req.query)
    const models = await UsageLog.aggregate([
      { $match: rangeFilter(range) },
      { $group: {
        _id: '$model',
        count: { $sum: 1 },
        successful: { $sum: { $cond: ['$success', 1, 0] } },
        failed: { $sum: { $cond: ['$success', 0, 1] } },
      } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, model: '$_id', count: 1, successful: 1, failed: 1 } },
    ])
    return res.json({
      range: range.range,
      models,
      message: models.length ? '' : 'No model usage has been recorded for this date range.',
    })
  } catch (error) { return next(error) }
}

export async function analyticsErrors(req, res, next) {
  try {
    const range = resolveRange(req.query)
    const [totals, errors] = await Promise.all([
      aggregateUsage(range),
      UsageLog.aggregate([
        { $match: { ...rangeFilter(range), success: false } },
        { $group: { _id: '$errorCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, code: { $ifNull: ['$_id', 'unknown'] }, count: 1 } },
      ]),
    ])
    return res.json({
      range: range.range,
      successfulRequests: totals.successfulRequests,
      failedRequests: totals.failedRequests,
      errors,
    })
  } catch (error) { return next(error) }
}

export async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25))
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
    if (req.query.role && !['USER', 'ADMIN'].includes(req.query.role)) {
      return res.status(400).json({ message: 'role filter must be USER or ADMIN.' })
    }
    if (req.query.status && !['active', 'blocked'].includes(req.query.status)) {
      return res.status(400).json({ message: 'status filter must be active or blocked.' })
    }
    const filter = {}
    if (search) {
      filter.$or = [
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { name: { $regex: escapeRegex(search), $options: 'i' } },
      ]
    }
    if (req.query.role && ['USER', 'ADMIN'].includes(req.query.role)) filter.role = req.query.role
    if (req.query.status === 'blocked') filter.isBlocked = true
    if (req.query.status === 'active') filter.isBlocked = false
    const [rows, total] = await Promise.all([
      User.find(filter).select('name email role isBlocked createdAt lastActivityAt').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ])
    const users = rows.map(({ isBlocked, ...user }) => ({ ...user, status: isBlocked ? 'blocked' : 'active' }))
    return res.json({
      users,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      message: users.length
        ? ''
        : search || req.query.role || req.query.status
          ? 'No accounts match the selected filters.'
          : 'No accounts are available.',
    })
  } catch (error) { return next(error) }
}

export async function getUser(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' })
    const user = await User.findById(req.params.id).select('name email role isBlocked createdAt lastActivityAt').lean()
    if (!user) return res.status(404).json({ message: 'User not found.' })
    const { isBlocked, ...profile } = user
    return res.json({ user: { ...profile, status: isBlocked ? 'blocked' : 'active' } })
  } catch (error) { return next(error) }
}

export async function getUserUsage(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' })
    const userExists = await User.exists({ _id: req.params.id })
    if (!userExists) return res.status(404).json({ message: 'User not found.' })
    const range = resolveRange({ range: '7d' })
    const series = await getPromptSeries(range, 'daily', req.params.id)
    const hasActivity = series.some((row) => row.count > 0)
    return res.json({
      range: range.range,
      timezone: 'UTC',
      series,
      message: hasActivity ? '' : 'No prompt activity has been recorded for this account in the last 7 days.',
    })
  } catch (error) { return next(error) }
}

async function protectLastActiveAdmin(userId) {
  const admins = await User.countDocuments({ role: 'ADMIN', isBlocked: false })
  if (admins <= 1 && await User.exists({ _id: userId, role: 'ADMIN', isBlocked: false })) {
    return false
  }
  return true
}

export async function setUserStatus(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' })
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own account status.' })
    const { status } = req.body || {}
    if (!['active', 'blocked'].includes(status)) return res.status(400).json({ message: 'status must be active or blocked.' })
    const target = await User.findById(req.params.id).select('role isBlocked')
    if (!target) return res.status(404).json({ message: 'User not found.' })
    if (status === 'blocked' && target.role === 'ADMIN' && !target.isBlocked
      && !(await protectLastActiveAdmin(req.params.id))) {
      return res.status(409).json({ message: 'The last active administrator cannot be blocked.' })
    }
    target.isBlocked = status === 'blocked'
    await target.save()
    const user = await User.findById(target._id).select('name email role isBlocked createdAt lastActivityAt').lean()
    const { isBlocked, ...profile } = user
    return res.json({ user: { ...profile, status: isBlocked ? 'blocked' : 'active' } })
  } catch (error) { return next(error) }
}

export async function setUserRole(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' })
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own role.' })
    const { role } = req.body || {}
    if (!['USER', 'ADMIN'].includes(role)) return res.status(400).json({ message: 'role must be USER or ADMIN.' })
    const target = await User.findById(req.params.id).select('role isBlocked')
    if (!target) return res.status(404).json({ message: 'User not found.' })
    if (role === 'USER' && target.role === 'ADMIN' && !target.isBlocked
      && !(await protectLastActiveAdmin(req.params.id))) {
      return res.status(409).json({ message: 'The last active administrator cannot be demoted.' })
    }
    target.role = role
    await target.save()
    const user = await User.findById(target._id).select('name email role isBlocked createdAt lastActivityAt').lean()
    const { isBlocked, ...profile } = user
    return res.json({ user: { ...profile, status: isBlocked ? 'blocked' : 'active' } })
  } catch (error) { return next(error) }
}

export { getUserUsage as getUsageForUser }
