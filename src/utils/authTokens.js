import { createHash, randomBytes } from 'node:crypto'

export function createResetToken() {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashToken(token) }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}
