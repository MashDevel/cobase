import { lazy } from 'react'
import { FolderOpen } from 'lucide-react'
import type { PluginModule } from '../../shell/types'
import { getActions } from './store'

const ExplorerSidebar = lazy(() => import('./ui/Sidebar'))
const ExplorerMain = lazy(() => import('./ui/Main'))

const ExplorerPlugin: PluginModule = {
  manifest: {
    id: 'explorer',
    title: 'Explorer',
    icon: <FolderOpen className="w-5 h-5" />,
  },
  Sidebar: ExplorerSidebar,
  Main: ExplorerMain,
  commands: [
    {
      id: 'explorer:open-folder',
      title: 'Explorer: Open Folder',
      run: async () => {
        const { selectFolder } = getActions()
        await selectFolder()
      },
    },
    {
      id: 'explorer:copy-tree',
      title: 'Explorer: Copy File Tree',
      run: async () => {
        const { copyFileTree } = getActions()
        await copyFileTree()
      },
    },
  ],
}

export default ExplorerPlugin
