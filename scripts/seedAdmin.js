import 'dotenv/config'
import mongoose from 'mongoose'
import { seedAdmin } from '../src/services/adminSeeder.js'

const { MONGO_URI } = process.env
if (!MONGO_URI?.trim()) throw new Error('MONGO_URI is missing from ai-backend/.env.')
if (!process.env.ADMIN_EMAIL?.trim()) {
  throw new Error('ADMIN_EMAIL is missing from ai-backend/.env. Set it to promote an existing account or create a new administrator.')
}

try {
  await mongoose.connect(MONGO_URI)
  console.log(await seedAdmin({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }))
} catch (error) {
  if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
    throw new Error('Could not connect to MongoDB. Check that MongoDB is running and MONGO_URI points to the intended database.')
  }
  throw error
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
