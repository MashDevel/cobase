import Grid from './parts/Grid'
import ExportBar from './parts/ExportBar'
import { useEffect } from 'react'
import useStore from '../store'

export default function Main() {
  useEffect(() => {
    useStore.getState().initFromLastFolder()
  }, [])
  const folderPath = useStore(s => s.folderPath)
  const selectFolder = useStore(s => s.selectFolder)
  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {!folderPath ? (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={selectFolder} className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded">Open Folder</button>
        </div>
      ) : (
        <>
          <Grid />
          <ExportBar />
        </>
      )}
    </div>
  )
}
