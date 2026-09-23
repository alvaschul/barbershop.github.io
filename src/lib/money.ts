export function fmtRp(n: number): string {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

export function fmtK(n: number): string {
  const v = Math.round(Number(n) || 0)
  if (v >= 10000) {
    const k = Math.round(v / 1000)
    return k.toLocaleString('id-ID') + 'K'
  }
  return v.toLocaleString('id-ID')
}

export function fmtNum(n: number): string {
  return (Number(n) || 0).toLocaleString('id-ID')
}