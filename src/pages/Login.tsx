import { useState, type FormEvent } from 'react'
import { useApp } from '../store'
import { Button, Field } from '../components/primitives'
import { Icon } from '../components/Icons'

export default function Login() {
  const { needsSetup, login, registerAdmin } = useApp()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (needsSetup) {
      if (pin.length < 4) {
        setError('PIN minimal 4 karakter.')
        return
      }
      if (pin !== pinConfirm) {
        setError('Konfirmasi PIN tidak cocok.')
        return
      }
    } else if (pin.length < 4) {
      setError('PIN minimal 4 karakter.')
      return
    }
    setLoading(true)
    try {
      const err = needsSetup ? await registerAdmin(username, pin) : await login(username, pin)
      if (err) setError(err)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-frame">
        <aside className="auth-story" aria-label="Badboy Barber">
          <img className="auth-photo" src="./images/barbershop-interior.jpg" alt="" />
          <div className="auth-story-brand">
            <div className="auth-story-mark"><Icon name="scissors" size={20} /></div>
            <div>
              <div className="auth-story-wordmark">BADBOY</div>
              <div className="auth-story-label">BARBER / POS</div>
            </div>
          </div>
          <div className="auth-story-copy">
            <p className="auth-kicker">UNTUK HARI-HARI DI TOKO</p>
            <h2>Kasir yang siap<br />menemani setiap shift.</h2>
            <p>Kelola layanan, transaksi, dan laporan harian dari satu tempat—tetap bisa dipakai saat offline.</p>
          </div>
          <div className="auth-story-foot">KASIR &nbsp;·&nbsp; LAYANAN &nbsp;·&nbsp; LAPORAN</div>
        </aside>
        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-logo">
              <Icon name="scissors" size={52} />
              <h1 className="auth-title">Badboy Barber</h1>
              <div className="auth-sub">Kasir offline untuk operasional harian</div>
            </div>
            <form onSubmit={onSubmit}>
              <Field label="Nama pengguna">
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </Field>
              <Field label="PIN akses" hint="PIN untuk akses staf saat berbagi perangkat; bukan pengganti keamanan perangkat.">
                <input
                  className="input"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </Field>
              {needsSetup && (
                <Field label="Konfirmasi PIN">
                  <input
                    className="input"
                    type="password"
                    inputMode="numeric"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                  />
                </Field>
              )}
              {error && (
                <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" className="btn-block" disabled={loading}>
                {loading ? 'Memproses…' : needsSetup ? 'Buat admin & masuk' : 'Masuk'}
              </Button>
              {!needsSetup && (
                <p className="small muted">
                  Data transaksi tersimpan di perangkat ini. POS tetap bisa dipakai tanpa koneksi internet.
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
