import { FileDiff } from 'lucide-react'
import type { PluginModule } from '../../shell/types'
import PatchesMain from './ui/Main'

const PatchesPlugin: PluginModule = {
  manifest: {
    id: 'patches',
    title: 'Patches',
    icon: <FileDiff className="w-5 h-5" />,
  },
  Main: PatchesMain,
  commands: [
    { id: 'patches:apply', title: 'Patches: Apply Patch', run: async () => {} },
  ],
}

export default PatchesPlugin

