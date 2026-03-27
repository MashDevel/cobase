import { lazy } from 'react'
import { FileCode2 } from 'lucide-react'
import type { PluginModule } from '../../shell/types'

const Sidebar = lazy(() => import('./ui/Sidebar'))
const Main = lazy(() => import('./ui/Main'))

const EditorPlugin: PluginModule = {
  manifest: {
    id: 'editor',
    title: 'Editor',
    icon: <FileCode2 className="w-5 h-5" />,
  },
  Sidebar,
  Main,
}

export default EditorPlugin
