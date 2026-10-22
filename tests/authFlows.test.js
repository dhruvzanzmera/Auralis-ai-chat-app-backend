import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../src/models/User.js'
import Chat from '../src/models/Chat.js'
import { register, login } from '../src/controllers/authController.js'
import { authenticate, requireAdmin } from '../src/middleware/auth.js'
import { getChat } from '../src/controllers/chatController.js'

const JWT_SECRET = 'test-secret-that-is-long-enough-to-sign-tokens'

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    cookie(name, value, options) { this.cookieValue = { name, value, options }; return this },
  }
}

test('registration hashes passwords and never accepts a public role assignment', async (t) => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = JWT_SECRET
  const previousExists = User.exists
  const previousCreate = User.create
  t.after(() => {
    process.env.JWT_SECRET = previousSecret
    User.exists = previousExists
    User.create = previousCreate
  })
  User.exists = async () => false
  let created
  User.create = async (document) => {
    created = document
    return { ...document, _id: { toString: () => '507f1f77bcf86cd799439011' }, role: 'USER', createdAt: new Date() }
  }

  const res = response()
  await register({ body: { name: 'Auralis User', email: 'user@example.com', password: 'a-secure-password', role: 'ADMIN' } }, res, (error) => { throw error })
  assert.equal(res.statusCode, 201)
  assert.equal(created.role, undefined)
  assert.notEqual(created.password, 'a-secure-password')
  assert.equal(await bcrypt.compare('a-secure-password', created.password), true)
  assert.equal(res.body.user.role, 'USER')
  assert.equal(res.body.user.password, undefined)
})

test('login rejects blocked users and successful login sets a session cookie', async (t) => {
  const previousSecret = process.env.JWT_SECRET
  const previousNodeEnv = process.env.NODE_ENV
  const previousSameSite = process.env.COOKIE_SAME_SITE
  process.env.JWT_SECRET = JWT_SECRET
  process.env.NODE_ENV = 'production'
  delete process.env.COOKIE_SAME_SITE
  const previousFindOne = User.findOne
  t.after(() => {
    process.env.JWT_SECRET = previousSecret
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousSameSite === undefined) delete process.env.COOKIE_SAME_SITE
    else process.env.COOKIE_SAME_SITE = previousSameSite
    User.findOne = previousFindOne
  })
  const password = await bcrypt.hash('a-secure-password', 4)
  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    name: 'Auralis User',
    email: 'user@example.com',
    password,
    role: 'USER',
    isBlocked: false,
    tokenVersion: 0,
    createdAt: new Date(),
    async save() {},
  }
  User.findOne = () => ({ select: async () => user })
  const successful = response()
  await login({ body: { email: user.email, password: 'a-secure-password' } }, successful, (error) => { throw error })
  assert.equal(successful.statusCode, 200)
  assert.equal(successful.cookieValue.name, 'auralis_token')
  assert.equal(successful.cookieValue.options.httpOnly, true)
  assert.equal(successful.cookieValue.options.secure, true)
  assert.equal(successful.cookieValue.options.sameSite, 'none')

  User.findOne = () => ({ select: async () => ({ ...user, isBlocked: true }) })
  const blocked = response()
  await login({ body: { email: user.email, password: 'a-secure-password' } }, blocked, (error) => { throw error })
  assert.equal(blocked.statusCode, 403)
})

test('authentication rejects blocked users and admin authorization rejects ordinary users', async (t) => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = JWT_SECRET
  const previousFindById = User.findById
  t.after(() => {
    process.env.JWT_SECRET = previousSecret
    User.findById = previousFindById
  })
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' })
  const blockedUser = { _id: '507f1f77bcf86cd799439011', tokenVersion: 0, isBlocked: true }
  User.findById = () => ({ select: async () => blockedUser })
  const res = response()
  let passed = false
  await authenticate({ cookies: { auralis_token: token } }, res, () => { passed = true })
  assert.equal(passed, false)
  assert.equal(res.statusCode, 403)

  const userResponse = response()
  requireAdmin({ user: { role: 'USER' } }, userResponse, () => { passed = true })
  assert.equal(userResponse.statusCode, 403)
})

test('chat lookup scopes reads to the authenticated user', async (t) => {
  const previousFindOne = Chat.findOne
  t.after(() => { Chat.findOne = previousFindOne })
  let query
  Chat.findOne = (filter) => {
    query = filter
    return { lean: async () => null }
  }
  const res = response()
  await getChat({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: '507f191e810c19729de860ea' },
  }, res, (error) => { throw error })
  assert.equal(res.statusCode, 404)
  assert.equal(query.user, '507f191e810c19729de860ea')
})
