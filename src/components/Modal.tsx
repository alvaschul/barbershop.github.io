import { useEffect, useId, useRef, type ReactNode } from 'react'
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const focusableSelector = [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        if (element.matches(':disabled') || element.closest('[hidden], [aria-hidden="true"]')) return false
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const focusIsOutside = !(active instanceof Node) || !dialog.contains(active)

      if (!first) {
        e.preventDefault()
        dialog.focus({ preventScroll: true })
      } else if (e.shiftKey && (active === first || active === dialog || focusIsOutside)) {
        e.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!e.shiftKey && (active === last || focusIsOutside)) {
        e.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    const handleFocusin = (e: FocusEvent) => {
      if (e.target instanceof Node && !dialog.contains(e.target)) {
        dialog.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeydown, true)
    document.addEventListener('focusin', handleFocusin, true)
    return () => {
      document.removeEventListener('keydown', handleKeydown, true)
      document.removeEventListener('focusin', handleFocusin, true)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={'modal' + (wide ? ' wide' : '') + (sheet ? ' sheet' : '')}
        style={wide && !sheet ? { maxWidth: '620px' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {sheet && <div className="sheet-handle" aria-hidden="true" />}
        <div className="modal-head">
          <h3 className="modal-title" id={titleId}>
            {title}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}
