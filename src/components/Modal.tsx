import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icons'

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  wide,
  sheet,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
  wide?: boolean
  sheet?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={'modal' + (wide ? ' wide' : '') + (sheet ? ' sheet' : '')}
        style={wide && !sheet ? { maxWidth: '620px' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {sheet && <div className="sheet-handle" aria-hidden="true" />}
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}