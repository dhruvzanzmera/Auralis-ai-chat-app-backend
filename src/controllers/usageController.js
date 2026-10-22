import UsageLog from '../models/UsageLog.js'
import { aggregateUsage, getPromptSeries, resolveRange, resolveUtcWeekRange } from '../services/analyticsService.js'

function formatLog(log) {
  return {
    _id: log._id,
    conversationId: log.chat,
    promptText: log.prompt || '',
    model: log.model,
    requestStatus: log.success ? 'success' : 'failed',
    inputTokens: log.promptTokens || 0,
    outputTokens: log.completionTokens || 0,
    totalTokens: log.totalTokens || 0,
    responseTime: log.responseTimeMs,
    errorCode: log.errorCode || null,
    createdAt: log.createdAt,
  }
}

export async function getMyUsage(req, res, next) {
  try {
    const all = { start: new Date(0), end: new Date(Date.now() + 1) }
    const [total, today, week, month] = await Promise.all([
      aggregateUsage(all, req.user._id),
      aggregateUsage(resolveRange({ range: 'today' }), req.user._id),
      aggregateUsage(resolveUtcWeekRange(), req.user._id),
      aggregateUsage(resolveRange({ range: 'month' }), req.user._id),
    ])
    return res.json({
      totalPrompts: total.prompts,
      successfulRequests: total.successfulRequests,
      failedRequests: total.failedRequests,
      totalTokens: total.totalTokens,
      tokens: { inputTokens: total.inputTokens, outputTokens: total.outputTokens, totalTokens: total.totalTokens },
      today: { prompts: today.prompts, totalTokens: today.totalTokens },
      week: { prompts: week.prompts, totalTokens: week.totalTokens },
      month: { prompts: month.prompts, totalTokens: month.totalTokens },
      averageResponseTime: total.averageResponseTime,
    })
  } catch (error) { return next(error) }
}

export async function getMyUsageDaily(req, res, next) {
  try {
    const range = resolveRange({ range: req.query.range || '7d', ...req.query })
    const series = await getPromptSeries(range, 'daily', req.user._id)
    return res.json({ range: range.range, timezone: 'UTC', series })
  } catch (error) { return next(error) }
}

export async function getMyUsageHistory(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 10))
    const filter = { user: req.user._id }
    const [logs, total] = await Promise.all([
      UsageLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('+prompt').lean(),
      UsageLog.countDocuments(filter),
    ])
    return res.json({
      items: logs.map(formatLog),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    })
  } catch (error) { return next(error) }
}
