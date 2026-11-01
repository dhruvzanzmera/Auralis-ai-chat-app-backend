import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { requestLogger } from '../src/middleware/requestLogger.js'

test('logs completed requests without logging query strings or request bodies', (t) => {
  const previousInfo = console.info
  const logs = []
  t.after(() => {
    console.info = previousInfo
  })
  console.info = (message) => logs.push(JSON.parse(message))

  const res = new EventEmitter()
  res.statusCode = 200
  res.writableEnded = true
  let nextCalled = false

  requestLogger({
    method: 'POST',
    path: '/api/chats/message',
    user: { _id: 'user-123' },
    body: { prompt: 'private prompt' },
    query: { token: 'private token' },
  }, res, () => {
    nextCalled = true
  })
  res.emit('finish')

  assert.equal(nextCalled, true)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].event, 'request_completed')
  assert.equal(logs[0].method, 'POST')
  assert.equal(logs[0].path, '/api/chats/message')
  assert.equal(logs[0].statusCode, 200)
  assert.equal(logs[0].userId, 'user-123')
  assert.equal(typeof logs[0].durationMs, 'number')
  assert.equal(JSON.stringify(logs[0]).includes('private prompt'), false)
  assert.equal(JSON.stringify(logs[0]).includes('private token'), false)
})

test('logs a request that closes before its response finishes', (t) => {
  const previousInfo = console.info
  const logs = []
  t.after(() => {
    console.info = previousInfo
  })
  console.info = (message) => logs.push(JSON.parse(message))

  const res = new EventEmitter()
  res.statusCode = 200
  res.writableEnded = false

  requestLogger({ method: 'GET', path: '/api/health' }, res, () => {})
  res.emit('close')

  assert.equal(logs.length, 1)
  assert.equal(logs[0].event, 'request_aborted')
  assert.equal(logs[0].path, '/api/health')
})
