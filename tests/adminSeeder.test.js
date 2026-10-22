import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { seedAdmin } from '../src/services/adminSeeder.js'

test('seedAdmin promotes an existing account without changing its password', async () => {
  let saved = false
  let created = false
  const user = {
    role: 'USER',
    async save() { saved = true },
  }
  const userModel = {
    async findOne(filter) {
      assert.deepEqual(filter, { email: 'admin@example.com' })
      return user
    },
    async create() { created = true },
  }

  const message = await seedAdmin({ email: ' Admin@Example.com ', userModel })

  assert.equal(user.role, 'ADMIN')
  assert.equal(saved, true)
  assert.equal(created, false)
  assert.equal(message, 'Promoted existing account admin@example.com to ADMIN; password unchanged.')
})

test('seedAdmin creates an administrator with a hashed password', async () => {
  let created
  const userModel = {
    async findOne() { return null },
    async create(document) {
      created = document
      return { email: document.email }
    },
  }

  const message = await seedAdmin({
    name: 'Auralis Admin',
    email: 'admin@example.com',
    password: 'a-secure-admin-password',
    userModel,
  })

  assert.equal(created.name, 'Auralis Admin')
  assert.equal(created.role, 'ADMIN')
  assert.equal(created.email, 'admin@example.com')
  assert.equal(await bcrypt.compare('a-secure-admin-password', created.password), true)
  assert.equal(message, 'Created administrator account admin@example.com.')
})

test('seedAdmin rejects invalid email addresses', async () => {
  await assert.rejects(
    seedAdmin({ email: 'not-an-email', userModel: { async findOne() { throw new Error('should not query') } } }),
    { message: 'ADMIN_EMAIL must be a valid email address.' },
  )
})
