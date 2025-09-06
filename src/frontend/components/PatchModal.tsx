import { useState } from 'react';
import { X as XIcon, Copy as CopyIcon } from 'lucide-react';
import { useNotify } from '../hooks/useNotify';
import Notify from './Notify';
import useStore from '../store';

interface PatchModalProps {
  onClose: () => void;
}

export default function PatchModal({ onClose }: PatchModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patchText, setPatchText] = useState('');
  const notify = useNotify();
  const applyPatch = useStore(s => s.applyPatch);
  const handleCopyError = async () => {
    if (errorMessage) {
      await navigator.clipboard.writeText(errorMessage);
      notify.notify('Error message copied');
    }
  };
  const handleApply = async () => {
    const result = await applyPatch(patchText);
    if (result?.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'Failed to apply patch');
    }
  };
  const clearError = () => {
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-800 w-full max-w-lg p-6 rounded-lg shadow-lg relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Apply Patch
          </h2>
          <button onClick={onClose}>
            <XIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>
        <textarea
          className="w-full h-64 p-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded resize-none focus:outline-none"
          placeholder="Paste patch here..."
          value={patchText}
          onChange={(e) => setPatchText(e.target.value)}
        />
               {errorMessage && (
          <div className="flex items-center justify-between mt-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm rounded p-2 border border-red-400">
            <div className="flex-1 overflow-auto pr-2">{errorMessage}</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyError}
                className="shrink-0 hover:text-red-800 dark:hover:text-red-100 transition-colors"
                aria-label="Copy error"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                onClick={clearError}
                className="shrink-0 hover:text-red-800 dark:hover:text-red-100 transition-colors"
                aria-label="Clear error"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Apply
          </button>
        </div>
      </div>
      {notify.message && <Notify message={notify.message} />}
    </div>
  );
}
