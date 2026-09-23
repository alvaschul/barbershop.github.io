import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icons'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  push: (message: string, type?: ToastType) => void
}

const ToastCtx = createContext<ToastContextValue | null>(null)

let fallbackSeq = 0

function genId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    fallbackSeq += 1
    return 'toast-' + fallbackSeq
  }
}

function toastIcon(type: ToastType): IconName | null {
  if (type === 'success') return 'check'
  if (type === 'error') return 'close'
  return null
}

function ToastView({ toast }: { toast: ToastItem }) {
  const icon = toastIcon(toast.type)
  return (
    <div className={'toast toast-' + toast.type} role="status">
      {icon && <Icon name={icon} size={16} />}
      <span>{toast.message}</span>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = genId()
      setToasts((prev) => [...prev, { id, message, type }])
      const timer = window.setTimeout(() => {
        timers.current.delete(id)
        dismiss(id)
      }, 2600)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => window.clearTimeout(t))
      map.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ push }), [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): { push: (message: string, type?: ToastType) => void } {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return { push: ctx.push }
}