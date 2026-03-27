import type { ReactNode } from 'react'
import {
  Braces,
  FileCode2,
  FileJson2,
  FileText,
  FileType2,
  FileType,
  Globe,
  Hash,
  Image,
  Palette,
  ScrollText,
  Shell,
} from 'lucide-react'

type FileIconSpec = {
  icon: ReactNode
  className: string
}

const byExtension: Record<string, FileIconSpec> = {
  c: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-sky-600 dark:text-sky-400' },
  cc: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-sky-600 dark:text-sky-400' },
  cpp: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-sky-600 dark:text-sky-400' },
  css: { icon: <Palette className="h-4 w-4" />, className: 'text-cyan-600 dark:text-cyan-400' },
  go: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-cyan-600 dark:text-cyan-400' },
  h: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-sky-600 dark:text-sky-400' },
  html: { icon: <Globe className="h-4 w-4" />, className: 'text-orange-600 dark:text-orange-400' },
  java: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-red-600 dark:text-red-400' },
  js: { icon: <FileType className="h-4 w-4" />, className: 'text-amber-500 dark:text-amber-300' },
  json: { icon: <FileJson2 className="h-4 w-4" />, className: 'text-emerald-600 dark:text-emerald-400' },
  jsx: { icon: <AtomLike />, className: 'text-sky-500 dark:text-sky-300' },
  md: { icon: <ScrollText className="h-4 w-4" />, className: 'text-neutral-600 dark:text-neutral-300' },
  mts: { icon: <FileType2 className="h-4 w-4" />, className: 'text-blue-600 dark:text-blue-400' },
  png: { icon: <Image className="h-4 w-4" />, className: 'text-violet-600 dark:text-violet-400' },
  py: { icon: <FileCode2 className="h-4 w-4" />, className: 'text-yellow-600 dark:text-yellow-300' },
  rs: { icon: <Braces className="h-4 w-4" />, className: 'text-orange-700 dark:text-orange-400' },
  sh: { icon: <Shell className="h-4 w-4" />, className: 'text-lime-600 dark:text-lime-400' },
  sql: { icon: <Hash className="h-4 w-4" />, className: 'text-fuchsia-600 dark:text-fuchsia-400' },
  svg: { icon: <Image className="h-4 w-4" />, className: 'text-orange-600 dark:text-orange-400' },
  toml: { icon: <FileJson2 className="h-4 w-4" />, className: 'text-emerald-700 dark:text-emerald-400' },
  ts: { icon: <FileType2 className="h-4 w-4" />, className: 'text-blue-600 dark:text-blue-400' },
  tsx: { icon: <AtomLike />, className: 'text-sky-500 dark:text-sky-300' },
  txt: { icon: <FileText className="h-4 w-4" />, className: 'text-neutral-500 dark:text-neutral-400' },
  xml: { icon: <Braces className="h-4 w-4" />, className: 'text-orange-600 dark:text-orange-400' },
  yaml: { icon: <FileJson2 className="h-4 w-4" />, className: 'text-rose-600 dark:text-rose-400' },
  yml: { icon: <FileJson2 className="h-4 w-4" />, className: 'text-rose-600 dark:text-rose-400' },
}

function AtomLike() {
  return <Braces className="h-4 w-4" />
}

export function getFileIcon(path: string | null | undefined): FileIconSpec {
  const extension = path?.split('.').pop()?.toLowerCase()
  if (extension && byExtension[extension]) return byExtension[extension]
  return {
    icon: <FileCode2 className="h-4 w-4" />,
    className: 'text-neutral-500 dark:text-neutral-400',
  }
}
