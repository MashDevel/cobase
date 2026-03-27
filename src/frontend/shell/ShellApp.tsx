import { Suspense, startTransition, useEffect, useState } from 'react'
import LeftRail from './LeftRail'
import TopBar from './TopBar'
import CommandPalette from './CommandPalette'
import { getPlugin, preloadPlugin } from './registry'
import type { PluginModule } from './types'
import useShellStore from './store'

function PaneFallback() {
  return <div className="flex-1 min-h-0 bg-white dark:bg-neutral-950" />
}

export default function ShellApp() {
  const active = useShellStore(s => s.activePluginId)
  const [plugin, setPlugin] = useState<PluginModule | null>(null)

  useEffect(() => {
    let cancelled = false
    preloadPlugin(active)
    void getPlugin(active).then((nextPlugin) => {
      if (cancelled || !nextPlugin) return
      startTransition(() => {
        setPlugin(nextPlugin)
      })
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const Plugin = plugin?.manifest.id === active ? plugin : null
  const Sidebar = Plugin?.Sidebar
  const Main = Plugin?.Main

  return (
    <div className="h-screen flex bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      <LeftRail />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <TopBar />
        <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
          <Suspense fallback={<PaneFallback />}>
            <div className="shrink-0 h-full overflow-hidden">{Sidebar ? <Sidebar /> : null}</div>
            <div className="flex-1 overflow-hidden min-h-0 min-w-0 flex flex-col">{Main ? <Main /> : null}</div>
          </Suspense>
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
