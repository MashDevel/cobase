export interface FileLike {
  id: string
  name: string
  fullPath: string
  tokens: number
  lines: number
}

export interface TreeNode {
  name: string
  children: TreeNode[]
  files: FileLike[]
  tokens: number
  lines: number
}

export function buildTree(files: FileLike[], basePath: string): TreeNode {
  const root: TreeNode = { name: '', children: [], files: [], tokens: 0, lines: 0 }
  const dirMap = new Map<string, TreeNode>()
  dirMap.set('', root)
  for (const file of files) {
    const rel = file.fullPath.slice(basePath.length + 1)
    const parts = rel.split('/').filter(Boolean)
    let currentPath = ''
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]
      currentPath = currentPath ? currentPath + '/' + dir : dir
      let dirNode = dirMap.get(currentPath)
      if (!dirNode) {
        dirNode = { name: dir, children: [], files: [], tokens: 0, lines: 0 }
        dirMap.set(currentPath, dirNode)
        node.children.push(dirNode)
      }
      node = dirNode
    }
    node.files.push(file)
  }
  const computeTokens = (node: TreeNode): number => {
    node.tokens = node.files.reduce((acc, f) => acc + f.tokens, 0) + node.children.reduce((acc, c) => acc + computeTokens(c), 0)
    return node.tokens
  }
  const computeLines = (node: TreeNode): number => {
    node.lines = node.files.reduce((acc, f) => acc + f.lines, 0) + node.children.reduce((acc, c) => acc + computeLines(c), 0)
    return node.lines
  }
  computeTokens(root)
  computeLines(root)
  return root
}

export function getAllFileIds(node: TreeNode): string[] {
  return [
    ...node.files.map((f) => f.id),
    ...node.children.flatMap((child) => getAllFileIds(child)),
  ]
}

export function buildAsciiTree(files: FileLike[], basePath: string): string {
  const tree = buildTree(files, basePath)
  const lines: string[] = []
  const walk = (node: TreeNode, prefix: string) => {
    const entries = [
      ...node.children.map(c => ({ type: 'dir' as const, name: c.name, node: c })),
      ...node.files.map(f => ({ type: 'file' as const, name: f.name, file: f })),
    ]
    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1
      const linePrefix = prefix + (isLast ? '└─ ' : '├─ ')
      if (entry.type === 'dir') {
        lines.push(linePrefix + entry.name)
        const nextPrefix = prefix + (isLast ? '   ' : '│  ')
        walk(entry.node, nextPrefix)
      } else {
        lines.push(linePrefix + entry.name)
      }
    })
  }
  walk(tree, '')
  return lines.join('\n')
}

