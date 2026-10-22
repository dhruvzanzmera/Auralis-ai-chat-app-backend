import mongoose from 'mongoose'
import UsageLog from '../models/UsageLog.js'

const DAY_MS = 24 * 60 * 60 * 1000

export function resolveRange(query = {}, now = new Date()) {
  const range = typeof query.range === 'string' ? query.range : '30d'
  let start
  let end
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  if (range === 'today') {
    start = todayStart
    end = new Date(todayStart.getTime() + DAY_MS)
  } else if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30
    start = new Date(todayStart.getTime() - (days - 1) * DAY_MS)
    end = new Date(todayStart.getTime() + DAY_MS)
  } else if (range === 'month') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    end = new Date(todayStart.getTime() + DAY_MS)
  } else if (range === 'custom') {
    const { startDate, endDate } = query
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) {
      throw Object.assign(new Error('Custom ranges require startDate and endDate in YYYY-MM-DD format.'), { status: 400 })
    }
    start = new Date(`${startDate}T00:00:00.000Z`)
    end = new Date(`${endDate}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      || start.toISOString().slice(0, 10) !== startDate
      || end.toISOString().slice(0, 10) !== endDate
      || end < start) {
      throw Object.assign(new Error('Custom date range is invalid.'), { status: 400 })
    }
    end = new Date(end.getTime() + DAY_MS)
    if ((end - start) / DAY_MS > 366) {
      throw Object.assign(new Error('Custom date ranges cannot exceed 366 days.'), { status: 400 })
    }
  } else {
    throw Object.assign(new Error('Range must be today, 7d, 30d, month, or custom.'), { status: 400 })
  }

  return { range, start, end }
}

export function resolveUtcWeekRange(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const daysFromMonday = (today.getUTCDay() + 6) % 7
  return { start: new Date(today.getTime() - daysFromMonday * DAY_MS), end: new Date(today.getTime() + DAY_MS) }
}

export function rangeFilter({ start, end }, user) {
  const filter = { createdAt: { $gte: start, $lt: end } }
  if (user) filter.user = typeof user === 'string' && mongoose.isValidObjectId(user)
    ? new mongoose.Types.ObjectId(user)
    : user
  return filter
}

function bucketFormat(bucket) {
  if (bucket === 'weekly') return '%G-W%V'
  if (bucket === 'monthly') return '%Y-%m'
  return '%Y-%m-%d'
}

export async function getPromptSeries(range, bucket = 'daily', user) {
  const groupFormat = bucketFormat(bucket)
  const rows = await UsageLog.aggregate([
    { $match: rangeFilter(range, user) },
    { $group: {
      _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: 'UTC' } },
      count: { $sum: 1 },
      successful: { $sum: { $cond: ['$success', 1, 0] } },
      failed: { $sum: { $cond: ['$success', 0, 1] } },
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', count: 1, successful: 1, failed: 1 } },
  ])
  if (bucket !== 'daily') return rows

  const grouped = new Map(rows.map((row) => [row.date, row]))
  const filled = []
  for (let time = range.start.getTime(); time < range.end.getTime(); time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10)
    filled.push(grouped.get(date) || { date, count: 0, successful: 0, failed: 0 })
  }
  return filled
}

export async function aggregateUsage(range, user) {
  const result = await UsageLog.aggregate([
    { $match: rangeFilter(range, user) },
    { $group: {
      _id: null,
      prompts: { $sum: 1 },
      successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
      failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
      inputTokens: { $sum: { $ifNull: ['$promptTokens', 0] } },
      outputTokens: { $sum: { $ifNull: ['$completionTokens', 0] } },
      totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
      averageResponseTime: { $avg: '$responseTimeMs' },
    } },
    { $project: { _id: 0 } },
  ])
  return result[0] || {
    prompts: 0,
    successfulRequests: 0,
    failedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    averageResponseTime: 0,
  }
}
