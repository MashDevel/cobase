import { Search as SearchIcon } from 'lucide-react'
import type { PluginModule } from '../../shell/types'

function Main() {
  return (
    <div className="p-4 text-neutral-600 dark:text-neutral-300">Search coming soon</div>
  )
}

const SearchPlugin: PluginModule = {
  manifest: { id: 'search', title: 'Search', icon: <SearchIcon className="w-5 h-5" /> },
  Main,
}

export default SearchPlugin

