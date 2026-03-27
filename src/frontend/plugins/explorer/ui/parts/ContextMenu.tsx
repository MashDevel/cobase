import useExplorerStore, { type FileClipboard } from '../../store'
import useEditorStore, { openEditorFile } from '../../../editor/store'
import { copyText } from '../../../../clipboard'

export type ContextMenuTarget = {
  kind: 'file' | 'directory'
  path: string
  name: string
  x: number
  y: number
}

type Props = {
  target: ContextMenuTarget
  onClose: () => void
  notify: (message: string) => void
}

function Item({ label, onClick, disabled = false, danger = false }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      className={`w-full px-3 py-1.5 text-left text-sm cursor-pointer ${danger ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'} ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
}

function matchesPath(candidate: string, target: string) {
  return candidate === target || candidate.startsWith(`${target}/`)
}

async function pasteClipboard(clipboard: FileClipboard, destinationDir: string) {
  return clipboard.mode === 'copy'
    ? window.api.fs.copyPathTo(clipboard.path, destinationDir)
    : window.api.fs.movePathTo(clipboard.path, destinationDir)
}

export default function ContextMenu({ target, onClose, notify }: Props) {
  const clipboard = useExplorerStore((state) => state.clipboard)
  const setClipboard = useExplorerStore((state) => state.setClipboard)
  const refreshFolder = useExplorerStore((state) => state.refreshFolder)
  const renameEditorEntry = useEditorStore((state) => state.renameEntry)
  const removeEditorEntry = useEditorStore((state) => state.removeEntry)
  const pasteDisabled = !clipboard || target.path === clipboard.path || target.path.startsWith(`${clipboard.path}/`)

  const run = async (task: () => Promise<void>) => {
    try {
      await task()
    } finally {
      onClose()
    }
  }

  return (
    <div
      className="fixed z-50 min-w-48 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1"
      style={{ left: target.x, top: target.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {target.kind === 'file' ? (
        <Item
          label="Open"
          onClick={() => {
            void run(async () => {
              await openEditorFile(target.path)
            })
          }}
        />
      ) : null}
      <Item
        label="Open in Finder"
        onClick={() => {
          void run(async () => {
            const result = target.kind === 'file'
              ? await window.api.fs.revealPathInSystem(target.path)
              : await window.api.fs.openPathInSystem(target.path)
            notify(result.ok ? `Opened ${target.name}` : result.error?.message || 'Open failed')
          })
        }}
      />
      <Divider />
      <Item
        label="Copy"
        onClick={() => {
          setClipboard({ mode: 'copy', path: target.path })
          notify(`Copy ready for ${target.name}`)
          onClose()
        }}
      />
      <Item
        label="Cut"
        onClick={() => {
          setClipboard({ mode: 'cut', path: target.path })
          notify(`Cut ready for ${target.name}`)
          onClose()
        }}
      />
      {target.kind === 'directory' ? (
        <Item
          label="Paste"
          disabled={pasteDisabled}
          onClick={() => {
            if (!clipboard) return
            void run(async () => {
              const result = await pasteClipboard(clipboard, target.path)
              if (!result.ok) {
                notify(result.error?.message || 'Paste failed')
                return
              }
              if (clipboard.mode === 'cut') {
                renameEditorEntry(clipboard.path, result.data!.path)
                setClipboard(null)
              }
              await refreshFolder()
              notify(`Pasted into ${target.name}`)
            })
          }}
        />
      ) : null}
      <Divider />
      <Item
        label="Copy Path"
        onClick={() => {
          void run(async () => {
            await copyText(target.path)
            notify('Copied path')
          })
        }}
      />
      <Item
        label="Rename"
        onClick={() => {
          const nextName = window.prompt('Rename to', target.name)
          if (!nextName || nextName === target.name) {
            onClose()
            return
          }
          void run(async () => {
            const result = await window.api.fs.renamePath(target.path, nextName)
            if (!result.ok) {
              notify(result.error?.message || 'Rename failed')
              return
            }
            renameEditorEntry(target.path, result.data!.path)
            if (clipboard?.path === target.path) {
              setClipboard({ ...clipboard, path: result.data!.path })
            }
            await refreshFolder()
            notify(`Renamed to ${nextName}`)
          })
        }}
      />
      <Item
        label="Delete"
        danger
        onClick={() => {
          const confirmed = window.confirm(`Delete ${target.name}?`)
          if (!confirmed) {
            onClose()
            return
          }
          void run(async () => {
            const result = await window.api.fs.deletePath(target.path)
            if (!result.ok) {
              notify(result.error?.message || 'Delete failed')
              return
            }
            removeEditorEntry(target.path)
            if (clipboard && matchesPath(clipboard.path, target.path)) setClipboard(null)
            await refreshFolder()
            notify(`Deleted ${target.name}`)
          })
        }}
      />
    </div>
  )
}
