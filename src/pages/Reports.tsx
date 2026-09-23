import { useState } from 'react'
import { useApp } from '../store'
import { fmtRp, fmtK } from '../lib/money'
import { todayStr, yesterdayStr, isoTime } from '../lib/date'
import { buildCsv, downloadCsv } from '../lib/csv'
import { buildDailyReport, whatsappUrl } from '../lib/report'
import { Badge, Button, Chip, EmptyState, Field } from '../components/primitives'
import { BarChart, RankList } from '../components/Chart'
import { useToast } from '../components/Toast'

export default function Reports() {
  const {
    transactions,
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
  const [awal, setAwal] = useState(0)
  const [barberName, setBarberName] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const s = dailySummary(date)
  const txns = transactions.filter((t) => t.date === date)
  const breakdown = dailyBreakdown(date)
  const itemCount = breakdown.reduce((acc, b) => acc + b.quantity, 0)
  const chart = revenueSeries(14).map((d) => ({ label: d.date.slice(8, 10), value: d.revenue }))
  const top = topItems(yesterdayStr(), 6).map((i) => ({ name: i.name, value: i.revenue, valueText: fmtRp(i.revenue) }))

  const text = buildDailyReport({
    date,
    cabang: settings.shopName,
    barbers: selected,
    awal,
    um: s.totalCash,
    qr: s.totalQris,
    free: 0,
    lines: dailyLines(date),
  })

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

  const copyReport = async () => {
    await navigator.clipboard.writeText(text)
    toast.push('Disalin', 'success')
  }

  const openWhatsApp = () => window.open(whatsappUrl(text), '_blank')

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
            <div className="card-title">Transaksi</div>
            <div className="card-sub">{s.totalTransactions} transaksi · {itemCount} item</div>
          </div>
          <Button variant="outline" size="sm" icon="download" onClick={exportCsv}>CSV</Button>
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
                    <td>{itemCount}</td>
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

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Laporan harian</div>
            <div className="card-sub">Text report siap kirim ke grup WhatsApp</div>
          </div>
        </div>
        <Field label="Awal / Uang awal">
          <input type="number" inputMode="numeric" className="input" value={awal} onChange={(e) => setAwal(Number(e.target.value) || 0)} />
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
        </Field>
        <Field label="Pratinjau">
          <textarea className="textarea" readOnly value={text} />
        </Field>
        <div className="head-actions">
          <Button variant="outline" onClick={copyReport}>Salin</Button>
          <Button variant="primary" onClick={openWhatsApp}>WhatsApp</Button>
        </div>
      </section>
    </div>
  )
}