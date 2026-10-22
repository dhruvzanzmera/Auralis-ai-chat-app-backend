import test from 'node:test'
import assert from 'node:assert/strict'
import { createResetToken, hashToken } from '../src/utils/authTokens.js'

test('reset tokens are random, fixed-length hex values with a one-way hash', () => {
  const first = createResetToken()
  const second = createResetToken()
  assert.match(first.token, /^[a-f0-9]{64}$/)
  assert.notEqual(first.token, second.token)
  assert.equal(first.hash, hashToken(first.token))
  assert.notEqual(first.hash, first.token)
  assert.equal(first.hash, hashToken(first.token))
})
