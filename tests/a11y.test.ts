import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field, Chip } from '../src/components/primitives'
import { Modal } from '../src/components/Modal'

function attr(html: string, tag: RegExp, name: string): string | null {
  const m = tag.exec(html)
  if (!m) return null
  return new RegExp(name + '="([^"]*)"').exec(m[0])?.[1] ?? null
}

describe('Field', () => {
  it('associates its label with the control', () => {
    const html = renderToStaticMarkup(
      createElement(Field, { label: 'Nama item' }, createElement('input', { className: 'input' }))
    )
    const inputTag = /<input[^>]*>/.exec(html)
    expect(inputTag).not.toBeNull()
    const id = attr(html, /<input[^>]*>/, 'id')
    const htmlFor = attr(html, /<label[^>]*>/, 'for')
    expect(id).toBeTruthy()
    expect(htmlFor).toBe(id)
  })
})

describe('Chip', () => {
  it('exposes its selected state to assistive tech', () => {
    const on = renderToStaticMarkup(createElement(Chip, { selected: true, onClick: () => {} }, 'Tunai'))
    const off = renderToStaticMarkup(createElement(Chip, {}, 'Tunai'))
    expect(attr(on, /<button[^>]*>/, 'aria-pressed')).toBe('true')
    expect(attr(off, /<button[^>]*>/, 'aria-pressed')).toBe('false')
  })
})

describe('Modal', () => {
  const html = () =>
    renderToStaticMarkup(
      createElement(Modal, { open: true, onClose: () => {}, title: 'Simpan data' }, createElement('p', null, 'isi'))
    )

  it('is announced as a labelled modal dialog', () => {
    const h = html()
    expect(attr(h, /<div[^>]*role="dialog"[^>]*>/, 'role')).toBe('dialog')
    expect(attr(h, /<div[^>]*role="dialog"[^>]*>/, 'aria-modal')).toBe('true')
    const labelledBy = attr(h, /<div[^>]*role="dialog"[^>]*>/, 'aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const titleTag = new RegExp('<h3[^>]*id="' + labelledBy + '"[^>]*>([^<]*)</h3>').exec(h)
    expect(titleTag?.[1]).toContain('Simpan data')
  })

  it('can be focused programmatically', () => {
    expect(attr(html(), /<div[^>]*role="dialog"[^>]*>/, 'tabindex')).toBe('-1')
  })
})

describe('Field with extra siblings', () => {
  it('still associates the label with the first control', () => {
    const html = renderToStaticMarkup(
      createElement(
        Field,
        { label: 'Uang awal' },
        createElement('input', { className: 'input' }),
        createElement('span', { className: 'field-error' }, 'err')
      )
    )
    const id = attr(html, /<input[^>]*>/, 'id')
    expect(id).toBeTruthy()
    expect(attr(html, /<label[^>]*>/, 'for')).toBe(id)
  })
})
