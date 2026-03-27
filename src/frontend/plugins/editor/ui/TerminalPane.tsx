import { useEffect, useMemo, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { SquareTerminal, Trash2 } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'
import useEditorStore from '../store'
import useResizable from '../../../hooks/useResizable'

type Props = {
  cwd: string | null
  visible: boolean
}

type TerminalEntry = {
  fit: FitAddon
  terminal: Terminal
}

type QueuedOutput = {
  frame: number | null
  value: string
}

const terminalTheme = (dark: boolean) => ({
  background: dark ? '#0c0f0c' : '#101310',
  foreground: dark ? '#b7f7b7' : '#b7f7b7',
  cursor: '#7CFC8A',
  cursorAccent: '#0c0f0c',
  selectionBackground: dark ? 'rgba(120, 255, 140, 0.22)' : 'rgba(120, 255, 140, 0.18)',
  black: '#0c0f0c',
  red: '#ff6b6b',
  green: '#7CFC8A',
  yellow: '#f4d35e',
  blue: '#7ab6ff',
  magenta: '#d8a8ff',
  cyan: '#74f0ed',
  white: '#d7e7d7',
  brightBlack: '#4f5f4f',
  brightRed: '#ff8f8f',
  brightGreen: '#b8ffb8',
  brightYellow: '#ffe08a',
  brightBlue: '#a8ceff',
  brightMagenta: '#e7c2ff',
  brightCyan: '#9bf7f5',
  brightWhite: '#f4fff4',
})

export default function TerminalPane({ cwd, visible }: Props) {
  const terminalSessions = useEditorStore((state) => state.terminalSessions)
  const activeTerminalSessionId = useEditorStore((state) => state.activeTerminalSessionId)
  const createTerminalSession = useEditorStore((state) => state.createTerminalSession)
  const setActiveTerminalSession = useEditorStore((state) => state.setActiveTerminalSession)
  const markTerminalExited = useEditorStore((state) => state.markTerminalExited)
  const closeTerminalSession = useEditorStore((state) => state.closeTerminalSession)
  const appendTerminalOutput = useEditorStore((state) => state.appendTerminalOutput)
  const activeSession = useMemo(
    () => terminalSessions.find((session) => session.id === activeTerminalSessionId) || null,
    [activeTerminalSessionId, terminalSessions]
  )
  const terminalHostsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const terminalsRef = useRef<Map<string, TerminalEntry>>(new Map())
  const queuedOutputRef = useRef<Map<string, QueuedOutput>>(new Map())
  const activeSessionIdRef = useRef<string | null>(null)
  const bootstrappedRef = useRef(false)
  const { ref: sidebarRef, style: sidebarStyle, handleProps: sidebarHandleProps } = useResizable<HTMLDivElement>({
    axis: 'x',
    edge: 'start',
    initial: 240,
    min: 180,
    max: 360,
    storageKey: 'editor-terminal-session-sidebar-width',
  })

  useEffect(() => {
    if (!cwd) return
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (terminalSessions.length > 0) return
    void createTerminalSession(cwd)
  }, [createTerminalSession, cwd, terminalSessions.length])

  useEffect(() => {
    activeSessionIdRef.current = activeTerminalSessionId
  }, [activeTerminalSessionId])

  useEffect(() => {
    const disposeForRemoved = Array.from(terminalsRef.current.keys()).filter((sessionId) => !terminalSessions.some((session) => session.id === sessionId))
    for (const sessionId of disposeForRemoved) {
      const entry = terminalsRef.current.get(sessionId)
      if (!entry) continue
      entry.terminal.dispose()
      terminalsRef.current.delete(sessionId)
      const queued = queuedOutputRef.current.get(sessionId)
      if (queued?.frame) cancelAnimationFrame(queued.frame)
      queuedOutputRef.current.delete(sessionId)
      delete terminalHostsRef.current[sessionId]
    }
    for (const session of terminalSessions) {
      const host = terminalHostsRef.current[session.id]
      if (!host || terminalsRef.current.has(session.id)) continue
      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        cursorWidth: 2,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        scrollback: 3000,
        theme: terminalTheme(document.documentElement.classList.contains('dark')),
      })
      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(host)
      terminal.onData((data) => {
        void window.api.terminal.write(session.id, data)
      })
      if (session.output) {
        terminal.write(session.output)
      }
      terminalsRef.current.set(session.id, { terminal, fit })
      if (session.id === activeTerminalSessionId) {
        fit.fit()
        void window.api.terminal.resize(session.id, terminal.cols, terminal.rows)
        terminal.focus()
      }
    }
  }, [activeTerminalSessionId, terminalSessions])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = terminalTheme(document.documentElement.classList.contains('dark'))
      for (const { terminal } of terminalsRef.current.values()) {
        terminal.options.theme = theme
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let frame: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        const sessionId = activeSessionIdRef.current
        if (!sessionId) return
        const entry = terminalsRef.current.get(sessionId)
        if (!entry) return
        entry.fit.fit()
        void window.api.terminal.resize(sessionId, entry.terminal.cols, entry.terminal.rows)
      })
    })
    for (const host of Object.values(terminalHostsRef.current)) {
      if (host) resizeObserver.observe(host)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  }, [terminalSessions, visible])

  useEffect(() => {
    let disposeData: (() => void) | void
    let disposeExit: (() => void) | void
    void window.api.terminal.onData((payload) => {
      appendTerminalOutput(payload.sessionId, payload.data)
      const entry = terminalsRef.current.get(payload.sessionId)
      if (!entry) return
      const queued = queuedOutputRef.current.get(payload.sessionId) || {
        frame: null,
        value: '',
      }
      queued.value += payload.data
      if (!queued.frame) {
        queued.frame = requestAnimationFrame(() => {
          queued.frame = null
          const nextEntry = terminalsRef.current.get(payload.sessionId)
          if (!nextEntry || !queued.value) return
          nextEntry.terminal.write(queued.value)
          queued.value = ''
        })
      }
      queuedOutputRef.current.set(payload.sessionId, queued)
    }).then((dispose) => {
      disposeData = dispose
    })
    void window.api.terminal.onExit((payload) => {
      markTerminalExited(payload.sessionId, payload.code ?? null)
      const exitLine = `\r\n[process exited${typeof payload.code === 'number' ? `: ${payload.code}` : ''}]`
      appendTerminalOutput(payload.sessionId, exitLine)
      const entry = terminalsRef.current.get(payload.sessionId)
      if (entry) {
        entry.terminal.writeln(`\r\n[process exited${typeof payload.code === 'number' ? `: ${payload.code}` : ''}]`)
        return
      }
    }).then((dispose) => {
      disposeExit = dispose
    })
    return () => {
      if (disposeData) disposeData()
      if (disposeExit) disposeExit()
      for (const queued of queuedOutputRef.current.values()) {
        if (queued.frame) cancelAnimationFrame(queued.frame)
      }
      for (const { terminal } of terminalsRef.current.values()) {
        terminal.dispose()
      }
      terminalsRef.current.clear()
      queuedOutputRef.current.clear()
    }
  }, [appendTerminalOutput, markTerminalExited])

  useEffect(() => {
    if (!visible || !activeSession) return
    const entry = terminalsRef.current.get(activeSession.id)
    if (!entry) return
    const frame = requestAnimationFrame(() => {
      entry.fit.fit()
      void window.api.terminal.resize(activeSession.id, entry.terminal.cols, entry.terminal.rows)
      entry.terminal.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [activeSession, visible])

  return (
    <div className="h-full flex min-h-0 bg-[#101310]">
      <div className="flex-1 min-w-0 relative">
        {terminalSessions.map((session) => (
          <div
            key={session.id}
            ref={(node) => {
              terminalHostsRef.current[session.id] = node
            }}
            className={`absolute inset-0 px-2 py-1 ${session.id === activeTerminalSessionId ? 'block' : 'hidden'}`}
          />
        ))}
        {!activeSession ? (
          <div className="h-full flex items-center justify-center text-sm text-[#b7f7b7]/70">
            Starting terminal...
          </div>
        ) : null}
      </div>
      <aside
        ref={sidebarRef}
        className="relative shrink-0 border-l border-neutral-200 bg-[#f7f7f7] text-neutral-800 dark:border-neutral-800 dark:bg-[#181818] dark:text-neutral-200"
        style={sidebarStyle}
      >
        <div className="h-full flex flex-col min-h-0">
          <div className="flex-1 overflow-auto py-1">
            {terminalSessions.map((session) => {
              const active = session.id === activeTerminalSessionId
              return (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 border-l-2 px-3 py-2 ${active ? 'border-sky-500 bg-neutral-200/70 dark:bg-neutral-800/70' : 'border-transparent hover:bg-neutral-200/60 dark:hover:bg-neutral-800/50'}`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setActiveTerminalSession(session.id)}
                  >
                    <div className="flex items-center gap-2">
                      <SquareTerminal className={`h-4 w-4 shrink-0 ${session.exited ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'}`} />
                      <span className="truncate text-sm font-medium">{session.title}</span>
                    </div>
                    {session.exited ? (
                      <div className="mt-0.5 truncate pl-6 text-[11px] text-neutral-500 dark:text-neutral-400">
                        Exited{typeof session.exitCode === 'number' ? ` (${session.exitCode})` : ''}
                      </div>
                    ) : null}
                  </button>
                  <button
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-200 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                    onClick={() => void closeTerminalSession(session.id)}
                    title="Delete session"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        <div className="absolute top-0 left-0 h-full w-1 cursor-col-resize no-drag" onMouseDown={sidebarHandleProps.onMouseDown}>
          <div className="h-full w-full bg-transparent hover:bg-neutral-300/50 dark:hover:bg-neutral-600/40" />
        </div>
      </aside>
    </div>
  )
}
