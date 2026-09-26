import { describe, it, expect } from 'vitest'
import { isoTime, lastNMonthKeys } from '../src/lib/date'

describe('isoTime', () => {
  it('renders WIB regardless of the host timezone', () => {
    expect(isoTime('2026-09-26T17:00:00.000Z')).toBe('00.00')
    expect(isoTime('2026-09-26T04:30:00.000Z')).toBe('11.30')
  })
})

describe('lastNMonthKeys', () => {
  it('walks back whole calendar months without drifting', () => {
    expect(lastNMonthKeys(3, '2026-09-26')).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('crosses year boundaries', () => {
    expect(lastNMonthKeys(6, '2026-01-15')).toEqual([
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ])
  })

  it('never repeats a month', () => {
    const keys = lastNMonthKeys(18, '2026-09-26')
    expect(keys).toHaveLength(18)
    expect(new Set(keys).size).toBe(18)
  })
})
