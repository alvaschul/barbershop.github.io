import type { ChangeEvent } from 'react'

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  disabled?: boolean
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)
  return (
    <label className={'toggle' + (disabled ? ' toggle-disabled' : '')}>
      <input type="checkbox" checked={checked} onChange={handle} disabled={disabled} />
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
}