export type ThemeColors = {
  background: string
  foreground: string
  gutterBackground: string
  gutterForeground: string
  gutterActiveForeground: string
  border: string
  lineHighlight: string
  selection: string
  caret: string
  token: {
    plain: string
    comment: string
    keyword: string
    string: string
    number: string
    punctuation: string
    tag: string
    attr: string
    heading: string
    emphasis: string
    function: string
    type: string
    constant: string
  }
}

export type HighlightSegment = {
  text: string
  color: string
}

export type HighlightLine = HighlightSegment[]

const darkTheme: ThemeColors = {
  background: '#1E1E1E',
  foreground: '#D4D4D4',
  gutterBackground: '#1E1E1E',
  gutterForeground: '#858585',
  gutterActiveForeground: '#C6C6C6',
  border: '#2D2D2D',
  lineHighlight: '#2A2D2E',
  selection: 'rgba(120, 190, 255, 0.28)',
  caret: '#AEAFAD',
  token: {
    plain: '#D4D4D4',
    comment: '#6A9955',
    keyword: '#C586C0',
    string: '#CE9178',
    number: '#B5CEA8',
    punctuation: '#D4D4D4',
    tag: '#569CD6',
    attr: '#9CDCFE',
    heading: '#569CD6',
    emphasis: '#C586C0',
    function: '#DCDCAA',
    type: '#4EC9B0',
    constant: '#4FC1FF',
  },
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  foreground: '#000000',
  gutterBackground: '#FFFFFF',
  gutterForeground: '#237893',
  gutterActiveForeground: '#0B216F',
  border: '#E5E5E5',
  lineHighlight: '#F7F7F7',
  selection: 'rgba(120, 190, 255, 0.32)',
  caret: '#000000',
  token: {
    plain: '#000000',
    comment: '#008000',
    keyword: '#AF00DB',
    string: '#A31515',
    number: '#098658',
    punctuation: '#000000',
    tag: '#800000',
    attr: '#E50000',
    heading: '#800000',
    emphasis: '#800080',
    function: '#795E26',
    type: '#267F99',
    constant: '#0070C1',
  },
}

const keywordSets: Record<string, Set<string>> = {
  javascript: new Set([
    'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import',
    'in', 'instanceof', 'let', 'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
    'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
  ]),
  typescript: new Set([
    'abstract', 'any', 'as', 'asserts', 'async', 'await', 'bigint', 'boolean', 'break', 'case', 'catch', 'class',
    'const', 'constructor', 'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export',
    'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'infer',
    'instanceof', 'interface', 'is', 'keyof', 'let', 'module', 'namespace', 'never', 'new', 'null', 'number', 'object',
    'of', 'override', 'private', 'protected', 'public', 'readonly', 'return', 'satisfies', 'set', 'static', 'string',
    'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'unique', 'unknown',
    'var', 'void', 'while',
  ]),
  json: new Set(['true', 'false', 'null']),
  css: new Set([
    '@media', '@supports', '@keyframes', '@layer', '@import', '@font-face', '@property', 'and', 'from', 'to', 'important',
  ]),
  html: new Set(['doctype']),
  markdown: new Set([]),
  python: new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'case', 'class', 'continue', 'def', 'del', 'elif', 'else',
    'except', 'false', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'match', 'none',
    'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'true', 'try', 'while', 'with', 'yield',
  ]),
  rust: new Set([
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn',
    'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self',
    'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  ]),
  go: new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'false', 'for', 'func',
    'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch',
    'true', 'type', 'var',
  ]),
  shell: new Set([
    'case', 'do', 'done', 'elif', 'else', 'esac', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'readonly',
    'return', 'select', 'then', 'until', 'while',
  ]),
  sql: new Set([
    'add', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'create', 'delete', 'desc', 'distinct', 'drop',
    'else', 'end', 'exists', 'from', 'group', 'having', 'in', 'insert', 'into', 'is', 'join', 'left', 'like', 'limit',
    'not', 'null', 'on', 'or', 'order', 'outer', 'primary', 'right', 'select', 'set', 'table', 'then', 'union', 'update',
    'values', 'when', 'where',
  ]),
  xml: new Set([]),
  yaml: new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off']),
  plaintext: new Set([]),
  ini: new Set([]),
  c: new Set([
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float',
    'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static',
    'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
  ]),
  cpp: new Set([
    'alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue',
    'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for',
    'friend', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private',
    'protected', 'public', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this',
    'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while',
  ]),
}

const typeWords = new Set([
  'string', 'number', 'boolean', 'object', 'any', 'unknown', 'never', 'void', 'null', 'undefined', 'int', 'float', 'double',
  'char', 'bool', 'usize', 'isize', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'f32', 'f64', 'str', 'map',
  'Vec', 'Result', 'Option', 'Self',
])

const constantWords = new Set(['true', 'false', 'null', 'undefined', 'None', 'none', 'NULL'])

const isWordStart = (char: string) => /[A-Za-z_@$#]/.test(char)
const isWord = (char: string) => /[A-Za-z0-9_@$#-]/.test(char)
const isDigit = (char: string) => /[0-9]/.test(char)

const push = (lines: HighlightLine[], value: string, color: string) => {
  if (!value) return
  const parts = value.split('\n')
  parts.forEach((part, index) => {
    if (part) {
      const line = lines[lines.length - 1]
      const previous = line[line.length - 1]
      if (previous && previous.color === color) previous.text += part
      else line.push({ text: part, color })
    }
    if (index < parts.length - 1) lines.push([])
  })
}

const readQuoted = (source: string, index: number) => {
  const quote = source[index]
  let cursor = index + 1
  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 2
      continue
    }
    cursor += 1
    if (char === quote) break
  }
  return cursor
}

const readNumber = (source: string, index: number) => {
  let cursor = index
  while (cursor < source.length && /[0-9a-fA-F_xobOB\.]/.test(source[cursor])) cursor += 1
  return cursor
}

const readJsxTag = (source: string, index: number) => {
  let cursor = index + 1
  if (source[cursor] === '/') cursor += 1
  if (!/[A-Za-z]/.test(source[cursor] || '')) return null
  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '"' || char === '\'') {
      cursor = readQuoted(source, cursor)
      continue
    }
    if (char === '{') {
      let depth = 1
      cursor += 1
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === '"' || source[cursor] === '\'' || source[cursor] === '`') {
          cursor = readQuoted(source, cursor)
          continue
        }
        if (source[cursor] === '{') depth += 1
        else if (source[cursor] === '}') depth -= 1
        cursor += 1
      }
      continue
    }
    cursor += 1
    if (char === '>') return cursor
  }
  return null
}

const isLikelyJsxStart = (source: string, index: number) => {
  const end = readJsxTag(source, index)
  if (end === null) return false
  let left = index - 1
  while (left >= 0 && /\s/.test(source[left])) left -= 1
  if (left < 0) return true
  const previous = source[left]
  if ('=({[:,!?\n'.includes(previous)) return true
  if (previous === '>') return true
  if (previous === '&' && source[left - 1] === '&') return true
  if (previous === '|' && source[left - 1] === '|') return true
  return false
}

const getFunctionName = (source: string, start: number) => {
  let cursor = start
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1
  if (!isWordStart(source[cursor] || '')) return ''
  let end = cursor + 1
  while (end < source.length && isWord(source[end])) end += 1
  let next = end
  while (next < source.length && /\s/.test(source[next])) next += 1
  return source[next] === '(' ? source.slice(cursor, end) : ''
}

const highlightMarkup = (value: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  let index = 0
  while (index < value.length) {
    if (value[index] === '<') {
      const close = value.indexOf('>', index + 1)
      if (close === -1) {
        push(lines, value.slice(index), theme.token.plain)
        break
      }
      const raw = value.slice(index, close + 1)
      const tagMatch = raw.match(/^<(\/?)([A-Za-z][\w:-]*)/)
      if (!tagMatch) {
        push(lines, raw, theme.token.punctuation)
        index = close + 1
        continue
      }
      push(lines, '<', theme.token.punctuation)
      if (tagMatch[1]) push(lines, '/', theme.token.punctuation)
      push(lines, tagMatch[2], theme.token.tag)
      let cursor = 1 + tagMatch[1].length + tagMatch[2].length
      while (cursor < raw.length - 1) {
        const char = raw[cursor]
        if (/\s/.test(char)) {
          let next = cursor + 1
          while (next < raw.length - 1 && /\s/.test(raw[next])) next += 1
          push(lines, raw.slice(cursor, next), theme.token.plain)
          cursor = next
          continue
        }
        if (char === '/' || char === '>') {
          push(lines, raw.slice(cursor, cursor + 1), theme.token.punctuation)
          cursor += 1
          continue
        }
        const nameStart = cursor
        while (cursor < raw.length - 1 && /[^\s=>/]/.test(raw[cursor])) cursor += 1
        push(lines, raw.slice(nameStart, cursor), theme.token.attr)
        if (raw[cursor] === '=') {
          push(lines, '=', theme.token.punctuation)
          cursor += 1
          if (raw[cursor] === '"' || raw[cursor] === '\'') {
            const end = readQuoted(raw, cursor)
            push(lines, raw.slice(cursor, end), theme.token.string)
            cursor = end
          }
        }
      }
      push(lines, '>', theme.token.punctuation)
      index = close + 1
      continue
    }
    const nextTag = value.indexOf('<', index)
    const end = nextTag === -1 ? value.length : nextTag
    push(lines, value.slice(index, end), theme.token.plain)
    index = end
  }
  return lines
}

const pushJsxTag = (lines: HighlightLine[], raw: string, theme: ThemeColors) => {
  let cursor = 0
  push(lines, '<', theme.token.punctuation)
  cursor += 1
  if (raw[cursor] === '/') {
    push(lines, '/', theme.token.punctuation)
    cursor += 1
  }
  const nameStart = cursor
  while (cursor < raw.length && /[A-Za-z0-9_.:-]/.test(raw[cursor])) cursor += 1
  const tagName = raw.slice(nameStart, cursor)
  push(lines, tagName, /^[a-z]/.test(tagName) ? theme.token.tag : theme.token.type)
  while (cursor < raw.length) {
    const char = raw[cursor]
    if (/\s/.test(char)) {
      let next = cursor + 1
      while (next < raw.length && /\s/.test(raw[next])) next += 1
      push(lines, raw.slice(cursor, next), theme.token.plain)
      cursor = next
      continue
    }
    if (char === '/' || char === '>' || char === '{' || char === '}' || char === '=') {
      push(lines, char, theme.token.punctuation)
      cursor += 1
      continue
    }
    if (char === '"' || char === '\'') {
      const quotedEnd = readQuoted(raw, cursor)
      push(lines, raw.slice(cursor, quotedEnd), theme.token.string)
      cursor = quotedEnd
      continue
    }
    const attrStart = cursor
    while (cursor < raw.length && /[^\s={}/>]/.test(raw[cursor])) cursor += 1
    push(lines, raw.slice(attrStart, cursor), theme.token.attr)
  }
}

const highlightJsx = (value: string, language: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  const keywords = keywordSets[language] || keywordSets.plaintext
  let index = 0
  while (index < value.length) {
    if (value[index] === '<' && isLikelyJsxStart(value, index)) {
      const end = readJsxTag(value, index)
      if (end === null) {
        push(lines, value.slice(index), theme.token.plain)
        break
      }
      pushJsxTag(lines, value.slice(index, end), theme)
      index = end
      continue
    }
    if (value.startsWith('//', index)) {
      let end = value.indexOf('\n', index)
      if (end === -1) end = value.length
      push(lines, value.slice(index, end), theme.token.comment)
      index = end
      continue
    }
    if (value.startsWith('/*', index)) {
      let end = value.indexOf('*/', index + 2)
      end = end === -1 ? value.length : end + 2
      push(lines, value.slice(index, end), theme.token.comment)
      index = end
      continue
    }
    if (value[index] === '"' || value[index] === '\'' || value[index] === '`') {
      const end = readQuoted(value, index)
      push(lines, value.slice(index, end), theme.token.string)
      index = end
      continue
    }
    if (isDigit(value[index])) {
      const end = readNumber(value, index)
      push(lines, value.slice(index, end), theme.token.number)
      index = end
      continue
    }
    if (isWordStart(value[index])) {
      let end = index + 1
      while (end < value.length && isWord(value[end])) end += 1
      const word = value.slice(index, end)
      if (keywords.has(word)) push(lines, word, theme.token.keyword)
      else if (constantWords.has(word)) push(lines, word, theme.token.constant)
      else if (typeWords.has(word)) push(lines, word, theme.token.type)
      else if (getFunctionName(value, end) === word) push(lines, word, theme.token.function)
      else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) push(lines, word, theme.token.type)
      else push(lines, word, theme.token.plain)
      index = end
      continue
    }
    if (/^[()[\]{}<>=:;.,!?%&|+\-*/]$/.test(value[index])) {
      push(lines, value[index], theme.token.punctuation)
      index += 1
      continue
    }
    push(lines, value[index], theme.token.plain)
    index += 1
  }
  return lines
}

const highlightMarkdown = (value: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  for (const line of value.split('\n')) {
    if (line.startsWith('```')) push(lines, line, theme.token.keyword)
    else if (/^\s{0,3}#{1,6}\s/.test(line)) push(lines, line, theme.token.heading)
    else if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) push(lines, line, theme.token.keyword)
    else {
      let index = 0
      while (index < line.length) {
        const codeStart = line.indexOf('`', index)
        const linkStart = line.indexOf('[', index)
        const emphStart = (() => {
          const star = line.indexOf('*', index)
          const underscore = line.indexOf('_', index)
          if (star === -1) return underscore
          if (underscore === -1) return star
          return Math.min(star, underscore)
        })()
        const candidates = [codeStart, linkStart, emphStart].filter((candidate) => candidate !== -1)
        const next = candidates.length ? Math.min(...candidates) : -1
        if (next === -1) {
          push(lines, line.slice(index), theme.token.plain)
          break
        }
        push(lines, line.slice(index, next), theme.token.plain)
        if (next === codeStart) {
          const end = line.indexOf('`', codeStart + 1)
          if (end === -1) {
            push(lines, line.slice(codeStart), theme.token.string)
            break
          }
          push(lines, line.slice(codeStart, end + 1), theme.token.string)
          index = end + 1
          continue
        }
        if (next === linkStart) {
          const end = line.indexOf(')', linkStart + 1)
          if (end === -1) {
            push(lines, line.slice(linkStart), theme.token.tag)
            break
          }
          push(lines, line.slice(linkStart, end + 1), theme.token.tag)
          index = end + 1
          continue
        }
        const marker = line[emphStart]
        const end = line.indexOf(marker, emphStart + 1)
        if (end === -1) {
          push(lines, line.slice(emphStart), theme.token.plain)
          break
        }
        push(lines, line.slice(emphStart, end + 1), theme.token.emphasis)
        index = end + 1
      }
    }
    push(lines, '\n', theme.token.plain)
  }
  return lines
}

const highlightYaml = (value: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  for (const line of value.split('\n')) {
    const commentIndex = line.indexOf('#')
    const content = commentIndex === -1 ? line : line.slice(0, commentIndex)
    const comment = commentIndex === -1 ? '' : line.slice(commentIndex)
    const keyMatch = content.match(/^(\s*-\s+)?([^:\n]+)(\s*:\s*)(.*)$/)
    if (keyMatch) {
      if (keyMatch[1]) push(lines, keyMatch[1], theme.token.punctuation)
      push(lines, keyMatch[2], theme.token.attr)
      push(lines, keyMatch[3], theme.token.punctuation)
      if (keyMatch[4]) push(lines, keyMatch[4], theme.token.string)
    } else {
      push(lines, content, theme.token.plain)
    }
    if (comment) push(lines, comment, theme.token.comment)
    push(lines, '\n', theme.token.plain)
  }
  return lines
}

const highlightIni = (value: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  for (const line of value.split('\n')) {
    if (/^\s*[;#]/.test(line)) push(lines, line, theme.token.comment)
    else if (/^\s*\[[^\]]+\]/.test(line)) push(lines, line, theme.token.keyword)
    else {
      const match = line.match(/^([^=]+)(=)(.*)$/)
      if (match) {
        push(lines, match[1], theme.token.attr)
        push(lines, match[2], theme.token.punctuation)
        push(lines, match[3], theme.token.string)
      } else push(lines, line, theme.token.plain)
    }
    push(lines, '\n', theme.token.plain)
  }
  return lines
}

const highlightJson = (value: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  let index = 0
  while (index < value.length) {
    if (value[index] === '"') {
      const end = readQuoted(value, index)
      const raw = value.slice(index, end)
      let cursor = end
      while (cursor < value.length && /\s/.test(value[cursor])) cursor += 1
      push(lines, raw, value[cursor] === ':' ? theme.token.attr : theme.token.string)
      index = end
      continue
    }
    if (isDigit(value[index]) || (value[index] === '-' && isDigit(value[index + 1] || ''))) {
      const end = readNumber(value, index + (value[index] === '-' ? 1 : 0))
      push(lines, value.slice(index, end), theme.token.number)
      index = end
      continue
    }
    if (isWordStart(value[index])) {
      let end = index + 1
      while (end < value.length && isWord(value[end])) end += 1
      const word = value.slice(index, end)
      if (keywordSets.json.has(word)) push(lines, word, theme.token.keyword)
      else if (constantWords.has(word)) push(lines, word, theme.token.constant)
      else push(lines, word, theme.token.plain)
      index = end
      continue
    }
    if (/^[()[\]{}:,]$/.test(value[index])) {
      push(lines, value[index], theme.token.punctuation)
      index += 1
      continue
    }
    push(lines, value[index], theme.token.plain)
    index += 1
  }
  return lines
}

const highlightCode = (value: string, language: string, theme: ThemeColors) => {
  const lines: HighlightLine[] = [[]]
  const keywords = keywordSets[language] || keywordSets.plaintext
  const lineComment = language === 'python' ? '#' : language === 'sql' ? '--' : language === 'css' ? null : '//'
  let index = 0
  while (index < value.length) {
    if (lineComment && value.startsWith(lineComment, index)) {
      let end = value.indexOf('\n', index)
      if (end === -1) end = value.length
      push(lines, value.slice(index, end), theme.token.comment)
      index = end
      continue
    }
    if (value.startsWith('/*', index)) {
      let end = value.indexOf('*/', index + 2)
      end = end === -1 ? value.length : end + 2
      push(lines, value.slice(index, end), theme.token.comment)
      index = end
      continue
    }
    if (value[index] === '"' || value[index] === '\'' || value[index] === '`') {
      const end = readQuoted(value, index)
      push(lines, value.slice(index, end), theme.token.string)
      index = end
      continue
    }
    if (isDigit(value[index])) {
      const end = readNumber(value, index)
      push(lines, value.slice(index, end), theme.token.number)
      index = end
      continue
    }
    if (isWordStart(value[index])) {
      let end = index + 1
      while (end < value.length && isWord(value[end])) end += 1
      const word = value.slice(index, end)
      const normalized = language === 'sql' ? word.toLowerCase() : word
      const nextFunction = getFunctionName(value, end)
      if (keywords.has(normalized)) push(lines, word, theme.token.keyword)
      else if (constantWords.has(word) || constantWords.has(normalized)) push(lines, word, theme.token.constant)
      else if (typeWords.has(word)) push(lines, word, theme.token.type)
      else if (nextFunction === word) push(lines, word, theme.token.function)
      else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) push(lines, word, theme.token.type)
      else push(lines, word, theme.token.plain)
      index = end
      continue
    }
    if (/^[()[\]{}<>=:;.,!?%&|+\-*/]$/.test(value[index])) {
      push(lines, value[index], theme.token.punctuation)
      index += 1
      continue
    }
    push(lines, value[index], theme.token.plain)
    index += 1
  }
  return lines
}

export const getEditorTheme = (isDark: boolean) => (isDark ? darkTheme : lightTheme)

export const highlightValue = (value: string, language: string, isDark: boolean) => {
  const theme = getEditorTheme(isDark)
  if (language === 'html' || language === 'xml') return highlightMarkup(value, theme)
  if (language === 'javascript' || language === 'typescript') return highlightJsx(value, language, theme)
  if (language === 'json') return highlightJson(value, theme)
  if (language === 'markdown') return highlightMarkdown(value, theme)
  if (language === 'yaml') return highlightYaml(value, theme)
  if (language === 'ini') return highlightIni(value, theme)
  return highlightCode(value, language, theme)
}
