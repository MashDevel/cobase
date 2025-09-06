import { Terminal as TerminalIcon } from 'lucide-react'
import type { PluginModule } from '../../shell/types'
import Main from './ui/Main'

const TerminalPlugin: PluginModule = {
  manifest: { id: 'terminal', title: 'Terminal', icon: <TerminalIcon className="w-5 h-5" /> },
  Main,
}

export default TerminalPlugin

