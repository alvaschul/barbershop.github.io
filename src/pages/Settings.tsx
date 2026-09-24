import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useApp, type DbScanRow, type DbView } from '../store'
import { Badge, Button, Chip, EmptyState, Field } from '../components/primitives'
import { Icon, type IconName } from '../components/Icons'
import { Modal } from '../components/Modal'
import { Confirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { testSheet } from '../lib/sheets'
import type { Role, User } from '../types'

type Section = 'users' | 'shop' | 'backup' | 'sync' | 'db'

const PAGE_SIZE = 50

const GROUPS: Array<{ id: string; label: string; rows: Array<{ id: Section; icon: IconName; label: string; danger?: boolean }> }> = [
  {
    id: 'umum',
    label: 'Umum',
    rows: [
      { id: 'users', icon: 'users', label: 'Akun & PIN' },
      { id: 'shop', icon: 'store', label: 'Toko & Barbers' },
      { id: 'backup', icon: 'download', label: 'Data (backup & restore)' },
    ],
  },
  {
    id: 'sistem',
    label: 'Sync & sistem',
    rows: [
      { id: 'sync', icon: 'sync', label: 'Sync (opsional)' },
      { id: 'db', icon: 'database', label: 'Database (admin)', danger: true },
    ],
  },
]

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function Settings() {
  const {
    session,
    users,
    settings,
    logout,
    addUser,
    resetPin,
    toggleUserActive,
    deleteUser,
    saveBarber,
    removeBarber,
    saveSettings,
    exportBackup,
    importBackupFile,
    syncNowAction,
    dbList,
    dbScan,
    dbSaveRow,
    dbDeleteRow,
  } = useApp()
  const toast = useToast()

  const [view, setView] = useState<'home' | Section>('home')

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPinVal, setResetPinVal] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addUsername, setAddUsername] = useState('')
  const [addPin, setAddPin] = useState('')
  const [addRole, setAddRole] = useState<Role>('cashier')
  const [addError, setAddError] = useState('')
  const [delUser, setDelUser] = useState<User | null>(null)

  const [shopName, setShopName] = useState(settings.shopName)
  const [barberName, setBarberName] = useState('')

  const [syncEndpoint, setSyncEndpoint] = useState(settings.syncEndpoint)
  const [syncToken, setSyncToken] = useState(settings.syncToken)
  const [sheetUrl, setSheetUrl] = useState(settings.sheetUrl)
  const [autoSheet, setAutoSheet] = useState(settings.autoSheet)
  const [autoSync, setAutoSync] = useState(settings.autoSync)

  const [tables, setTables] = useState<Array<{ table: string; rows: number }>>([])
  const [dbTable, setDbTable] = useState('users')
  const [dbView, setDbView] = useState<DbView | null>(null)
  const [page, setPage] = useState(0)
  const [editRow, setEditRow] = useState<DbScanRow | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [delTarget, setDelTarget] = useState<{ table: string; id: number } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setShopName(settings.shopName)
  }, [settings.shopName])

  useEffect(() => {
    setSyncEndpoint(settings.syncEndpoint)
  }, [settings.syncEndpoint])

  useEffect(() => {
    setSyncToken(settings.syncToken)
  }, [settings.syncToken])

  useEffect(() => {
    setSheetUrl(settings.sheetUrl)
  }, [settings.sheetUrl])

  useEffect(() => {
    setAutoSheet(settings.autoSheet)
  }, [settings.autoSheet])

  useEffect(() => {
    setAutoSync(settings.autoSync)
  }, [settings.autoSync])

  useEffect(() => {
    dbList().then(setTables)
  }, [dbList])

  useEffect(() => {
    let alive = true
    dbScan(dbTable, PAGE_SIZE, page * PAGE_SIZE).then((v) => {
      if (alive) setDbView(v)
    })
    return () => {
      alive = false
    }
  }, [dbTable, page, dbScan])

  const activeAdmins = users.filter((u) => u.role === 'admin' && u.isActive).length

  const refreshDb = async () => {
    const v = await dbScan(dbTable, PAGE_SIZE, 0)
    setDbView(v)
    setTables(await dbList())
  }

  const switchTable = (t: string) => {
    setDbTable(t)
    setPage(0)
  }

  const handleResetPin = async () => {
    if (!resetTarget) return
    const err = await resetPin(resetTarget.id, resetPinVal)
    if (err) {
      toast.push(err, 'error')
      return
    }
    toast.push(`PIN ${resetTarget.username} diganti`)
    setResetTarget(null)
    setResetPinVal('')
  }

  const handleAddUser = async () => {
    const err = await addUser(addUsername, addPin, addRole)
    if (err) {
      setAddError(err)
      return
    }
    toast.push(`${addUsername.trim()} ditambahkan`)
    setAddUsername('')
    setAddPin('')
    setAddRole('cashier')
    setAddError('')
    setAddOpen(false)
  }

  const handleDeleteClick = (u: User) => {
    if (u.role === 'admin' && activeAdmins <= 1) {
      toast.push('Admin aktif terakhir tidak dapat dihapus.', 'error')
      return
    }
    setDelUser(u)
  }

  const handleDeleteUser = async () => {
    if (!delUser) return
    await deleteUser(delUser.id)
    toast.push(`${delUser.username} dihapus`)
    setDelUser(null)
  }

  const handleToggle = async (u: User) => {
    if (u.id === session?.id && u.isActive) {
      toast.push('Tidak dapat menonaktifkan akun sendiri.', 'error')
      return
    }
    await toggleUserActive(u.id)
    toast.push(u.isActive ? `${u.username} dinonaktifkan` : `${u.username} diaktifkan`)
  }

  const saveShopName = async () => {
    const next = shopName.trim()
    if (!next) {
      setShopName(settings.shopName)
      return
    }
    await saveSettings({ shopName: next })
    toast.push('Nama toko disimpan')
  }

  const handleSaveBarber = async () => {
    const n = barberName.trim()
    if (!n) return
    await saveBarber(n)
    toast.push(`${n} ditambahkan`)
    setBarberName('')
  }

  const handleRemoveBarber = async (name: string) => {
    await removeBarber(name)
    toast.push(`${name} dihapus`)
  }

  const saveSyncFields = async () => {
    await saveSettings({ syncEndpoint: syncEndpoint.trim(), syncToken: syncToken.trim() })
    toast.push('Pengaturan sync disimpan')
  }

  const handleSyncNow = async () => {
    const r = await syncNowAction()
    toast.push(r.message, r.ok ? 'success' : 'error')
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = await importBackupFile(f)
    toast.push(r.message, r.ok ? 'success' : 'error')
    e.target.value = ''
  }

  const openEdit = (r: DbScanRow, cols: string[]) => {
    const vals: Record<string, string> = {}
    for (const c of cols) {
      const raw = r[c]
      vals[c] = raw === null || raw === undefined ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
    }
    setEditValues(vals)
    setEditRow(r)
  }

  const saveEdit = async () => {
    if (!editRow) return
    const cols = dbView?.editable ?? []
    const values: Record<string, unknown> = {}
    for (const c of cols) {
      const orig = editRow[c]
      const raw = editValues[c] ?? ''
      if (typeof orig === 'number') {
        const n = Number(raw)
        values[c] = Number.isNaN(n) ? 0 : n
      } else if (typeof orig === 'boolean') {
        values[c] = raw === 'true' || raw === '1'
      } else {
        values[c] = raw
      }
    }
    try {
      await dbSaveRow(dbTable, editRow.id, values)
      toast.push('Baris disimpan')
      setEditRow(null)
      setPage(0)
      await refreshDb()
    } catch {
      toast.push('Gagal menyimpan baris', 'error')
    }
  }

  const handleDbDelete = async () => {
    if (!delTarget) return
    try {
      await dbDeleteRow(delTarget.table, delTarget.id)
      toast.push('Baris dihapus')
      setDelTarget(null)
      setPage(0)
      await refreshDb()
    } catch {
      toast.push('Gagal menghapus baris', 'error')
    }
  }

  if (session?.role !== 'admin') {
    return (
      <div className="auth-wrap">
        <EmptyState icon="lock" title="Khusus admin" body="Halaman ini hanya untuk admin." />
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <div className="page-sub">Admin</div>
        </div>
        <div className="head-actions">
          <Button variant="outline" icon="lock" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>

      {view === 'home' ? (
        <div className="settings-detail">
          {GROUPS.map((g) => (
            <div className="settings-group" key={g.id}>
              <div className="settings-group-title">{g.label}</div>
              <div className="settings-list">
                {g.rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={'settings-row' + (r.danger ? ' settings-row-danger' : '')}
                    onClick={() => setView(r.id)}
                  >
                    <Icon name={r.icon} size={20} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{r.label}</span>
                    <Icon name="chevron-right" size={18} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="settings-detail">
          <button type="button" className="settings-back" onClick={() => setView('home')}>
            <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
              <Icon name="chevron-down" size={16} />
            </span>
            Kembali
          </button>

          {view === 'users' && (
        <section>
          <div className="row-list section-gap">
            {users.map((u) => {
              const isSelf = u.id === session?.id
              return (
                <div key={u.id} className={`row${u.isActive ? '' : ' inactive'}`}>
                  <div className="row-main">
                    <div className="row-title">{u.username}</div>
                    <div className="row-sub">
                      <Badge tone={u.role === 'admin' ? 'accent' : 'muted'}>
                        {u.role === 'admin' ? 'ADMIN' : 'KASIR'}
                      </Badge>
                      <span style={{ marginLeft: 8 }}>{fmtDate(u.createdAt)}</span>
                    </div>
                  </div>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={u.isActive ? 'check' : 'close'}
                      onClick={() => handleToggle(u)}
                    >
                      {u.isActive ? 'Disable' : 'Active'}
                    </Button>
                    <Button
                      variant="ghost"
                      icon="lock"
                      aria-label={`Reset PIN ${u.username}`}
                      onClick={() => {
                        setResetTarget(u)
                        setResetPinVal('')
                      }}
                    />
                    <Button
                      variant="ghost"
                      icon="trash"
                      aria-label={`Hapus ${u.username}`}
                      disabled={isSelf}
                      onClick={() => handleDeleteClick(u)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            Tambah pengguna
          </Button>
        </section>
      )}

      {view === 'shop' && (
        <section>
          <div className="card section-gap">
            <div className="card-head">
              <div>
                <div className="card-title">Nama toko</div>
                <div className="card-sub">Dipakai untuk laporan &amp; backup</div>
              </div>
            </div>
            <Field label="Nama toko / cabang untuk laporan">
              <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} onBlur={saveShopName} />
            </Field>
            <Button variant="primary" onClick={saveShopName}>
              Simpan
            </Button>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Barber terdaftar</div>
                <div className="card-sub">Kredit untuk laporan layanan</div>
              </div>
            </div>
            <div className="chips section-gap">
              {settings.savedBarbers.length === 0 ? (
                <span className="small muted">Belum ada barber terdaftar.</span>
              ) : (
                settings.savedBarbers.map((b) => (
                  <span key={b} className="chip">
                    {b}
                    <button
                      className="chip-close"
                      aria-label={`Hapus ${b}`}
                      onClick={() => handleRemoveBarber(b)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))
              )}
            </div>
            <Field label="Tambah barber">
              <input
                className="input"
                value={barberName}
                placeholder="Nama barber"
                onChange={(e) => setBarberName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveBarber()
                }}
              />
            </Field>
            <Button variant="primary" onClick={handleSaveBarber}>
              Tambah
            </Button>
          </div>
        </section>
      )}

      {view === 'backup' && (
        <section>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Penyimpanan offline</div>
                <div className="card-sub">Semua data disimpan lokal di perangkat ini</div>
              </div>
            </div>
            <div className="row-actions section-gap">
              <Button variant="primary" icon="download" onClick={() => exportBackup()}>
                Unduh backup JSON
              </Button>
              <Button variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>
                Pulihkan dari file
              </Button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />
            </div>
            <p className="small" style={{ color: 'var(--danger)' }}>
              Peringatan: memulihkan backup mengganti SEMUA data saat ini.
            </p>
          </div>
        </section>
      )}

      {view === 'sync' && (
        <section>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Sync Cloudflare (opsional)</div>
                <div className="card-sub">Salin data ke endpoint eksternal (backup cloud)</div>
              </div>
            </div>
            <Field label="Sync endpoint URL">
              <input
                className="input"
                value={syncEndpoint}
                placeholder="https://bb-barber-sync.feellzzmartijn.workers.dev/api/sync"
                onChange={(e) => setSyncEndpoint(e.target.value)}
                onBlur={saveSyncFields}
              />
            </Field>
            <Field label="Token (optional, Bearer)">
              <input
                className="input"
                type="password"
                value={syncToken}
                autoComplete="off"
                onChange={(e) => setSyncToken(e.target.value)}
                onBlur={saveSyncFields}
              />
            </Field>
            <div className="head-actions">
              <Button variant="primary" icon="sync" onClick={handleSyncNow}>
                Sync sekarang
              </Button>
              <Chip selected={autoSync} onClick={() => { saveSettings({ autoSync: !autoSync }); setAutoSync(!autoSync) }}>
                Auto-sync setelah transaksi: {autoSync ? 'ON' : 'OFF'}
              </Chip>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Opsional: aplikasi bisa dipakai offline tanpa sync.
            </p>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Google Sheets (auto-input)</div>
                <div className="card-sub">Tambah transaksi otomatis ke spreadsheet</div>
              </div>
            </div>
            <Field
              label="URL web app Google Apps Script"
                hint="Deploy Apps Script sebagai web app (Anyone), salin URL /exec"
            >
              <input
                className="input"
                value={sheetUrl}
                placeholder="https://script.google.com/macros/s/XXXX/exec"
                onChange={(e) => setSheetUrl(e.target.value)}
                onBlur={() => { saveSettings({ sheetUrl: sheetUrl.trim() }) }}
              />
            </Field>
            <div className="head-actions">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!sheetUrl.trim()) {
                    toast.push('Isi URL Apps Script dulu.', 'error')
                    return
                  }
                  await saveSettings({ sheetUrl: sheetUrl.trim() })
                  const r = await testSheet(sheetUrl)
                  toast.push(r.message, r.ok ? 'success' : 'error')
                }}
              >
                Tes koneksi
              </Button>
              <Chip selected={autoSheet} onClick={() => { saveSettings({ autoSheet: !autoSheet }); setAutoSheet(!autoSheet) }}>
                Auto-input tiap transaksi: {autoSheet ? 'ON' : 'OFF'}
              </Chip>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Setelah nyala, tiap pembayaran kasir otomatis menambah baris di sheet <b>Transaksi</b>. Rekapan harian dikirim dari halaman Laporan.
            </p>
          </div>
        </section>
      )}

      {view === 'db' && (
        <section>
          <div className="chips section-gap">
            {tables.map((t) => (
              <Chip key={t.table} selected={dbTable === t.table} onClick={() => switchTable(t.table)}>
                {t.table} <span className="muted">({t.rows})</span>
              </Chip>
            ))}
          </div>
          <p className="small section-gap" style={{ color: 'var(--danger)' }}>
            Mengedit data mentah dapat merusak laporan.
          </p>
          {!dbView ? (
            <p className="small muted">Memuat…</p>
          ) : (
            <>
              <div className="table-wrap section-gap">
                <table className="data">
                  <thead>
                    <tr>
                      {dbView.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dbView.rows.length === 0 ? (
                      <tr>
                        <td className="small muted" colSpan={dbView.columns.length + 1}>
                          Tidak ada baris.
                        </td>
                      </tr>
                    ) : (
                      dbView.rows.map((r) => (
                        <tr key={r.id}>
                          {dbView.columns.map((c) => (
                            <td key={c}>{cellText(r[c])}</td>
                          ))}
                          <td>
                            <div className="row-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="edit"
                                aria-label={`Edit baris ${r.id}`}
                                onClick={() => openEdit(r, dbView.editable)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="trash"
                                aria-label={`Hapus baris ${r.id}`}
                                onClick={() => setDelTarget({ table: dbTable, id: r.id })}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="row-actions section-gap">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </Button>
                <span className="small muted">
                  {page + 1} / {Math.max(1, Math.ceil(dbView.total / PAGE_SIZE))} · {dbView.total} baris
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= dbView.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
              <p className="small muted">
                Menghapus transaksi juga menghapus item barisnya; menghapus item tidak mengubah riwayat.
              </p>
            </>
          )}
        </section>
          )}
        </div>
      )}

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset PIN"
        sheet
        actions={
          <>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleResetPin}>
              Simpan
            </Button>
          </>
        }
      >
        <Field label={`PIN baru untuk ${resetTarget?.username ?? 'pengguna'}`} hint="Minimal 4 digit">
          <input
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={resetPinVal}
            onChange={(e) => setResetPinVal(e.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Tambah pengguna"
        sheet
        actions={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddUser}>
              Tambah
            </Button>
          </>
        }
      >
        <Field label="Username">
          <input className="input" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} />
        </Field>
        <Field label="PIN" hint="Minimal 4 digit">
          <input
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={addPin}
            onChange={(e) => setAddPin(e.target.value)}
          />
        </Field>
        <Field label="Peran">
          <select className="select" value={addRole} onChange={(e) => setAddRole(e.target.value as Role)}>
            <option value="cashier">Kasir</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        {addError && (
          <p className="small" style={{ color: 'var(--danger)' }}>
            {addError}
          </p>
        )}
      </Modal>

      <Confirm
        open={!!delUser}
        onCancel={() => setDelUser(null)}
        onConfirm={handleDeleteUser}
        title="Hapus pengguna"
        message={`Hapus ${delUser?.username ?? ''}? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        danger
      />

      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title={`Edit ${dbTable} #${editRow?.id ?? ''}`}
        wide
        actions={
          <>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={saveEdit}>
              Simpan
            </Button>
          </>
        }
      >
        {(dbView?.editable ?? []).map((col) => (
          <Field key={col} label={col}>
            <input
              className="input"
              value={editValues[col] ?? ''}
              onChange={(e) => setEditValues((v) => ({ ...v, [col]: e.target.value }))}
            />
          </Field>
        ))}
      </Modal>

      <Confirm
        open={!!delTarget}
        onCancel={() => setDelTarget(null)}
        onConfirm={handleDbDelete}
        title="Hapus baris"
        message={`Hapus baris #${delTarget?.id ?? ''} dari tabel ${delTarget?.table ?? ''}?`}
        confirmLabel="Hapus"
        danger
      />
    </div>
  )
}