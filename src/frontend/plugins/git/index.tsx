import { lazy } from 'react'
import { GitBranch } from 'lucide-react'
import type { PluginModule } from '../../shell/types'

const GitMain = lazy(() => import('./ui/Main'))

const GitPlugin: PluginModule = {
  manifest: {
    id: 'git',
    title: 'Git',
    icon: <GitBranch className="w-5 h-5" />,
  },
  Main: GitMain,
  commands: [
    {
      id: 'git:copy-diff',
      title: 'Git: Copy Working Tree Diff',
      run: async () => {
        await window.api.git.copyDiff()
      },
    },
  ],
}

export default GitPlugin
