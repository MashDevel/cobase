import { useState } from 'react'

export default function Main() {
  const [result, setResult] = useState<string | null>(null)
  const copyDiff = async () => {
    const res = await window.api.git.copyDiff()
    if (res.ok) setResult(`Copied diff (${res.data?.diffLength ?? 0} chars) to clipboard`)
    else setResult(res.error?.message ?? 'Failed to copy diff')
  }
  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Git</h2>
        <button onClick={copyDiff} className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-600">Copy Working Tree Diff</button>
      </div>
      {result && <div className="text-sm text-neutral-600 dark:text-neutral-300">{result}</div>}
    </div>
  )
}
