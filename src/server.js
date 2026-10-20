import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectDB } from './config/db.js'
import { errorHandler } from './middleware/errorHandler.js'
import chatRoutes from './routes/chatRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === clientUrl) return callback(null, true)
    return callback(new Error(`CORS blocked request from ${origin}`))
  },
}))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/chats', chatRoutes)
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }))
app.use(errorHandler)

await connectDB()
app.listen(port, () => console.log(`AI chat API listening on http://localhost:${port}`))
