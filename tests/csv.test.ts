import { describe, it, expect } from 'vitest'
import { buildCsv } from '../src/lib/csv'

describe('buildCsv', () => {
  it('neutralises spreadsheet formula injection', () => {
    const csv = buildCsv([['=1+1'], ['+1'], ['-2'], ['@SUM(A1)']], ['col'])
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'-2")
    expect(csv).toContain("'@SUM(A1)")
  })

  it('quotes fields containing commas, quotes or carriage returns', () => {
    const csv = buildCsv([['line1\rline2'], ['a,b']], ['col'])
    expect(csv).toContain('"line1\rline2"')
    expect(csv).toContain('"a,b"')
  })

  it('leaves ordinary fields untouched and escapes double quotes', () => {
    const csv = buildCsv([['plain'], ['he said "hi"']], ['col'])
    expect(csv).toContain('\nplain')
    expect(csv).toContain('"he said ""hi"""')
  })
})
