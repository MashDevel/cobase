import { useState } from 'react';
import PatchModal from './PatchModal';
import useStore from '../store';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const [showModal, setShowModal] = useState(false);
  const { folderPath, setFolderPath } = useStore();

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) setFolderPath(path);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-neutral-800 drag-region">
      <div className="flex items-center">
        <span
          onClick={handleSelectFolder}
          className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm font-mono text-neutral-800 dark:text-neutral-100 cursor-pointer hover:underline no-drag"
        >
          {folderPath?.split('/').filter(Boolean).pop() ?? 'Open Folder'}
        </span>
      </div>

      <div className="flex items-center space-x-2 no-drag">
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600"
        >
          Apply Patch
        </button>
        <ThemeToggle />
      </div>
      {showModal && <PatchModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
