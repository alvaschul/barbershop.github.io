import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement, useId } from 'react'
import { Icon, type IconName } from './Icons'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: IconName
  children?: ReactNode
}

export function Button({ className, variant = 'primary', size, icon, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={['btn', VARIANT_CLASS[variant], size === 'sm' && 'btn-sm', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

function assignControlId(children: ReactNode, fallbackId: string): { content: ReactNode; controlId: string | null } {
  if (isValidElement(children)) {
    const props = children.props as { id?: string }
    const controlId = props.id ?? fallbackId
    return { content: cloneElement(children as ReactElement<{ id?: string }>, { id: controlId }), controlId }
  }
  if (Array.isArray(children)) {
    let controlId: string | null = null
    const content = children.map((child) => {
      if (controlId !== null) return child
      if (isValidElement(child)) {
        const props = child.props as { id?: string }
        controlId = props.id ?? fallbackId
        return cloneElement(child as ReactElement<{ id?: string }>, { id: controlId })
      }
      return child
    })
    if (controlId !== null) return { content, controlId }
    return { content: children, controlId: null }
  }
  return { content: children, controlId: null }
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { content, controlId } = assignControlId(children, useId())
  return (
    <div className="field">
      {label &&
        (controlId ? (
          <label className="field-label" htmlFor={controlId}>
            {label}
          </label>
        ) : (
          <span className="field-label">{label}</span>
        ))}
      {content}
      {hint && <span className="small muted">{hint}</span>}
    </div>
  )
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={['chip', selected && 'chip-selected'].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={!!selected}
    >
      {children}
    </button>
  )
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} />
      <div className="empty-title">{title}</div>
      {body && <div className="small">{body}</div>}
    </div>
  )
}

type BadgeTone = 'accent' | 'muted' | 'danger' | 'warn' | 'qris'

export function Badge({ tone = 'accent', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={'badge badge-' + tone}>{children}</span>
}