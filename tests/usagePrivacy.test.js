import test from 'node:test'
import assert from 'node:assert/strict'
import UsageLog from '../src/models/UsageLog.js'
import { getMyUsageHistory } from '../src/controllers/usageController.js'

test('usage history query is scoped to the authenticated account', async (t) => {
  const previousFind = UsageLog.find
  const previousCountDocuments = UsageLog.countDocuments
  t.after(() => {
    UsageLog.find = previousFind
    UsageLog.countDocuments = previousCountDocuments
  })
  let query
  UsageLog.find = (filter) => {
    query = filter
    return {
      sort() { return this },
      skip() { return this },
      limit() { return this },
      select() { return this },
      lean: async () => [],
    }
  }
  UsageLog.countDocuments = async () => 0
  const res = {
    body: null,
    json(value) { this.body = value; return this },
  }
  await getMyUsageHistory({
    user: { _id: '507f191e810c19729de860ea' },
    query: { page: '1', limit: '10' },
  }, res, (error) => { throw error })
  assert.equal(query.user, '507f191e810c19729de860ea')
  assert.deepEqual(res.body.items, [])
})
