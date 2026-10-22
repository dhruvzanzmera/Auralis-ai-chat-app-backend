const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 60000

export async function generateReply(previousMessages, prompt) {
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    const error = new Error('Groq is not configured. Set GROQ_API_KEY on the server.')
    error.status = 503
    throw error
  }

  const messages = [
    ...previousMessages.map(({ role, content }) => ({
      role: role === 'model' ? 'assistant' : 'user',
      content,
    })),
    { role: 'user', content: prompt },
  ]

  let response
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    })
  } catch (cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.name === 'AbortError'
    const error = new Error(timedOut
      ? 'The AI service took too long to respond. Please try again.'
      : 'Could not reach the Groq API. Check the connection and try again.')
    error.status = 502
    error.code = timedOut ? 'GROQ_TIMEOUT' : 'GROQ_CONNECTION_ERROR'
    throw error
  }

  if (!response.ok) {
    const status = response.status
    try { await response.text() } catch { /* Ignore upstream error bodies. */ }
    const error = new Error(
      status === 429
        ? 'Groq is receiving too many requests. Please wait and try again.'
        : status === 401 || status === 403
          ? 'Groq rejected the API key. Verify the server configuration.'
          : status === 400 || status === 404
            ? 'Groq rejected the request. Check GROQ_MODEL.'
            : 'The AI service could not complete the request. Please try again.',
    )
    error.status = status === 429 ? 429 : status === 401 || status === 403 ? 502 : 502
    throw error
  }

  let data
  try { data = await response.json() } catch {
    const error = new Error('The AI service returned an invalid response.')
    error.status = 502
    throw error
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    const error = new Error('The AI service returned an unexpected response.')
    error.status = 502
    throw error
  }
  return { content, model: data.model || model, usage: data.usage || {} }
}
