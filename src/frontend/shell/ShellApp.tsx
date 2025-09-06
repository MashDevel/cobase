import LeftRail from './LeftRail'
import TopBar from './TopBar'
import CommandPalette from './CommandPalette'
import { pluginsById } from './registry'
import useShellStore from './store'

export default function ShellApp() {
  const active = useShellStore(s => s.activePluginId)
  const Plugin = pluginsById[active]
  const Sidebar = Plugin?.Sidebar
  const Main = Plugin?.Main

  return (
    <div className="h-screen flex bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      <LeftRail />
      <div className="flex-1 flex flex-col min-h-0">
        <TopBar />
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="shrink-0 h-full overflow-hidden">{Sidebar ? <Sidebar /> : null}</div>
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">{Main ? <Main /> : null}</div>
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
