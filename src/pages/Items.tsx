import { useState } from 'react'
import { useApp } from '../store'
import { fmtRp } from '../lib/money'
import type { Branch, Category, Item } from '../types'
import { Badge, Button, Chip, EmptyState, Field } from '../components/primitives'
import { Confirm } from '../components/ConfirmDialog'
import { Icon } from '../components/Icons'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import { useToast } from '../components/Toast'

interface ItemForm {
  name: string
  price: number
  category: Category
  branchId: number
  hidden: boolean
}

const EMPTY_FORM: ItemForm = { name: '', price: 0, category: 'service', branchId: 0, hidden: false }

export default function Items() {
  const { items, branches, addItem, updateItem, deleteItem, addBranch, renameBranch, deleteBranch } = useApp()
  const toast = useToast()

  const [filter, setFilter] = useState<'all' | Category>('all')
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [addingBranch, setAddingBranch] = useState(false)
  const [renaming, setRenaming] = useState<Branch | null>(null)
  const [branchName, setBranchName] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [branchError, setBranchError] = useState<string | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null)
  const [branchesOpen, setBranchesOpen] = useState(false)

  const activeBranches = branches.filter((b) => b.isActive)
  const branchNameById = (id: number) => branches.find((b) => b.id === id)?.name ?? 'Tanpa cabang'
  const visible = items.filter((it) => filter === 'all' || it.category === filter)

  const openNew = () => {
    setForm({ ...EMPTY_FORM, branchId: activeBranches[0]?.id ?? 0 })
    setError(null)
    setEditing('new')
  }

  const openEdit = (it: Item) => {
    setForm({ name: it.name, price: it.price, category: it.category, branchId: it.branchId, hidden: it.isHidden })
    setError(null)
    setEditing(it)
  }

  const saveItem = async () => {
    if (editing && editing !== 'new') {
      await updateItem(editing.id, { name: form.name, price: form.price, category: form.category, isHidden: form.hidden })
      setEditing(null)
      toast.push('Item tersimpan', 'success')
      return
    }
    const err = await addItem({ name: form.name, price: form.price, category: form.category, branchId: form.branchId, hidden: form.hidden })
    if (err) {
      setError(err)
      return
    }
    setEditing(null)
    toast.push('Item tersimpan', 'success')
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteItem(deleting.id)
    setDeleting(null)
  }

  const saveNewBranch = async () => {
    const err = await addBranch(branchName)
    if (err) {
      setBranchError(err)
      return
    }
    setAddingBranch(false)
    setBranchName('')
    setBranchError(null)
  }

  const saveRename = async () => {
    if (!renaming) return
    const n = renameValue.trim()
    if (n.length < 2) {
      setBranchError('Nama cabang terlalu pendek.')
      return
    }
    if (branches.some((b) => b.id !== renaming.id && b.name.toLowerCase() === n.toLowerCase())) {
      setBranchError('Nama cabang sudah dipakai.')
      return
    }
    await renameBranch(renaming.id, n)
    setRenaming(null)
    setBranchError(null)
  }

  const confirmDeleteBranch = () => {
    if (!deletingBranch) return
    deleteBranch(deletingBranch.id)
    setDeletingBranch(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Layanan & Produk</h1>
          <p className="page-sub">Kelola menu kasir</p>
        </div>
        <div className="head-actions">
          <Button variant="primary" icon="plus" onClick={openNew}>Tambah Item</Button>
        </div>
      </div>

      <div className="head-actions section-gap">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>Semua</Chip>
        <Chip selected={filter === 'service'} onClick={() => setFilter('service')}>Service</Chip>
        <Chip selected={filter === 'product'} onClick={() => setFilter('product')}>Product</Chip>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="inbox" title="Tidak ada item" body="Tambahkan item baru lewat tombol di atas." />
      ) : (
        <div className="row-list section-gap">
          {visible.map((it) => (
            <div className={it.isHidden ? 'row inactive' : 'row'} key={it.id}>
              <div className={it.category === 'service' ? 'icon-tile service' : 'icon-tile product'}>
                <Icon name={it.category === 'service' ? 'scissors' : 'store'} size={20} />
              </div>
              <div className="row-main">
                <div className="row-title">
                  {it.name}
                  {' '}
                  <Badge tone={it.category === 'service' ? 'accent' : 'qris'}>{it.category === 'service' ? 'Service' : 'Product'}</Badge>
                  {it.isHidden ? <Badge tone="muted">HIDDEN</Badge> : null}
                </div>
                <div className="row-sub">{fmtRp(it.price)} · {branchNameById(it.branchId)}</div>
              </div>
              <div className="row-actions">
                <Button variant="ghost" size="sm" icon="edit" aria-label={`Edit ${it.name}`} onClick={() => openEdit(it)} />
                <Button variant="ghost" size="sm" icon="trash" aria-label={`Hapus ${it.name}`} onClick={() => setDeleting(it)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: 0, color: 'var(--ink)', alignItems: 'center', gap: 8 }}
            onClick={() => setBranchesOpen((o) => !o)}
            aria-expanded={branchesOpen}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span className="card-title">Cabang</span>
              <span className="card-sub">Kelola daftar cabang kasir</span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                transform: branchesOpen ? 'rotate(180deg)' : undefined,
                transition: 'transform 160ms var(--ease-out)',
              }}
            >
              <Icon name="chevron-down" size={18} />
            </span>
          </button>
          <Button variant="outline" size="sm" icon="plus" onClick={() => { setAddingBranch(true); setBranchName(''); setBranchError(null) }}>Tambah cabang</Button>
        </div>
        {branchesOpen && (
          branches.length === 0 ? (
            <EmptyState icon="store" title="Belum ada cabang" body="Tambahkan cabang pertama untuk mengelompokkan menu." />
          ) : (
            <div className="row-list">
              {branches.map((b) => (
                <div className="row" key={b.id}>
                  <div className="row-main">
                    <div className="row-title">{b.name}</div>
                    <div className="row-sub">{items.filter((it) => it.branchId === b.id).length} item</div>
                  </div>
                  <div className="row-actions">
                    <Button variant="ghost" size="sm" icon="edit" aria-label={`Ubah ${b.name}`} onClick={() => { setRenaming(b); setRenameValue(b.name); setBranchError(null) }} />
                    <Button variant="ghost" size="sm" icon="trash" aria-label={`Hapus ${b.name}`} onClick={() => setDeletingBranch(b)} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Tambah Item' : editing ? 'Edit Item' : ''}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button variant="primary" onClick={saveItem}>Simpan</Button>
          </>
        }
      >
        <Field label="Nama">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Haircut" />
        </Field>
        <Field label="Harga">
          <input type="number" inputMode="numeric" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} placeholder="0" />
        </Field>
        <Field label="Kategori">
          <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
            <option value="service">Service</option>
            <option value="product">Product</option>
          </select>
        </Field>
        <Field label="Cabang">
          <select
            className="select"
            value={form.branchId}
            disabled={editing !== 'new'}
            onChange={(e) => setForm({ ...form, branchId: Number(e.target.value) })}
          >
            {activeBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        {editing && editing !== 'new' ? (
          <Field label="Hide from menu">
            <Toggle checked={form.hidden} onChange={(hidden) => setForm({ ...form, hidden })} />
          </Field>
        ) : null}
        {error ? <div className="small" style={{ color: 'var(--danger)' }}>{error}</div> : null}
      </Modal>

      <Confirm
        open={deleting !== null}
        title="Hapus item?"
        message="This will remove it from the menu. Past transactions keep their own copy."
        confirmLabel="Hapus"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <Modal
        open={addingBranch}
        onClose={() => setAddingBranch(false)}
        title="Tambah Cabang"
        actions={
          <>
            <Button variant="outline" onClick={() => setAddingBranch(false)}>Batal</Button>
            <Button variant="primary" onClick={saveNewBranch}>Simpan</Button>
          </>
        }
      >
        <Field label="Nama cabang">
          <input className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Contoh: Badboy Sudirman" />
        </Field>
        {branchError ? <div className="small" style={{ color: 'var(--danger)' }}>{branchError}</div> : null}
      </Modal>

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Ubah Nama Cabang"
        actions={
          <>
            <Button variant="outline" onClick={() => setRenaming(null)}>Batal</Button>
            <Button variant="primary" onClick={saveRename}>Simpan</Button>
          </>
        }
      >
        <Field label="Nama cabang">
          <input className="input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
        </Field>
        {branchError ? <div className="small" style={{ color: 'var(--danger)' }}>{branchError}</div> : null}
      </Modal>

      <Confirm
        open={deletingBranch !== null}
        title="Hapus cabang?"
        message="Cabang ini akan dihapus dari daftar. Item yang terhubung ke cabang ini tidak ikut dihapus."
        confirmLabel="Hapus"
        danger
        onConfirm={confirmDeleteBranch}
        onCancel={() => setDeletingBranch(null)}
      />
    </div>
  )
}