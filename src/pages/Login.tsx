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
        setError('PIN must be at least 4 characters.')
        return
      }
      if (pin !== pinConfirm) {
        setError('PIN confirmation does not match.')
        return
      }
    } else if (pin.length < 4) {
      setError('PIN must be at least 4 characters.')
      return
    }
    setLoading(true)
    try {
      const err = needsSetup ? await registerAdmin(username, pin) : await login(username, pin)
      if (err) setError(err)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-logo">
          <Icon name="scissors" size={52} />
          <h1 className="auth-title">Badboy Barber</h1>
          <div className="auth-sub">POS & laporan harian</div>
        </div>
        <form onSubmit={onSubmit}>
          <Field label="Username">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </Field>
          <Field label="PIN">
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          {needsSetup && (
            <Field label="Confirm PIN">
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
            <p className="small" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="btn-block" disabled={loading}>
            {loading ? 'Signing in…' : needsSetup ? 'Create admin & sign in' : 'Sign in'}
          </Button>
          {!needsSetup && (
            <p className="small muted">
              Semua data tersimpan offline di perangkat ini (IndexedDB) tanpa server.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
