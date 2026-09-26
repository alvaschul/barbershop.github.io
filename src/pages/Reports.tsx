import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { fmtRp, fmtK } from '../lib/money'
import { todayStr, yesterdayStr, isoTime } from '../lib/date'
import { buildCsv, downloadCsv } from '../lib/csv'
import { buildDailyReport, whatsappUrl } from '../lib/report'
import { itemQtyForTxn } from '../lib/txn'
import { validateRekapan } from '../lib/validate'
import { sendReportToSheet } from '../lib/sheets'
import * as XLSX from 'xlsx'
import { Badge, Button, Chip, EmptyState, Field } from '../components/primitives'
import { BarChart, RankList } from '../components/Chart'
import { useToast } from '../components/Toast'

export default function Reports() {
  const {
    transactions,
    txnItems,
    branches,
    dailySummary,
    dailyBreakdown,
    dailyLines,
    revenueSeries,
    topItems,
    settings,
    saveBarber,
    removeBarber,
  } = useApp()
  const toast = useToast()

  const [date, setDate] = useState(todayStr())
  const [tab, setTab] = useState<'ringkasan' | 'transaksi' | 'rekapan'>('ringkasan')
  const [cabang, setCabang] = useState('')
  const [awal, setAwal] = useState(() => dailySummary(todayStr()).totalRevenue)
  const [free, setFree] = useState(0)
  const [barberName, setBarberName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const lastDate = useRef(date)

  const activeBranches = branches.filter((b) => b.isActive)

  const cabangTouched = useRef(false)

  useEffect(() => {
    if (cabangTouched.current) return
    const first = activeBranches[0]?.name
    if (first && first !== cabang) setCabang(first)
  }, [activeBranches, cabang])

  useEffect(() => {
    if (lastDate.current === date) return
    lastDate.current = date
    setAwal(dailySummary(date).totalRevenue)
  }, [date, dailySummary])

  const s = dailySummary(date)
  const txns = transactions.filter((t) => t.date === date)
  const breakdown = dailyBreakdown(date)
  const itemCount = breakdown.reduce((acc, b) => acc + b.quantity, 0)
  const chart = revenueSeries(14).map((d) => ({ label: d.date.slice(8, 10), value: d.revenue }))
  const top = topItems(yesterdayStr(), 6).map((i) => ({ name: i.name, value: i.revenue, valueText: fmtRp(i.revenue) }))

  const text = buildDailyReport({
    date,
    cabang,
    barbers: selected,
    awal,
    um: s.totalCash,
    qr: s.totalQris,
    free,
    lines: dailyLines(date),
  })

  const { ok: formOk, cabangError, awalError, freeError, barberError } = validateRekapan({
    cabang,
    awal,
    free,
    barbers: selected,
  })

  const formMessage = cabangError
    ? 'Isi nama cabang.'
    : awalError
      ? 'Uang awal harus angka 0 atau lebih.'
      : freeError
        ? 'Free haircut harus angka 0 atau lebih.'
        : barberError
          ? 'Pilih minimal satu kapster.'
          : 'Data rekapan belum lengkap.'

  const checkValid = () => {
    setTried(true)
    return formOk
  }

  const toggleBarber = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))

  const addBarber = async () => {
    if (!barberName.trim()) return
    await saveBarber(barberName.trim())
    setBarberName('')
  }

  const exportCsv = () => {
    const rows = txns.map((t) => [t.id, t.date, t.totalAmount, t.cashAmount, t.qrisAmount, t.changeAmount, t.notes])
    downloadCsv(buildCsv(rows, ['id', 'date', 'total', 'cash', 'qris', 'change', 'notes']), `laporan-${date}.csv`)
    toast.push('CSV diunduh', 'success')
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const txnRows = txns.map((t, i) => ({
      No: i + 1,
      Waktu: isoTime(t.createdAt),
      ID: `#${t.id}`,
      Total: t.totalAmount,
      Tunai: t.cashAmount,
      QRIS: t.qrisAmount,
      Kembalian: t.changeAmount,
      Metode: t.cashAmount > 0 ? 'TUNAI' : t.qrisAmount > 0 ? 'QRIS' : '-',
      Catatan: t.notes || '-',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), 'Transaksi')
    const rincianRows = breakdown.map((b) => ({
      Nama: b.name,
      Kategori: b.category === 'service' ? 'Service' : 'Product',
      Jumlah: b.quantity,
      Total: b.total,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rincianRows), 'Rincian')
    XLSX.writeFile(wb, `laporan-${date}.xlsx`)
    toast.push('Excel diunduh', 'success')
  }

  const sendToSheet = async () => {
    if (!checkValid()) {
      toast.push(formMessage, 'error')
      return
    }
    if (!settings.sheetUrl.trim()) {
      toast.push('Atur URL Google Apps Script di Pengaturan > Sync dulu.', 'error')
      return
    }
    try {
      await sendReportToSheet(settings.sheetUrl, {
        source: 'badboy-barber-pages',
        type: 'report',
        meta: { shopName: settings.shopName },
        date,
        cabang,
        barbers: selected,
        awal,
        free,
        text,
        summary: {
          totalTransactions: s.totalTransactions,
          totalRevenue: s.totalRevenue,
          totalCash: s.totalCash,
          totalQris: s.totalQris,
          totalChange: s.totalChange,
          totalSales: s.totalSales,
          totalProducts: s.totalProducts,
        },
      })
      toast.push('Rekapan terkirim ke sheet', 'success')
    } catch {
      toast.push('Gagal mengirim ke sheet.', 'error')
    }
  }

  const copyReport = async () => {
    if (!checkValid()) {
      toast.push(formMessage, 'error')
      return
    }
    await navigator.clipboard.writeText(text)
    toast.push('Disalin', 'success')
  }

  const openWhatsApp = () => {
    if (!checkValid()) {
      toast.push(formMessage, 'error')
      return
    }
    window.open(whatsappUrl(text), '_blank')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Laporan</h1>
          <p className="page-sub">{date}</p>
        </div>
        <div className="head-actions">
          <input type="date" className="input" style={{ width: 168 }} value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="ghost" size="sm" onClick={() => setDate(todayStr())}>Hari ini</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(yesterdayStr())}>Kemarin</Button>
        </div>
      </div>

      <div className="kpi-grid section-gap">
        <div className="kpi">
          <div className="kpi-label">Transaksi</div>
          <div className="kpi-value">{s.totalTransactions}</div>
          <div className="kpi-note">{s.totalSales} item terjual</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pendapatan</div>
          <div className="kpi-value">{fmtRp(s.totalRevenue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">TUNAI</div>
          <div className="kpi-value">{fmtRp(s.totalCash)}</div>
        </div>
        <div className="kpi tint-qris">
          <div className="kpi-label">QRIS</div>
          <div className="kpi-value">{fmtRp(s.totalQris)}</div>
        </div>
      </div>

      <nav className="tabs">
        {(['ringkasan', 'transaksi', 'rekapan'] as const).map((t) => (
          <button
            key={t}
            className={'tab' + (tab === t ? ' tab-active' : '')}
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => setTab(t)}
          >
            {t === 'ringkasan' ? 'Ringkasan' : t === 'transaksi' ? 'Transaksi' : 'Rekapan'}
          </button>
        ))}
      </nav>

      {tab === 'ringkasan' && (
        <>
          <div className="grid-2 section-gap">
            <section className="card">
              <div className="card-head">
                <div className="card-title">Tren 14 hari</div>
              </div>
              <BarChart data={chart} height={180} valueFormat={fmtK} showAxis />
            </section>
            <section className="card">
              <div className="card-head">
                <div className="card-title">Produk terlaris</div>
              </div>
              {top.length === 0 ? (
                <EmptyState icon="inbox" title="Belum ada data" body="Tidak ada penjualan 24 jam terakhir." />
              ) : (
                <RankList items={top} />
              )}
            </section>
          </div>

          <section className="card section-gap">
            <div className="card-head">
              <div>
                <div className="card-title">Rincian / breakdown</div>
                <div className="card-sub">Item terjual tanggal {date}</div>
              </div>
            </div>
            {breakdown.length === 0 ? (
              <EmptyState icon="inbox" title="Belum ada data" />
            ) : (
              <div className="row-list">
                {breakdown.map((b) => (
                  <div className="row" key={b.itemId}>
                    <div className="row-main">
                      <div className="row-title">{b.name}</div>
                      <div className="row-sub">{b.category === 'service' ? 'Service' : 'Product'}</div>
                    </div>
                    <div className="row-actions">
                      <span className="small muted">{b.quantity}×</span>
                      <span className="bold num">{fmtRp(b.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'transaksi' && (
        <section className="card section-gap">
          <div className="card-head">
            <div>
              <div className="card-title">Transaksi</div>
              <div className="card-sub">{s.totalTransactions} transaksi · {itemCount} item · {date}</div>
            </div>
            <div className="head-actions">
              <Button variant="outline" size="sm" icon="download" onClick={exportCsv}>CSV</Button>
              <Button variant="outline" size="sm" icon="download" onClick={exportExcel}>Excel</Button>
            </div>
          </div>
          {txns.length === 0 ? (
            <EmptyState icon="inbox" title="Belum ada transaksi tanggal ini" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Waktu</th>
                    <th>ID</th>
                    <th>Items</th>
                    <th className="num">Total</th>
                    <th>Metode</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={t.id}>
                      <td>{i + 1}</td>
                      <td>{isoTime(t.createdAt)}</td>
                      <td className="num">#{t.id}</td>
                      <td>{itemQtyForTxn(txnItems, t.id)}</td>
                      <td className="num">{fmtRp(t.totalAmount)}</td>
                      <td>
                        {t.cashAmount > 0 ? (
                          <Badge tone="accent">TUNAI</Badge>
                        ) : t.qrisAmount > 0 ? (
                          <Badge tone="qris">QRIS</Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted">{t.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'rekapan' && (
        <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Laporan harian</div>
            <div className="card-sub">Text report siap kirim ke grup WhatsApp</div>
          </div>
        </div>
        <Field label="Cabang">
          <div className="grid-2">
            <input className="input" value={cabang} onChange={(e) => { cabangTouched.current = true; setCabang(e.target.value) }} placeholder="Nama cabang" />
            <select className="select" value={activeBranches.some((b) => b.name === cabang) ? cabang : ''} onChange={(e) => { if (e.target.value) { cabangTouched.current = true; setCabang(e.target.value) } }}>
              <option value="">Pilih cabang&hellip;</option>
              {activeBranches.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          {tried && cabangError && <span className="field-error">Isi nama cabang.</span>}
        </Field>
        <Field label="Uang awal (total pendapatan hari ini)">
          <input type="number" inputMode="numeric" className="input" value={awal} onChange={(e) => setAwal(Number(e.target.value) || 0)} />
          {tried && awalError && <span className="field-error">Uang awal harus angka 0 atau lebih.</span>}
        </Field>
        <Field label="Free Haircut">
          <input type="number" inputMode="numeric" className="input" value={free} onChange={(e) => setFree(Number(e.target.value) || 0)} />
          {tried && freeError && <span className="field-error">Free haircut harus angka 0 atau lebih.</span>}
        </Field>
        <Field label="Kapster tersimpan">
          <div className="head-actions">
            {settings.savedBarbers.map((name) => (
              <span className="chip" key={name}>
                {name}
                <Button variant="ghost" size="sm" icon="close" aria-label={`Hapus ${name}`} onClick={() => { removeBarber(name) }} />
              </span>
            ))}
            <input className="input" style={{ width: 168 }} value={barberName} onChange={(e) => setBarberName(e.target.value)} placeholder="Nama kapster" />
            <Button variant="outline" size="sm" onClick={addBarber}>Tambah kapster</Button>
          </div>
        </Field>
        <Field label="Kapster yang dilaporkan">
          <div className="head-actions">
            {settings.savedBarbers.length === 0 ? (
              <span className="small muted">Belum ada kapster tersimpan.</span>
            ) : (
              settings.savedBarbers.map((name) => (
                <Chip key={name} selected={selected.includes(name)} onClick={() => toggleBarber(name)}>{name}</Chip>
              ))
            )}
          </div>
          {tried && barberError && <span className="field-error">Pilih minimal satu kapster.</span>}
        </Field>
        <Field label="Pratinjau">
          <textarea className="textarea report-preview" readOnly value={text} aria-label="Pratinjau laporan" />
        </Field>
        <div className="head-actions">
          <Button variant="outline" icon="upload" onClick={sendToSheet}>Kirim ke sheet</Button>
          <Button variant="outline" onClick={copyReport}>Salin</Button>
          <Button variant="primary" onClick={openWhatsApp}>WhatsApp</Button>
        </div>
      </section>
      )}
    </div>
  )
}