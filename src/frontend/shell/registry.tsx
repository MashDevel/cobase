import { FileCode2, FileDiff, FolderOpen, GitBranch, Search as SearchIcon, Settings as SettingsIcon } from 'lucide-react'
import type { PluginCommand, PluginDescriptor, PluginModule } from './types'
import useShellStore from './store'

const pluginLoaders = {
  editor: () => import('../plugins/editor'),
  explorer: () => import('../plugins/explorer'),
  git: () => import('../plugins/git'),
  patches: () => import('../plugins/patches'),
  search: () => import('../plugins/search'),
  settings: () => import('../plugins/settings'),
} as const

const pluginCache = new Map<string, Promise<PluginModule>>()

export const plugins: PluginDescriptor[] = [
  {
    manifest: {
      id: 'editor',
      title: 'Editor',
      icon: <FileCode2 className="w-5 h-5" />,
    },
    load: () => loadPlugin('editor'),
  },
  {
    manifest: {
      id: 'explorer',
      title: 'Explorer',
      icon: <FolderOpen className="w-5 h-5" />,
    },
    load: () => loadPlugin('explorer'),
  },
  {
    manifest: {
      id: 'git',
      title: 'Git',
      icon: <GitBranch className="w-5 h-5" />,
    },
    load: () => loadPlugin('git'),
  },
  {
    manifest: {
      id: 'patches',
      title: 'Patches',
      icon: <FileDiff className="w-5 h-5" />,
    },
    load: () => loadPlugin('patches'),
  },
  {
    manifest: {
      id: 'search',
      title: 'Search',
      icon: <SearchIcon className="w-5 h-5" />,
    },
    load: () => loadPlugin('search'),
  },
  {
    manifest: {
      id: 'settings',
      title: 'Settings',
      icon: <SettingsIcon className="w-5 h-5" />,
    },
    load: () => loadPlugin('settings'),
  },
]

const pluginsById = Object.fromEntries(plugins.map((plugin) => [plugin.manifest.id, plugin])) as Record<string, PluginDescriptor>

export function loadPlugin(id: keyof typeof pluginLoaders): Promise<PluginModule> {
  const cached = pluginCache.get(id)
  if (cached) return cached
  const next = pluginLoaders[id]().then((module) => module.default)
  pluginCache.set(id, next)
  return next
}

export function preloadPlugin(id: string) {
  if (!(id in pluginLoaders)) return
  void loadPlugin(id as keyof typeof pluginLoaders)
}

export async function getPlugin(id: string) {
  const plugin = pluginsById[id]
  if (!plugin) return null
  return plugin.load()
}

export async function getAllCommands(): Promise<PluginCommand[]> {
  const shellCommands: PluginCommand[] = plugins.map((plugin) => ({
    id: `switch:${plugin.manifest.id}`,
    title: `Switch to ${plugin.manifest.title}`,
    run: async () => {
      useShellStore.setState({ activePluginId: plugin.manifest.id })
    }
  }))
  const loadedPlugins = await Promise.all(plugins.map((plugin) => plugin.load()))
  const pluginCommands = loadedPlugins.flatMap((plugin) => plugin.commands || [])
  return [...shellCommands, ...pluginCommands]
}
