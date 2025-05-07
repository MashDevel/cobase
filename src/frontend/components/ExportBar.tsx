import { useState } from 'react';
import useStore from '../store';
import { useNotify } from '../hooks/useNotify';
import Notify from './Notify';
import { Copy, X } from 'lucide-react';

export default function ExportBar() {
  const { files, selected } = useStore();
  const selectedFiles = files.filter(f => selected.has(f.id));
  const notify = useNotify();
  const [includeTree, setIncludeTree] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [promptType, setPromptType] = useState('Blank');

  const handleCopy = () => {
    const paths = selectedFiles.map(f => `${f.path}/${f.name}`);
    window.electronAPI.copySelectedFiles(paths, includeTree, promptType, instructions)
      .then(success => {
        if (!success) {
          console.error('Failed to copy files');
        } else {
          notify.notify(
            `✅ Copied ${selectedFiles.length} files` +
              (includeTree ? ' with file tree' : '') +
              ` as ${promptType.toLowerCase()} prompt` +
              (instructions.trim() ? ' with instructions' : '')
          );
        }
      });
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-t border-neutral-200 dark:border-neutral-700">
      <div className="relative">
        <textarea
          className="w-full border border-neutral-500 p-2 rounded text-sm bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 resize-none outline-none focus:border-blue-500 pr-10"
          rows={3}
          placeholder="Enter Prompt..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        {instructions && (
          <button
            onClick={() => setInstructions('')}
            className="absolute right-3 top-2 text-neutral-500 dark:text-neutral-300"
            aria-label="Clear instructions"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={includeTree}
              onChange={e => setIncludeTree(e.target.checked)}
            />
            Include File Tree
          </label>
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <span>Prompt Template:</span>
            <select
              value={promptType}
              onChange={e => setPromptType(e.target.value)}
              className="border border-neutral-500 p-1 rounded text-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 outline-none"
            >
              <option>Blank</option>
              <option>Question</option>
              <option>Patch</option>
            </select>
          </label>
        </div>
        <button
          onClick={handleCopy}
          disabled={selectedFiles.length === 0}
          className={`${
            selectedFiles.length === 0
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white font-medium py-2 px-6 rounded flex items-center gap-2`}
        >
          <Copy className="h-5 w-5" />
          Copy ({selectedFiles.length} files)
        </button>
      </div>
      {notify.message && <Notify message={notify.message} />}
    </div>
  );
}
