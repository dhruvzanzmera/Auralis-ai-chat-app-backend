import UsageLog from '../models/UsageLog.js'

export async function recordUsage({ user, chat, operation, result, error, startedAt }) {
  const log = {
    user,
    chat: chat || null,
    operation,
    success: !error,
    model: result?.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    errorCode: error ? (error.code || String(Number(error.status) || 'UPSTREAM_ERROR')) : null,
  }
  return UsageLog.create(log)
}
