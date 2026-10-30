import { getPromptSeries, resolveRange } from '../services/analyticsService.js'

export async function getMyUsageDaily(req, res, next) {
  try {
    const range = resolveRange({ range: req.query.range || '7d', ...req.query })
    const series = await getPromptSeries(range, 'daily', req.user._id)
    return res.json({ range: range.range, timezone: 'UTC', series })
  } catch (error) { return next(error) }
}
