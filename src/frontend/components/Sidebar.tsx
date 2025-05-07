import useStore from '../store';
import Directory, { buildTree } from './Directory';
import FileItem from './FileItem';
import { Search, X } from 'lucide-react';

export default function Sidebar() {
  const {
    files,
    selected,
    search,
    folderPath,
    setSearch,
    setFolderPath,
    toggleSelected,
    selectAll,
    clearAll,
  } = useStore();

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );
  const tree = folderPath
    ? buildTree(filtered, folderPath)
    : null;

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) setFolderPath(path);
  };

  return (
    <aside className="w-80 border-r bg-white dark:bg-neutral-800 flex flex-col">
        <div className="p-4 border-b pt-10 drag-region">
        {!folderPath ? null : (
            <div className="relative no-drag">
            {/* search icon */}
            <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400" 
                size={16} 
            />

            <input
                type="text"
                placeholder="Search..."
                className="w-full px-10 py-1 border border-neutral-600 rounded text-sm focus:border-blue-500 bg-neutral-100 dark:bg-neutral-700 
                text-neutral-800 dark:text-neutral-100 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            {/* clear button */}
            {search && (
                <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 focus:outline-none"
                >
                <X className="text-neutral-500 dark:text-neutral-400" size={16} />
                </button>
            )}
            </div>
        )}
        </div>

      {folderPath && (
        <>
          <div className="flex space-x-2 p-4 border-b">
          <button
            onClick={selectAll}
            className="
                flex-1
                border border-neutral-300 dark:border-neutral-700
                bg-neutral-200 dark:bg-neutral-900
                text-neutral-800 dark:text-neutral-100
                py-1
                rounded
                text-sm
                transition-colors duration-150 ease-in-out
                hover:bg-neutral-300 dark:hover:bg-neutral-800
                hover:border-neutral-400 dark:hover:border-neutral-600
            "
            >
            Select All
            </button>

            <button
            onClick={clearAll}
            className="
                flex-1
                border border-neutral-300 dark:border-neutral-700
                bg-neutral-200 dark:bg-neutral-900
                text-neutral-800 dark:text-neutral-100
                py-1
                rounded
                text-sm
                transition-colors duration-150 ease-in-out
                hover:bg-neutral-300 dark:hover:bg-neutral-800
                hover:border-neutral-400 dark:hover:border-neutral-600
            "
            >
            Deselect All
            </button>
          </div>
          <nav className="overflow-auto flex-1 p-4">
            {tree && (tree.children.length || tree.files.length) ? (
              <>
                {tree.children.map(child => (
                  <Directory
                    key={child.name}
                    node={child}
                    selected={selected}
                    toggleSelected={toggleSelected}
                  />
                ))}
                {tree.files.map(f => (
                  <FileItem
                    key={f.id}
                    file={f}
                    selected={selected.has(f.id)}
                    toggleSelected={() => toggleSelected(f.id)}
                  />
                ))}
              </>
            ) : (
              <div className="text-neutral-400 dark:text-neutral-500">
                No files found.
              </div>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}
