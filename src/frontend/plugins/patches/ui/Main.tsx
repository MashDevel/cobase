import { useState } from 'react'
import { X as XIcon, Copy as CopyIcon } from 'lucide-react'
import { useNotify } from '../../../hooks/useNotify'
import Notify from '../../../components/Notify'

export default function Main() {
  const [patchText, setPatchText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const notify = useNotify()

  const handleApply = async () => {
    const result = await window.api.patch.apply(patchText)
    if (result.ok) {
      setPatchText('')
      setErrorMessage(null)
      notify.notify('Patch applied')
    } else {
      setErrorMessage(result.error?.message || 'Failed to apply patch')
    }
  }

  const handleCopyError = async () => {
    if (errorMessage) {
      await navigator.clipboard.writeText(errorMessage)
      notify.notify('Error message copied')
    }
  }

  const clearError = () => setErrorMessage(null)

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Patches</h2>
        <div className="flex gap-2">
          <button onClick={() => setPatchText('')} className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600">Clear</button>
          <button onClick={handleApply} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Apply</button>
        </div>
      </div>
      <textarea
        className="w-full h-96 p-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded resize-none focus:outline-none"
        placeholder="Paste patch here..."
        value={patchText}
        onChange={(e) => setPatchText(e.target.value)}
      />
      {errorMessage && (
        <div className="flex items-center justify-between mt-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm rounded p-2 border border-red-400">
          <div className="flex-1 overflow-auto pr-2">{errorMessage}</div>
          <div className="flex items-center space-x-2">
            <button onClick={handleCopyError} className="shrink-0 hover:text-red-800 dark:hover:text-red-100 transition-colors" aria-label="Copy error">
              <CopyIcon className="h-4 w-4" />
            </button>
            <button onClick={clearError} className="shrink-0 hover:text-red-800 dark:hover:text-red-100 transition-colors" aria-label="Clear error">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {notify.message && <Notify message={notify.message} />}
    </div>
  )
}
