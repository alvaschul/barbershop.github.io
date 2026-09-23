import type { ButtonHTMLAttributes, ReactNode } from 'react'
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

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
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