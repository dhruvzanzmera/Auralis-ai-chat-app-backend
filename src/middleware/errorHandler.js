export function errorHandler(error, _req, res, _next) {
  console.error(error)

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' })
  }
  const status = Number(error.status || error.statusCode) || 500
  const message = status >= 500 && !error.message
    ? 'An unexpected server error occurred.'
    : error.message || 'An unexpected server error occurred.'
  return res.status(status).json({ message })
}
