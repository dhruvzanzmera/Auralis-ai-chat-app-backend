import test from 'node:test'
import assert from 'node:assert/strict'
import UsageLog from '../src/models/UsageLog.js'
import { recordUsage } from '../src/services/usageService.js'

test('failed Groq attempts are logged without prompt retention by default', async (t) => {
  const previousCreate = UsageLog.create
  const previousRetention = process.env.RETAIN_USAGE_PROMPTS
  t.after(() => {
    UsageLog.create = previousCreate
    process.env.RETAIN_USAGE_PROMPTS = previousRetention
  })
  process.env.RETAIN_USAGE_PROMPTS = 'false'
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
  assert.ok(record.responseTimeMs >= 20)
})

test('successful usage records Groq token metadata and optional prompt content', async (t) => {
  const previousCreate = UsageLog.create
  const previousRetention = process.env.RETAIN_USAGE_PROMPTS
  t.after(() => {
    UsageLog.create = previousCreate
    process.env.RETAIN_USAGE_PROMPTS = previousRetention
  })
  process.env.RETAIN_USAGE_PROMPTS = 'true'
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
  assert.equal(record.promptTokens, 17)
  assert.equal(record.completionTokens, 23)
  assert.equal(record.totalTokens, 40)
  assert.equal(record.prompt, 'retained only when configured')
})
