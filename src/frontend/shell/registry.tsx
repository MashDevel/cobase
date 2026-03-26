import type { PluginCommand, PluginModule } from './types'
import useShellStore from './store'
import ExplorerPlugin from '../plugins/explorer'
import GitPlugin from '../plugins/git'
import PatchesPlugin from '../plugins/patches'
import SearchPlugin from '../plugins/search'
import SettingsPlugin from '../plugins/settings'

export const plugins: PluginModule[] = [
  ExplorerPlugin,
  GitPlugin,
  PatchesPlugin,
  SearchPlugin,
  SettingsPlugin,
]

export const pluginsById = Object.fromEntries(plugins.map(p => [p.manifest.id, p])) as Record<string, PluginModule>

export function getAllCommands(): PluginCommand[] {
  const shellCommands: PluginCommand[] = plugins.map(p => ({
    id: `switch:${p.manifest.id}`,
    title: `Switch to ${p.manifest.title}`,
    run: async () => {
      useShellStore.setState({ activePluginId: p.manifest.id })
    }
  }))
  const pluginCommands = plugins.flatMap(p => p.commands || [])
  return [...shellCommands, ...pluginCommands]
}
