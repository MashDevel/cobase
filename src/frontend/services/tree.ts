export interface FileLike {
  id: string;
  name: string;
  fullPath: string;
  tokens: number;
}

export interface TreeNode {
  name: string;
  children: TreeNode[];
  files: FileLike[];
  tokens: number;
}

function normalize(p: string) {
  return p.replace(/\\/g, '/');
}

export function buildTree(files: FileLike[], basePath: string): TreeNode {
  const root: TreeNode = { name: '', children: [], files: [], tokens: 0 };
  files.forEach((f) => {
    const base = normalize(basePath).replace(/\/$/, '');
    const rel = normalize(f.fullPath).replace(base + '/', '');
    const parts = rel.split('/').filter(Boolean);
    const dirParts = parts.slice(0, -1);
    let node = root;
    dirParts.forEach((part) => {
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, children: [], files: [], tokens: 0 };
        node.children.push(child);
      }
      node = child;
    });
    node.files.push(f);
  });
  const computeTokens = (node: TreeNode): number => {
    const fileTokens = node.files.reduce((sum, f) => sum + f.tokens, 0);
    const childrenTokens = node.children.reduce((sum, c) => sum + computeTokens(c), 0);
    node.tokens = fileTokens + childrenTokens;
    return node.tokens;
  };
  computeTokens(root);
  return root;
}

export function getAllFileIds(node: TreeNode): string[] {
  let ids = node.files.map((f) => f.id);
  node.children.forEach((c) => {
    ids = ids.concat(getAllFileIds(c));
  });
  return ids;
}

export function buildAsciiTree(files: FileLike[], basePath: string): string {
  const tree = {} as Record<string, any>;
  files.forEach((f) => {
    const base = normalize(basePath).replace(/\/$/, '');
    const rel = normalize(f.fullPath).replace(base + '/', '');
    rel.split('/')
      .filter(Boolean)
      .reduce((node: Record<string, any>, part: string) => (node[part] ??= {}), tree);
  });

  const lines: string[] = [];
  const walk = (node: Record<string, any>, prefix = '') => {
    Object.keys(node)
      .sort()
      .forEach((name, i, arr) => {
        const last = i === arr.length - 1;
        lines.push(`${prefix}${last ? '└─ ' : '├─ '}${name}`);
        walk(node[name], prefix + (last ? '   ' : '│  '));
      });
  };
  walk(tree);
  return lines.join('\n');
}
