import { useState } from 'react'
import PatchModal from './PatchModal'

export default function Main() {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Patches</h2>
        <button onClick={() => setOpen(true)} className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600">Apply Patch</button>
      </div>
      {open && <PatchModal onClose={() => setOpen(false)} />}
    </div>
  )
}

