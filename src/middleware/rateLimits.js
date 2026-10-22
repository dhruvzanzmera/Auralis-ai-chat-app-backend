import rateLimit from 'express-rate-limit'

export const authRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many authentication requests. Please try again later.' },
})

export const chatRateLimit = rateLimit({
  windowMs: Number(process.env.CHAT_RATE_WINDOW_MS) || 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Please wait before trying again.' },
})
