import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { fmtRp } from '../lib/money'
import { fmtDayLong, todayStr } from '../lib/date'
import { Button, Chip, EmptyState } from '../components/primitives'
import { Icon } from '../components/Icons'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import type { Item } from '../types'

export default function Pos() {
  const { items, branches, checkouts, setCheckouts, createTransaction, settings } = useApp()
  const toast = useToast()
  const [branch, setBranch] = useState(0)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<'all' | 'service' | 'product'>('all')
  const [method, setMethod] = useState<'cash' | 'qris'>('cash')
  const [notes, setNotes] = useState('')
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const activeBranches = branches.filter((b) => b.isActive)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((it) => it.isActive)
      .filter((it) => !it.isHidden)
      .filter((it) => branch === 0 || it.branchId === branch)
      .filter((it) => cat === 'all' || it.category === cat)
      .filter((it) => q === '' || it.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === 'service' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [items, branch, search, cat])

  const total = checkouts.reduce((s, l) => s + l.price * l.qty, 0)

  const addToCart = (it: Item) => {
    setCheckouts((prev) => {
      const idx = prev.findIndex((l) => l.itemId === it.id)
      if (idx === -1) {
        return [...prev, { itemId: it.id, name: it.name, price: it.price, category: it.category, qty: 1 }]
      }
      const next = prev.slice()
      const line = next[idx]
      next[idx] = { ...line, qty: line.qty + 1 }
      return next
    })
  }

  const bump = (itemId: number, delta: number) => {
    setCheckouts((prev) =>
      prev.flatMap((l) => {
        if (l.itemId !== itemId) return [l]
        const q = l.qty + delta
        return q < 1 ? [] : [{ ...l, qty: q }]
      })
    )
  }

  const handlePay = async () => {
    if (checkouts.length === 0 || paying) return
    setPaying(true)
    try {
      await createTransaction({
        lines: checkouts,
        method,
        notes,
        branchId: branch === 0 ? null : branch,
      })
      toast.push('Transaksi tersimpan', 'success')
      setCheckouts([])
      setNotes('')
      setPaid(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setPaid(false), 2400)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setPaying(false)
    }
  }

  const renderCheckout = () => {
    if (paid) {
      return (
        <div className="paid-panel">
          <div className="paid-icon">
            <Icon name="check" size={30} />
          </div>
          <div className="auth-title">Transaksi tersimpan</div>
          <div className="small muted">Keranjang dikosongkan</div>
        </div>
      )
    }
    return (
      <>
        <div className="card-title">Transaksi</div>
        <div className="card-sub">{settings.shopName}</div>

        <div className="cart-list">
          {checkouts.length === 0 ? (
            <EmptyState icon="inbox" title="Keranjang kosong" />
          ) : (
            checkouts.map((l) => (
              <div className="cart-line" key={l.itemId}>
                <div className="row-main">
                  <div className="row-title">{l.name}</div>
                  <div className="small muted">{l.category.toUpperCase()}</div>
                </div>
                <div className="cart-qty-wrap">
                  <button type="button" className="qty-btn" aria-label={`Kurangi ${l.name}`} onClick={() => bump(l.itemId, -1)}>−</button>
                  <span className="cart-qty">{l.qty}</span>
                  <button type="button" className="qty-btn" aria-label={`Tambah ${l.name}`} onClick={() => bump(l.itemId, 1)}>+</button>
                </div>
                <div className="num bold">{fmtRp(l.price * l.qty)}</div>
              </div>
            ))
          )}
        </div>

        <div className="divider" />
        <div className="kpi-value num section-gap">{fmtRp(total)}</div>
        <div className="field">
          <input
            className="input"
            placeholder="Catatan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="grid-2 section-gap">
          <Button
            variant={method === 'cash' ? 'primary' : 'outline'}
            icon="calculator"
            type="button"
            onClick={() => setMethod('cash')}
          >
            TUNAI
          </Button>
          <Button
            variant={method === 'qris' ? 'primary' : 'outline'}
            icon="qrcode"
            type="button"
            onClick={() => setMethod('qris')}
          >
            QRIS
          </Button>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={checkouts.length === 0 || paying}
          onClick={handlePay}
        >
          Bayar
        </button>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Kasir</h1>
          <div className="page-sub">{fmtDayLong(todayStr())}</div>
        </div>
        <div className="head-actions">
          <select
            className="select"
            style={{ width: 200, flexShrink: 0 }}
            value={branch}
            onChange={(e) => setBranch(Number(e.target.value))}
          >
            <option value={0}>Semua cabang</option>
            {activeBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Cari menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="head-actions section-gap">
        {(['all', 'service', 'product'] as const).map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
            {c === 'all' ? 'Semua' : c === 'service' ? 'Service' : 'Product'}
          </Chip>
        ))}
      </div>

      <div className="pos-grid">
        {visible.length === 0 ? (
          <div className="card section-gap">
            <EmptyState icon="inbox" title="Belum ada menu" body="Tambahkan item di tab Layanan." />
          </div>
        ) : (
          <div className="menu-list">
            {visible.map((it) => (
              <button key={it.id} type="button" className="menu-card" onClick={() => addToCart(it)}>
                <span className="menu-cat">{it.category.toUpperCase()}</span>
                <span className="menu-name">{it.name}</span>
                <span className="menu-price">{fmtRp(it.price)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="card checkout-card">{renderCheckout()}</div>
      </div>

      {checkouts.length > 0 && !paid && (
        <div className="cart-bar">
          <span className="cart-total">{fmtRp(total)}</span>
          <span className="small muted" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {checkouts.reduce((s, l) => s + l.qty, 0)} item
          </span>
          <Button variant="primary" onClick={() => setCartOpen(true)}>
            Lihat &amp; bayar
          </Button>
        </div>
      )}

      <Modal
        open={cartOpen}
        sheet
        title="Transaksi"
        onClose={() => {
          setCartOpen(false)
          setPaid(false)
        }}
      >
        {renderCheckout()}
      </Modal>
    </>
  )
}