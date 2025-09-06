import { useEffect, useMemo, useRef, useState } from 'react'
import useShellStore from './store'
import type { PluginCommand } from './types'
import { getAllCommands } from '../shell/registry'

export default function CommandPalette() {
  const open = useShellStore(s => s.paletteOpen)
  const setOpen = useShellStore(s => s.setPaletteOpen)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const commands = useMemo<PluginCommand[]>(() => (open ? getAllCommands() : []), [open])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.title.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (open && e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-white dark:bg-neutral-800 rounded shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="border-b border-neutral-200 dark:border-neutral-700 p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command"
            className="w-full bg-transparent outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100"
              onClick={async () => {
                await cmd.run()
                setOpen(false)
              }}
            >
              {cmd.title}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-neutral-500 dark:text-neutral-400">No commands</div>
          )}
        </div>
      </div>
    </div>
  )
}
