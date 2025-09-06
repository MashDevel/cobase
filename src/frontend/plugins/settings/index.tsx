import { Settings as SettingsIcon } from 'lucide-react'
import type { PluginModule } from '../../shell/types'
import ThemeToggle from '../../components/ThemeToggle'

function Main() {
  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Appearance</h2>
      <div className="flex items-center gap-3">
        <span className="text-neutral-700 dark:text-neutral-300">Theme</span>
        <ThemeToggle />
      </div>
    </div>
  )
}

const SettingsPlugin: PluginModule = {
  manifest: { id: 'settings', title: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> },
  Main,
}

export default SettingsPlugin
