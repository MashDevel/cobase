import { listen } from '@tauri-apps/api/event'
import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react'
import { FileCode2, Plus, X } from 'lucide-react'
import useEditorStore from '../store'
import useExplorerStore from '../../explorer/store'
import { useNotify } from '../../../hooks/useNotify'
import Notify from '../../../components/Notify'
import { getFileIcon } from '../fileIcons'
import useResizable from '../../../hooks/useResizable'
import CodeEditor from './CodeEditor'

const TerminalPane = lazy(() => import('./TerminalPane'))

const extensionToLanguage: Record<string, string> = {
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  css: 'css',
  go: 'go',
  h: 'c',
  htm: 'html',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  md: 'markdown',
  mts: 'typescript',
  py: 'python',
  rs: 'rust',
  sh: 'shell',
  sql: 'sql',
  svg: 'xml',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plaintext',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
}

const pathToLanguage = (path: string | null) => {
  if (!path) return 'plaintext'
  const extension = path.split('.').pop()?.toLowerCase()
  return extension ? extensionToLanguage[extension] || 'plaintext' : 'plaintext'
}

const TabsBar = memo(function TabsBar({
  activePath,
  onOpenMenu,
}: {
  activePath: string | null
  onOpenMenu: (path: string, x: number, y: number) => void
}) {
  const openOrder = useEditorStore((state) => state.openOrder)
  const buffers = useEditorStore((state) => state.buffers)
  const setActivePath = useEditorStore((state) => state.setActivePath)
  const closeFile = useEditorStore((state) => state.closeFile)

  if (openOrder.length === 0) return null

  return (
    <div className="h-10 shrink-0 min-w-0 overflow-x-auto overflow-y-hidden border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/80">
      <div className="flex min-w-max items-center">
        {openOrder.map((path) => {
          const buffer = buffers[path]
          const isActive = path === activePath
          const isDirty = buffer && buffer.value !== buffer.savedValue
          const icon = getFileIcon(path)
          return (
            <div
              key={path}
              className={`h-10 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex items-center gap-2 px-3 text-sm ${isActive ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}
              onContextMenu={(event) => {
                event.preventDefault()
                window.getSelection()?.removeAllRanges()
                onOpenMenu(path, event.clientX, event.clientY)
              }}
              onMouseDown={(event) => {
                if (event.button === 2) event.preventDefault()
              }}
            >
              <button className="text-left flex items-center gap-2 cursor-pointer" onClick={() => setActivePath(path)} title={path}>
                <span className={`shrink-0 ${icon.className}`}>{icon.icon}</span>
                <span>
                  {buffer?.name || path.split(/[\\/]/).pop()}
                  {isDirty ? ' *' : ''}
                </span>
              </button>
              <button
                className="shrink-0 rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 cursor-pointer"
                onClick={() => closeFile(path)}
                aria-label={`Close ${buffer?.name || path}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
})

const ActiveEditorPane = memo(function ActiveEditorPane() {
  const activePath = useEditorStore((state) => state.activePath)
  const activeBuffer = useEditorStore((state) => state.activePath ? state.buffers[state.activePath] : null)
  const updateValue = useEditorStore((state) => state.updateValue)
  const language = useMemo(() => pathToLanguage(activePath), [activePath])

  if (!activeBuffer) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <FileCode2 className="h-6 w-6 text-neutral-600 dark:text-neutral-300" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Open a file from Explorer</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Click any file in the Explorer tree to load it into the editor.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 relative">
      {activeBuffer.loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading file...
        </div>
      ) : activeBuffer.error ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-red-600 dark:text-red-400">
          {activeBuffer.error}
        </div>
      ) : (
        <CodeEditor
          path={activeBuffer.path}
          language={language}
          value={activeBuffer.value}
          savedValue={activeBuffer.savedValue}
          onChange={(value) => updateValue(activeBuffer.path, value)}
        />
      )}
    </div>
  )
})

export default function Main() {
  const activePath = useEditorStore((state) => state.activePath)
  const saveActive = useEditorStore((state) => state.saveActive)
  const closeFile = useEditorStore((state) => state.closeFile)
  const closeOthers = useEditorStore((state) => state.closeOthers)
  const closeLeft = useEditorStore((state) => state.closeLeft)
  const closeRight = useEditorStore((state) => state.closeRight)
  const terminalVisible = useEditorStore((state) => state.terminalVisible)
  const setTerminalVisible = useEditorStore((state) => state.setTerminalVisible)
  const toggleTerminalVisible = useEditorStore((state) => state.toggleTerminalVisible)
  const createTerminalSession = useEditorStore((state) => state.createTerminalSession)
  const folderPath = useExplorerStore((state) => state.folderPath)
  const notify = useNotify()
  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null)
  const { ref: terminalRef, style: terminalStyle, handleProps: terminalHandleProps } = useResizable<HTMLDivElement>({
    axis: 'y',
    edge: 'start',
    initial: 224,
    min: 120,
    max: 420,
    storageKey: 'editor-terminal-height',
  })

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        const result = await saveActive()
        notify.notify(result.ok ? 'Saved file' : result.error || 'Save failed')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notify, saveActive])

  useEffect(() => {
    const onPointer = () => setMenu(null)
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    let dispose: null | (() => void) = null
    void listen('menu:toggle-terminal', () => {
      toggleTerminalVisible()
    }).then((unlisten) => {
      dispose = unlisten
    })
    return () => {
      if (dispose) dispose()
    }
  }, [toggleTerminalVisible])

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-white dark:bg-neutral-950">
      <TabsBar activePath={activePath} onOpenMenu={(path, x, y) => setMenu({ path, x, y })} />
      {menu ? (
        <div
          className="fixed z-50 min-w-44 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer" onClick={() => { closeFile(menu.path); setMenu(null) }}>
            Close
          </button>
          <button className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer" onClick={() => { closeOthers(menu.path); setMenu(null) }}>
            Close Others
          </button>
          <button className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer" onClick={() => { closeLeft(menu.path); setMenu(null) }}>
            Close Tabs to the Left
          </button>
          <button className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer" onClick={() => { closeRight(menu.path); setMenu(null) }}>
            Close Tabs to the Right
          </button>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 flex flex-col">
        <ActiveEditorPane />
        {terminalVisible ? (
          <div ref={terminalRef} className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 relative bg-neutral-50 dark:bg-[#111111]" style={terminalStyle}>
            <div className="absolute top-0 left-0 right-0 h-1 cursor-row-resize no-drag z-10" onMouseDown={terminalHandleProps.onMouseDown}>
              <div className="h-full w-full bg-transparent hover:bg-neutral-300/50 dark:hover:bg-neutral-600/40" />
            </div>
            <div className="h-7 px-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-100 dark:bg-[#151515]">
              <div className="text-[11px] font-semibold tracking-[0.12em] text-neutral-500 dark:text-neutral-400">TERMINAL</div>
              <div className="flex items-center gap-1">
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 cursor-pointer"
                  onClick={() => {
                    void createTerminalSession(folderPath)
                    setTerminalVisible(true)
                  }}
                  title="New terminal session"
                  aria-label="New terminal session"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 cursor-pointer"
                  onClick={() => setTerminalVisible(false)}
                  title="Hide terminal"
                  aria-label="Hide terminal"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-28px)]">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">Loading terminal...</div>}>
                <TerminalPane cwd={folderPath} visible={terminalVisible} />
              </Suspense>
            </div>
          </div>
        ) : null}
      </div>
      {notify.message ? <Notify message={notify.message} /> : null}
    </div>
  )
}
