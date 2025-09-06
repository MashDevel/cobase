import { Search as SearchIcon } from 'lucide-react'
import type { PluginModule } from '../../shell/types'
import Main from './ui/Main'

const SearchPlugin: PluginModule = {
  manifest: { id: 'search', title: 'Search', icon: <SearchIcon className="w-5 h-5" /> },
  Main,
}

export default SearchPlugin
