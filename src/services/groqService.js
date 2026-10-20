const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function generateReply(previousMessages, prompt) {
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    const error = new Error('Add a valid GROQ_API_KEY to ai-backend/.env to enable AI replies.')
    error.status = 503
    throw error
  }

  // Stored assistant messages use "model"; Groq expects "assistant".
  const messages = [
    ...previousMessages.map(({ role, content }) => ({
      role: role === 'model' ? 'assistant' : 'user',
      content,
    })),
    { role: 'user', content: prompt },
  ]

  let res
  try {
    res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    })
  } catch (networkError) {
    const mapped = new Error('Could not reach the Groq API. Check your internet connection and try again.')
    mapped.status = 502
    mapped.cause = networkError.message
    throw mapped
  }

  if (!res.ok) {
    const apiStatus = res.status
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }

    const mapped = new Error(
      apiStatus === 429
        ? 'Groq is receiving too many requests. Please wait a moment and try again.'
        : apiStatus === 401 || apiStatus === 403
          ? 'Groq rejected the API key. Verify your GROQ_API_KEY at console.groq.com.'
          : apiStatus === 400 || apiStatus === 404
            ? 'Groq rejected the request. Check your GROQ_MODEL name in .env.'
            : 'The AI service could not complete your request. Please try again.',
    )
    mapped.status = apiStatus === 429 ? 429 : apiStatus === 401 || apiStatus === 403 ? 403 : 502
    mapped.cause = body
    throw mapped
  }

  const data = await res.json()
  return data.choices[0].message.content
}
