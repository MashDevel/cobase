import type { ComponentType, LazyExoticComponent, ReactNode } from 'react'

export type PluginCommand = {
  id: string
  title: string
  run: () => void | Promise<void>
}

export type PluginManifest = {
  id: string
  title: string
  icon: ReactNode
}

export type PluginView = ComponentType | LazyExoticComponent<ComponentType>

export type PluginModule = {
  manifest: PluginManifest
  Sidebar?: PluginView
  Main: PluginView
  commands?: PluginCommand[]
}

export type PluginDescriptor = {
  manifest: PluginManifest
  load: () => Promise<PluginModule>
}
