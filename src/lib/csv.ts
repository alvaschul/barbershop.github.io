export function buildCsv(rows: Array<Array<string | number>>, headers: string[]): string {
  const esc = (v: string | number) => {
    const raw = String(v ?? '')
    // Prefix formula-looking values with a quote so spreadsheets treat them as
    // text instead of executing them (CSV injection).
    const formula = /^[=+\-@]/.test(raw)
    const s = formula ? "'" + raw : raw
    if (formula || /[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}