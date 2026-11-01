export function requestLogger(req, res, next) {
  const startedAt = Date.now()
  let logged = false

  function logRequest(event) {
    if (logged) return
    logged = true

    console.info(JSON.stringify({
      level: 'info',
      event,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?._id ? String(req.user._id) : undefined,
    }))
  }

  res.once('finish', () => logRequest('request_completed'))
  res.once('close', () => {
    if (!res.writableEnded) logRequest('request_aborted')
  })

  next()
}
