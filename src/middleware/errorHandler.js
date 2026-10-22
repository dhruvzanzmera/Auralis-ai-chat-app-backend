export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' })
  }
  const status = Number(error.status || error.statusCode) || 500
  if (status >= 500) console.error('Request failed:', error.message)
  const message = status >= 500 ? 'An unexpected server error occurred.' : error.message || 'Request failed.'
  return res.status(status).json({ message })
}
