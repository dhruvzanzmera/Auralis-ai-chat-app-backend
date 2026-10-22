import UsageLog from '../models/UsageLog.js'

export async function recordUsage({ user, chat, operation, prompt, result, error, startedAt }) {
  const usage = result?.usage || {}
  const log = {
    user,
    chat: chat || null,
    operation,
    success: !error,
    model: result?.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    promptTokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null,
    completionTokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null,
    totalTokens: Number.isFinite(usage.total_tokens) ? usage.total_tokens : null,
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    errorCode: error ? (error.code || String(Number(error.status) || 'UPSTREAM_ERROR')) : null,
  }
  if (String(process.env.RETAIN_USAGE_PROMPTS).toLowerCase() === 'true') log.prompt = prompt
  return UsageLog.create(log)
}
