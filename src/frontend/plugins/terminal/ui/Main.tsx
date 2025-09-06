import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export default function Main() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const idRef = useRef<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [exited, setExited] = useState<{ code?: number; signal?: number } | null>(null)

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: { background: '#0a0a0a' },
    })
    termRef.current = term
    const el = containerRef.current
    if (el) term.open(el)
    let disposed = false
    const fit = new FitAddon()
    term.loadAddon(fit)
    const handleWindowResize = () => fit.fit()

    const init = async () => {
      const res = await window.api.terminal.create()
      if (!res.ok || !res.data) return
      const id = res.data.id
      idRef.current = id
      setSessionId(id)
      fit.fit()
      await window.api.terminal.resize(id, term.cols, term.rows)
      const onData = (payload: { id: string; data: string }) => {
        if (disposed) return
        if (payload.id === id) term.write(payload.data)
      }
      const onExit = (payload: { id: string; exitCode?: number; signal?: number }) => {
        if (payload.id !== id) return
        setExited({ code: payload.exitCode, signal: payload.signal })
      }
      const offData = window.api.terminal.onData(onData)
      const offExit = window.api.terminal.onExit(onExit)
      term.onData(data => {
        const curr = idRef.current
        if (curr) window.api.terminal.write(curr, data)
      })
      term.onResize(size => {
        const curr = idRef.current
        if (curr) window.api.terminal.resize(curr, size.cols, size.rows)
      })
      window.addEventListener('resize', handleWindowResize)
      ;(term as any)._offData = offData
      ;(term as any)._offExit = offExit
    }
    init()

    return () => {
      disposed = true
      const curr = idRef.current
      if (curr) window.api.terminal.kill(curr)
      const offData = (term as any)._offData
      const offExit = (term as any)._offExit
      if (typeof offData === 'function') offData()
      if (typeof offExit === 'function') offExit()
      window.removeEventListener('resize', handleWindowResize)
      term.dispose()
      termRef.current = null
    }
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 text-sm">
        <div className="truncate">{sessionId ? `Session ${sessionId}` : 'Starting terminal...'}</div>
        {exited && (
          <div className="text-red-500">Exited {exited.code ?? ''}</div>
        )}
      </div>
      <div className="flex-1 min-h-0 bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
