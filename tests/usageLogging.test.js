import test from 'node:test'
import assert from 'node:assert/strict'
import UsageLog from '../src/models/UsageLog.js'
import { recordUsage } from '../src/services/usageService.js'

test('failed Groq attempts are recorded without storing prompt or token metadata', async (t) => {
  const previousCreate = UsageLog.create
  t.after(() => {
    UsageLog.create = previousCreate
  })
  UsageLog.create = async (record) => record
  const startedAt = Date.now() - 20
  const failure = new Error('Upstream timeout')
  failure.status = 502
  failure.code = 'GROQ_TIMEOUT'

  const record = await recordUsage({
    user: '507f191e810c19729de860ea',
    chat: null,
    operation: 'message',
    prompt: 'private text',
    error: failure,
    startedAt,
  })
  assert.equal(record.success, false)
  assert.equal(record.errorCode, 'GROQ_TIMEOUT')
  assert.equal(record.user, '507f191e810c19729de860ea')
  assert.equal(record.prompt, undefined)
  assert.equal(record.totalTokens, undefined)
  assert.ok(record.responseTimeMs >= 20)
})

test('successful usage records prompt request metadata without token or prompt content', async (t) => {
  const previousCreate = UsageLog.create
  t.after(() => {
    UsageLog.create = previousCreate
  })
  UsageLog.create = async (record) => record

  const record = await recordUsage({
    user: '507f191e810c19729de860ea',
    chat: '507f1f77bcf86cd799439011',
    operation: 'regeneration',
    prompt: 'retained only when configured',
    result: {
      model: 'test-model',
      usage: { prompt_tokens: 17, completion_tokens: 23, total_tokens: 40 },
    },
    startedAt: Date.now(),
  })
  assert.equal(record.success, true)
  assert.equal(record.model, 'test-model')
  assert.equal(record.promptTokens, undefined)
  assert.equal(record.completionTokens, undefined)
  assert.equal(record.totalTokens, undefined)
  assert.equal(record.prompt, undefined)
  assert.equal(UsageLog.schema.path('totalTokens'), undefined)
  assert.equal(UsageLog.schema.path('prompt'), undefined)
})
