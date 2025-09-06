import { FileIcon } from 'lucide-react'
import type { FileEntry as File } from '../../store'
import TreeRow from './TreeRow'

type Props = { file: File; selected: boolean; toggleSelected: () => void; indent?: number }

export default function FileItem({ file, selected, toggleSelected, indent = 0 }: Props) {
  return (
    <TreeRow
      indent={indent}
      checked={selected}
      onCheck={toggleSelected}
      onClick={toggleSelected}
      left={<FileIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-300 mr-1" />}
      name={file.name}
      meta={`~${file.tokens}T ∣ ~${file.lines}L`}
    />
  )
}
