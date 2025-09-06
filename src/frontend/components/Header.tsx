import { useState } from 'react';
import PatchModal from './PatchModal';
import { useNotify } from '../hooks/useNotify';
import Notify from './Notify';
import useStore from '../store';
import ThemeToggle from './ThemeToggle';
import { Copy } from 'lucide-react';

export default function Header() {
  const [showModal, setShowModal] = useState(false);

  const folderPath = useStore(s => s.folderPath);
  const files = useStore(s => s.files);
  const selectFolder = useStore(s => s.selectFolder);
  const copyGitDiff = useStore(s => s.copyGitDiff);
  const copyFileTree = useStore(s => s.copyFileTree);
  const notify = useNotify();

  const handleSelectFolder = async () => {
    await selectFolder();
  };

  const handleCopyDiff = async () => {
    const result = await copyGitDiff();
    if (result?.success) {
      notify.notify('✅ Git diff copied to clipboard');
    } else {
      notify.notify(`❌ ${result?.error ?? 'Failed to copy git diff'}`);
    }
  };

  // Copy an ASCII file-tree of the current project to the clipboard
  const handleCopyTree = async () => {
    const result = await copyFileTree();
    if (result.success) {
      notify.notify('✅ File tree copied');
    } else {
      notify.notify(`❌ ${result.error ?? 'Clipboard write failed'}`);
    }
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
        <button
          onClick={handleCopyDiff}
          className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600 flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Diff
        </button>
        <button
          onClick={handleCopyTree}
          className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600 flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          File Tree
        </button>
        <ThemeToggle />
      </div>
      {showModal && <PatchModal onClose={() => setShowModal(false)} />}
      {notify.message && <Notify message={notify.message} />}
    </div>
  );
}
