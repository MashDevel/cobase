import type { ReactNode } from 'react'

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

export type PluginModule = {
  manifest: PluginManifest
  Sidebar?: () => JSX.Element
  Main: () => JSX.Element
  commands?: PluginCommand[]
}

