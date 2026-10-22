import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectDB } from './config/db.js'
import { errorHandler } from './middleware/errorHandler.js'
import cookieParser from 'cookie-parser'
import { seedAdmin } from './services/adminSeeder.js'
import authRoutes from './routes/authRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import usageRoutes from './routes/usageRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 5000
if (!process.env.JWT_SECRET
  || process.env.JWT_SECRET.length < 32
  || process.env.JWT_SECRET === 'replace_with_at_least_32_random_characters') {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.')
}
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    const error = new Error('Request origin is not allowed.')
    error.status = 403
    return callback(error)
  },
}))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/usage', usageRoutes)
app.use('/api/admin', adminRoutes)
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }))
app.use(errorHandler)

await connectDB()
if (process.env.ADMIN_EMAIL?.trim()) {
  console.log(await seedAdmin({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }))
} else {
  console.log('Admin seeding skipped: ADMIN_EMAIL is not configured.')
}
app.listen(port, () => console.log(`AI chat API listening on port ${port}`))
