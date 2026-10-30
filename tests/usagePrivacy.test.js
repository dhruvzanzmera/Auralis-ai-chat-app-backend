import test from 'node:test'
import assert from 'node:assert/strict'
import UsageLog from '../src/models/UsageLog.js'
import User from '../src/models/User.js'
import { getUserUsage } from '../src/controllers/adminController.js'
import { getMyUsageDaily } from '../src/controllers/usageController.js'

test('daily prompt counts are scoped to the authenticated account', async (t) => {
  const previousAggregate = UsageLog.aggregate
  t.after(() => {
    UsageLog.aggregate = previousAggregate
  })
  let pipeline
  UsageLog.aggregate = async (value) => {
    pipeline = value
    return []
  }
  const res = {
    body: null,
    json(value) { this.body = value; return this },
  }
  await getMyUsageDaily({
    user: { _id: '507f191e810c19729de860ea' },
    query: { range: '7d' },
  }, res, (error) => { throw error })
  assert.equal(pipeline[0].$match.user.toString(), '507f191e810c19729de860ea')
  assert.equal(res.body.series.length, 7)
  assert.equal(res.body.series.every((row) => row.count === 0), true)
  assert.equal(Object.keys(pipeline[1].$group).length, 2)
  assert.equal('totalTokens' in res.body, false)
  assert.equal('history' in res.body, false)
})

test('admin user usage reports only that user’s daily prompt counts', async (t) => {
  const previousExists = User.exists
  const previousAggregate = UsageLog.aggregate
  t.after(() => {
    User.exists = previousExists
    UsageLog.aggregate = previousAggregate
  })
  const userId = '507f191e810c19729de860ea'
  let pipeline
  User.exists = async () => ({ _id: userId })
  UsageLog.aggregate = async (value) => {
    pipeline = value
    return []
  }
  const res = {
    body: null,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
  await getUserUsage({ params: { id: userId } }, res, (error) => { throw error })
  assert.equal(pipeline[0].$match.user.toString(), userId)
  assert.equal(res.body.series.length, 7)
  assert.equal(res.body.series.every((row) => Object.keys(row).sort().join(',') === 'count,date'), true)
  assert.equal('totalTokens' in res.body, false)
})
