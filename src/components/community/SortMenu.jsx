import { useEffect, useRef, useState } from 'react'
import './sort-menu.css'

const options = [
  { value: 'newest', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'confirmed', label: 'Most confirmed' },
]

export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const rootRef = useRef(null)
  const closeTimer = useRef(null)
  const activeOption = options.find((option) => option.value === value) || options[0]

  function openMenu() {
    window.clearTimeout(closeTimer.current)
    setRendered(true)
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setRendered(false), 150)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) closeMenu()
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeMenu()
        rootRef.current?.querySelector('.sort-menu-trigger')?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleOptionKeyDown(event, index) {
    const menuOptions = rootRef.current?.querySelectorAll('[role="menuitemradio"]')
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      menuOptions?.[(index + direction + options.length) % options.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      menuOptions?.[event.key === 'Home' ? 0 : options.length - 1]?.focus()
    }
  }

  return <div className="sort-menu" data-open={open} ref={rootRef}>
    <button type="button" className="sort-menu-trigger" aria-label={`Sort updates: ${activeOption.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls="community-sort-menu" onClick={() => open ? closeMenu() : openMenu()}>
      <span>{activeOption.label}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    {rendered && <div className="sort-menu-options" id="community-sort-menu" role="menu" aria-label="Sort community updates" data-open={open} aria-hidden={!open} inert={!open}>
      {options.map((option, index) => <button type="button" role="menuitemradio" aria-checked={value === option.value} className="sort-menu-option" key={option.value} onClick={() => { onChange(option.value); closeMenu() }} onKeyDown={(event) => handleOptionKeyDown(event, index)}>
        <span>{option.label}</span>{value === option.value && <span className="sort-menu-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>
}
