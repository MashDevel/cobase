import useShellStore from './store'
import { plugins } from './registry'

export default function LeftRail() {
  const active = useShellStore(s => s.activePluginId)
  const setActive = useShellStore(s => s.setActivePluginId)

  return (
    <div className="w-12 border-r bg-white dark:bg-neutral-900 flex flex-col items-center gap-2 pt-10 pb-2">
      {plugins.map(p => (
        <button
          key={p.manifest.id}
          className={`w-9 h-9 rounded flex items-center justify-center text-neutral-700 dark:text-neutral-200 ${active === p.manifest.id ? 'bg-neutral-200 dark:bg-neutral-700' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
          onClick={() => setActive(p.manifest.id)}
          aria-label={p.manifest.title}
          title={p.manifest.title}
        >
          {p.manifest.icon}
        </button>
      ))}
    </div>
  )
}
