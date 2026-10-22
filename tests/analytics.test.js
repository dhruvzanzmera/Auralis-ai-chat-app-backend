import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveRange, resolveUtcWeekRange } from '../src/services/analyticsService.js'

test('daily, weekly, monthly and custom report ranges use UTC boundaries', () => {
  const now = new Date('2026-10-22T13:06:40.000Z')
  const today = resolveRange({ range: 'today' }, now)
  assert.equal(today.start.toISOString(), '2026-10-22T00:00:00.000Z')
  assert.equal(today.end.toISOString(), '2026-10-23T00:00:00.000Z')

  const week = resolveRange({ range: '7d' }, now)
  assert.equal(week.start.toISOString(), '2026-10-16T00:00:00.000Z')
  assert.equal(week.end.toISOString(), today.end.toISOString())

  const month = resolveRange({ range: 'month' }, now)
  assert.equal(month.start.toISOString(), '2026-10-01T00:00:00.000Z')

  const currentWeek = resolveUtcWeekRange(now)
  assert.equal(currentWeek.start.toISOString(), '2026-10-19T00:00:00.000Z')
  assert.equal(currentWeek.end.toISOString(), today.end.toISOString())

  const custom = resolveRange({ range: 'custom', startDate: '2026-10-01', endDate: '2026-10-02' }, now)
  assert.equal(custom.end.toISOString(), '2026-10-03T00:00:00.000Z')
})

test('custom analytics ranges reject invalid or excessive dates', () => {
  assert.throws(
    () => resolveRange({ range: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }),
    { status: 400 },
  )
  assert.throws(
    () => resolveRange({ range: 'custom', startDate: '2024-01-01', endDate: '2025-01-02' }),
    { status: 400 },
  )
})
