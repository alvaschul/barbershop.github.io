import { fmtDmy } from './date'
import { fmtK } from './money'

export interface ReportLine {
  name: string
  category: 'service' | 'product'
  quantity: number
}

export interface ReportInput {
  date: string
  cabang: string
  barbers: string[]
  awal: number
  um: number
  qr: number
  free: number
  lines: ReportLine[]
}

export function buildDailyReport(inp: ReportInput): string {
  const cabang = inp.cabang.trim() || 'cabang lain'
  const services = inp.lines.filter((l) => l.category === 'service')
  const products = inp.lines.filter((l) => l.category === 'product')
  const g = (list: ReportLine[]) => list.map((l) => `\u2022${l.name} : *${l.quantity}*`)
  // TOTAL AKHIR = TOTAL AWAL - pengeluaran (UM + QR + Free Haircut).
  const akhir = inp.awal - inp.um - inp.qr - inp.free

  const lines: string[] = []
  lines.push('*LAPORAN HARIAN*')
  lines.push(`*Badboy Barber _${cabang}_*`)
  lines.push(`*Tanggal : ${fmtDmy(inp.date)}*`)
  lines.push('')
  lines.push('Kapster :')
  inp.barbers.forEach((name, i) => lines.push(`${i + 1}. *${name}*`))
  lines.push('')
  lines.push('*PENDAPATAN*')
  lines.push('')
  lines.push('*SERVICES*')
  lines.push(...g(services))
  lines.push('')
  lines.push('*PRODUCTS*')
  lines.push(...g(products))
  lines.push('')
  lines.push('*TOTAL AWAL* = *' + fmtK(inp.awal) + '*')
  lines.push('')
  lines.push('*PENGELUARAN*')
  lines.push('')
  lines.push('UM = *' + fmtK(inp.um) + '*')
  lines.push('QR = *' + fmtK(inp.qr) + '*')
  if (inp.free) lines.push('Free Haircut = *' + fmtK(inp.free) + '*')
  lines.push('')
  lines.push('*TOTAL AKHIR*= *' + fmtK(akhir) + '*')
  lines.push('')
  lines.push('')
  lines.push('_Close_')
  return lines.join('\n')
}

export function whatsappUrl(text: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(text)
}