import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import useShellStore from './store'
import type { PluginCommand } from './types'
import { getAllCommands } from '../shell/registry'

export default function CommandPalette() {
  const open = useShellStore(s => s.paletteOpen)
  const setOpen = useShellStore(s => s.setPaletteOpen)
  const [query, setQuery] = useState('')
  const [commands, setCommands] = useState<PluginCommand[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.title.toLowerCase().includes(q))
  }, [commands, deferredQuery])

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
    let cancelled = false
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
      setLoading(true)
      void getAllCommands().then((nextCommands) => {
        if (cancelled) return
        setCommands(nextCommands)
        setLoading(false)
      })
    } else {
      setQuery('')
      setLoading(false)
    }
    return () => {
      cancelled = true
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
          {loading && commands.length === 0 && (
            <div className="px-4 py-6 text-neutral-500 dark:text-neutral-400">Loading commands</div>
          )}
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
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-neutral-500 dark:text-neutral-400">No commands</div>
          )}
        </div>
      </div>
    </div>
  )
}
