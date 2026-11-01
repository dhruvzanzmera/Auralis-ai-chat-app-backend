import test from 'node:test'
import assert from 'node:assert/strict'
import User from '../src/models/User.js'
import { listUsers, setUserRole, setUserStatus } from '../src/controllers/adminController.js'

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('admins cannot block or demote the last active administrator', async (t) => {
  const previousFindById = User.findById
  const previousCountDocuments = User.countDocuments
  const previousExists = User.exists
  t.after(() => {
    User.findById = previousFindById
    User.countDocuments = previousCountDocuments
    User.exists = previousExists
  })
  const targetId = '507f1f77bcf86cd799439011'
  const target = { role: 'ADMIN', isBlocked: false }
  User.findById = () => ({ select: async () => target })
  User.countDocuments = async () => 1
  User.exists = async () => true

  const blocked = response()
  await setUserStatus({
    params: { id: targetId },
    body: { status: 'blocked' },
    user: { id: '507f191e810c19729de860ea' },
  }, blocked, (error) => { throw error })
  assert.equal(blocked.statusCode, 409)

  const demoted = response()
  await setUserRole({
    params: { id: targetId },
    body: { role: 'USER' },
    user: { id: '507f191e810c19729de860ea' },
  }, demoted, (error) => { throw error })
  assert.equal(demoted.statusCode, 409)
})

test('empty account list returns a backend message relevant to active filters', async (t) => {
  const previousFind = User.find
  const previousCountDocuments = User.countDocuments
  t.after(() => {
    User.find = previousFind
    User.countDocuments = previousCountDocuments
  })
  User.find = () => ({
    select() { return this },
    sort() { return this },
    skip() { return this },
    limit() { return { lean: async () => [] } },
  })
  User.countDocuments = async () => 0

  const unfiltered = response()
  await listUsers({ query: {} }, unfiltered, (error) => { throw error })
  assert.equal(unfiltered.body.message, 'No accounts are available.')

  const filtered = response()
  await listUsers({ query: { search: 'missing' } }, filtered, (error) => { throw error })
  assert.equal(filtered.body.message, 'No accounts match the selected filters.')
})
