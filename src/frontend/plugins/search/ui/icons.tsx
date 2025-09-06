import { Search as SearchIcon } from 'lucide-react'

export function Search(props: { className?: string }) {
  return <SearchIcon className={props.className || 'w-4 h-4'} />
}

export function Regex() {
  return <span className="font-mono text-xs">.*</span>
}

export function CaseSensitive() {
  return <span className="font-mono text-xs">Aa</span>
}

export function WholeWord() {
  return <span className="font-mono text-xs">W</span>
}

