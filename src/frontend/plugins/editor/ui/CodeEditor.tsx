import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getEditorTheme, highlightValue, type HighlightLine } from './highlight'

type CodeEditorProps = {
  path: string
  language: string
  value: string
  savedValue: string
  onChange: (value: string) => void
}

type FoldRange = {
  startLine: number
  endLine: number
}

type DisplaySegment = {
  displayStart: number
  displayEnd: number
  sourceStart: number
  sourceEnd: number
  editable: boolean
}

type SourceMapping = {
  sourceStart: number
  sourceEnd: number
  displayStart: number
  displayEnd: number
  editable: boolean
}

type DisplayModel = {
  text: string
  lineNumbers: number[]
  lineStarts: number[]
  displaySegments: DisplaySegment[]
  sourceMappings: SourceMapping[]
  sourceLength: number
}

type MinimapSegment = {
  key: string
  text: string
  color: string
  x: number
}

type CachedEditorModel = {
  value: string
  collapsedKey: string
  sourceLineStarts: number[]
  isLargeFile: boolean
  folds: FoldRange[]
  displayModel: DisplayModel
}

type EditorViewState = {
  selectionStart: number
  selectionEnd: number
  collapsedStarts: number[]
  scrollTop: number
  scrollLeft: number
}

type ViewportWindow = {
  startLine: number
  endLine: number
}

type TextWindow = {
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
  text: string
}

const tab = '  '
const lineHeight = 24
const paddingX = 16
const paddingY = 16
const minimapWidth = 108
const minimapInset = 12
const minimapPadding = 6
const minimapMaxChars = 120000
const minimapMaxLines = 2500
const largeFileMaxChars = 100000
const largeFileMaxLines = 2000
const viewportOverscan = 8
const textareaOverscan = 80
const textareaEdgeBuffer = 24
const editorModelCache = new Map<string, CachedEditorModel>()
const editorViewStateCache = new Map<string, EditorViewState>()

const getEditorViewState = (path: string): EditorViewState => editorViewStateCache.get(path) || {
  selectionStart: 0,
  selectionEnd: 0,
  collapsedStarts: [],
  scrollTop: 0,
  scrollLeft: 0,
}

const getLineStarts = (value: string) => {
  const starts = [0]
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\n') starts.push(index + 1)
  }
  return starts
}

const getLineIndent = (value: string, selectionStart: number) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  let index = lineStart
  while (index < value.length && (value[index] === ' ' || value[index] === '\t')) index += 1
  return value.slice(lineStart, index)
}

const getLineRange = (value: string, start: number, end: number) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  let lineEnd = value.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = value.length
  return { lineStart, lineEnd }
}

const getSelectedLineBounds = (value: string, start: number, end: number) => {
  const firstLineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  let lastLineEnd = value.indexOf('\n', end)
  if (lastLineEnd === -1) lastLineEnd = value.length
  return { start: firstLineStart, end: lastLineEnd }
}

const findLineIndex = (lineStarts: number[], offset: number) => {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lineStarts[mid] <= offset) low = mid + 1
    else high = mid - 1
  }
  return Math.max(0, high)
}

const countIndent = (value: string) => {
  let count = 0
  for (const char of value) {
    if (char === ' ') count += 1
    else if (char === '\t') count += 2
    else break
  }
  return count
}

const analyzeFolds = (value: string) => {
  const lines = value.split('\n')
  const folds: FoldRange[] = []
  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index]
    const trimmed = current.trim()
    if (!trimmed) continue
    let next = index + 1
    while (next < lines.length && !lines[next].trim()) next += 1
    if (next >= lines.length) continue
    const currentIndent = countIndent(current)
    const nextIndent = countIndent(lines[next])
    if (nextIndent <= currentIndent) continue
    let end = next
    for (let cursor = next + 1; cursor < lines.length; cursor += 1) {
      if (!lines[cursor].trim()) {
        end = cursor
        continue
      }
      if (countIndent(lines[cursor]) <= currentIndent) break
      end = cursor
    }
    if (end > index) folds.push({ startLine: index + 1, endLine: end + 1 })
  }
  return folds
}

const buildDisplayModel = (value: string, collapsedStarts: Set<number>, folds: FoldRange[]): DisplayModel => {
  const sourceLineStarts = getLineStarts(value)
  const sourceLineCount = sourceLineStarts.length
  const foldsByStart = new Map(folds.map((fold) => [fold.startLine, fold]))
  const chunks: string[] = []
  const displaySegments: DisplaySegment[] = []
  const sourceMappings: SourceMapping[] = []
  const lineNumbers: number[] = []
  let displayOffset = 0

  const appendSource = (chunk: string, sourceStart: number) => {
    if (!chunk) return
    const length = chunk.length
    chunks.push(chunk)
    displaySegments.push({
      displayStart: displayOffset,
      displayEnd: displayOffset + length,
      sourceStart,
      sourceEnd: sourceStart + length,
      editable: true,
    })
    sourceMappings.push({
      sourceStart,
      sourceEnd: sourceStart + length,
      displayStart: displayOffset,
      displayEnd: displayOffset + length,
      editable: true,
    })
    displayOffset += length
  }

  const appendVirtual = (chunk: string, sourceOffset: number) => {
    if (!chunk) return
    const length = chunk.length
    chunks.push(chunk)
    displaySegments.push({
      displayStart: displayOffset,
      displayEnd: displayOffset + length,
      sourceStart: sourceOffset,
      sourceEnd: sourceOffset,
      editable: false,
    })
    displayOffset += length
  }

  const appendCollapsedRange = (sourceStart: number, sourceEnd: number, displayStart: number) => {
    if (sourceStart >= sourceEnd) return
    sourceMappings.push({
      sourceStart,
      sourceEnd,
      displayStart,
      displayEnd: displayStart,
      editable: false,
    })
  }

  let line = 1
  while (line <= sourceLineCount) {
    const fold = foldsByStart.get(line)
    if (fold && collapsedStarts.has(line)) {
      lineNumbers.push(line)
      const lineStart = sourceLineStarts[line - 1]
      const lineEnd = line < sourceLineCount ? sourceLineStarts[line] - 1 : value.length
      const lineText = value.slice(lineStart, lineEnd)
      appendSource(lineText, lineStart)
      const hiddenStart = line < sourceLineCount ? sourceLineStarts[line] : value.length
      const hiddenEndExclusive = fold.endLine < sourceLineCount ? sourceLineStarts[fold.endLine] : value.length
      appendCollapsedRange(hiddenStart, hiddenEndExclusive, displayOffset)
      appendVirtual(' …', hiddenStart)
      if (hiddenEndExclusive < value.length) appendVirtual('\n', hiddenEndExclusive)
      line = fold.endLine + 1
      continue
    }
    lineNumbers.push(line)
    const start = sourceLineStarts[line - 1]
    const end = line < sourceLineCount ? sourceLineStarts[line] : value.length
    appendSource(value.slice(start, end), start)
    line += 1
  }

  const text = chunks.join('')

  return {
    text,
    lineNumbers,
    lineStarts: getLineStarts(text),
    displaySegments,
    sourceMappings,
    sourceLength: value.length,
  }
}

const getDiff = (previousValue: string, nextValue: string) => {
  let start = 0
  while (start < previousValue.length && start < nextValue.length && previousValue[start] === nextValue[start]) start += 1
  let previousEnd = previousValue.length
  let nextEnd = nextValue.length
  while (previousEnd > start && nextEnd > start && previousValue[previousEnd - 1] === nextValue[nextEnd - 1]) {
    previousEnd -= 1
    nextEnd -= 1
  }
  return { start, previousEnd, nextEnd }
}

const setSelection = (textarea: HTMLTextAreaElement, start: number, end = start) => {
  requestAnimationFrame(() => {
    textarea.setSelectionRange(start, end)
  })
}

const normalizeMinimapText = (value: string) => value.replace(/\t/g, tab).replace(/ /g, '\u00A0')

const buildMinimapLines = (highlightedLines: HighlightLine[], fallbackColor: string) => {
  const lines: MinimapSegment[][] = []
  for (let lineIndex = 0; lineIndex < highlightedLines.length; lineIndex += 1) {
    const highlightedLine = highlightedLines[lineIndex]
    if (highlightedLine.length === 0) {
      lines.push([])
      continue
    }
    let column = 0
    const nextLine: MinimapSegment[] = []
    for (let segmentIndex = 0; segmentIndex < highlightedLine.length; segmentIndex += 1) {
      const segment = highlightedLine[segmentIndex]
      const normalized = normalizeMinimapText(segment.text)
      const trimmed = normalized.trimEnd()
      if (trimmed) {
        nextLine.push({
          key: `${lineIndex}-${segmentIndex}`,
          text: trimmed,
          color: segment.color || fallbackColor,
          x: column,
        })
      }
      column += normalized.length
    }
    lines.push(nextLine)
  }
  return lines
}

const getCollapsedKey = (collapsedStarts: Set<number>) => Array.from(collapsedStarts).join(',')

const getEditorModel = (path: string, value: string, collapsedStarts: Set<number>) => {
  const collapsedKey = getCollapsedKey(collapsedStarts)
  const cached = editorModelCache.get(path)
  if (cached && cached.value === value && cached.collapsedKey === collapsedKey) return cached
  const sourceLineStarts = getLineStarts(value)
  const isLargeFile = value.length > largeFileMaxChars || sourceLineStarts.length > largeFileMaxLines
  const folds = isLargeFile ? [] : analyzeFolds(value)
  const displayModel = buildDisplayModel(value, collapsedStarts, folds)
  const next = { value, collapsedKey, sourceLineStarts, isLargeFile, folds, displayModel }
  editorModelCache.set(path, next)
  return next
}

const getViewportWindow = (scrollTop: number, viewportHeight: number, lineCount: number): ViewportWindow => {
  if (lineCount === 0) return { startLine: 0, endLine: 0 }
  const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - viewportOverscan)
  const endLine = Math.min(lineCount, Math.ceil((scrollTop + viewportHeight) / lineHeight) + viewportOverscan)
  return {
    startLine,
    endLine: Math.max(startLine + 1, endLine),
  }
}

const getLineSliceBounds = (lineStarts: number[], textLength: number, startLine: number, endLine: number) => {
  const start = lineStarts[startLine] || 0
  const end = endLine < lineStarts.length ? Math.max(start, lineStarts[endLine] - 1) : textLength
  return { start, end }
}

const getTextWindow = (
  model: DisplayModel,
  viewport: ViewportWindow,
  selectionStart: number,
  selectionEnd: number,
): TextWindow => {
  const lineCount = model.lineStarts.length
  const selectionStartLine = findLineIndex(model.lineStarts, selectionStart)
  const selectionEndLine = findLineIndex(model.lineStarts, selectionEnd)
  const edgeStartLine = Math.max(0, selectionStartLine - textareaEdgeBuffer)
  const edgeEndLine = Math.min(lineCount, selectionEndLine + textareaEdgeBuffer + 1)
  const startLine = Math.max(0, Math.min(viewport.startLine, edgeStartLine) - textareaOverscan)
  const endLine = Math.min(lineCount, Math.max(viewport.endLine, edgeEndLine) + textareaOverscan)
  const bounds = getLineSliceBounds(model.lineStarts, model.text.length, startLine, endLine)
  return {
    startLine,
    endLine,
    startOffset: bounds.start,
    endOffset: bounds.end,
    text: model.text.slice(bounds.start, bounds.end),
  }
}

const sameTextWindow = (left: TextWindow, right: TextWindow) => (
  left.startLine === right.startLine &&
  left.endLine === right.endLine &&
  left.startOffset === right.startOffset &&
  left.endOffset === right.endOffset &&
  left.text === right.text
)

const findDisplaySegmentIndex = (segments: DisplaySegment[], offset: number) => {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const segment = segments[mid]
    if (offset < segment.displayStart) high = mid - 1
    else if (offset >= segment.displayEnd) low = mid + 1
    else return mid
  }
  return -1
}

const findSourceMappingIndex = (mappings: SourceMapping[], offset: number) => {
  let low = 0
  let high = mappings.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const mapping = mappings[mid]
    if (offset < mapping.sourceStart) high = mid - 1
    else if (offset >= mapping.sourceEnd) low = mid + 1
    else return mid
  }
  return Math.max(0, high)
}

const mapDisplayToSource = (model: DisplayModel, offset: number) => {
  const clamped = Math.max(0, Math.min(offset, model.text.length))
  if (clamped === model.text.length) return model.sourceLength
  const index = findDisplaySegmentIndex(model.displaySegments, clamped)
  if (index === -1) return 0
  const segment = model.displaySegments[index]
  if (!segment.editable) return segment.sourceStart
  return segment.sourceStart + (clamped - segment.displayStart)
}

const mapSourceToDisplay = (model: DisplayModel, offset: number) => {
  const clamped = Math.max(0, Math.min(offset, model.sourceLength))
  if (clamped === model.sourceLength) return model.text.length
  const index = findSourceMappingIndex(model.sourceMappings, clamped)
  const mapping = model.sourceMappings[index]
  if (!mapping) return 0
  if (!mapping.editable) return mapping.displayStart
  const cappedOffset = Math.min(clamped, mapping.sourceEnd)
  return mapping.displayStart + (cappedOffset - mapping.sourceStart)
}

const touchesVirtualText = (model: DisplayModel, start: number, end: number) => {
  const clampedStart = Math.max(0, Math.min(start, model.text.length))
  const clampedEnd = Math.max(0, Math.min(end, model.text.length))
  if (clampedStart === clampedEnd) {
    if (clampedStart === model.text.length) return false
    const index = findDisplaySegmentIndex(model.displaySegments, clampedStart)
    return index !== -1 && model.displaySegments[index].editable === false
  }
  let index = findDisplaySegmentIndex(model.displaySegments, clampedStart)
  if (index === -1) index = 0
  while (index < model.displaySegments.length) {
    const segment = model.displaySegments[index]
    if (segment.displayStart >= clampedEnd) break
    if (segment.displayEnd > clampedStart && segment.editable === false) return true
    index += 1
  }
  return false
}

const renderHighlightedLines = (lines: HighlightLine[], lineOffset: number, lineHeightValue: number) => (
  lines.map((segments, index) => (
    <div
      key={lineOffset + index}
      className="font-mono text-[13px] leading-6 whitespace-pre"
      style={{ height: lineHeightValue }}
    >
      {segments.map((segment, segmentIndex) => (
        <span key={`${lineOffset + index}-${segmentIndex}`} style={{ color: segment.color }}>
          {segment.text}
        </span>
      ))}
    </div>
  ))
)

export default function CodeEditor({ path, language, value, onChange }: CodeEditorProps) {
  const previousPathRef = useRef(path)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)
  const minimapRef = useRef<HTMLDivElement | null>(null)
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const minimapDraggingRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const selectionFrameRef = useRef<number | null>(null)
  const [editorViews, setEditorViews] = useState<Record<string, EditorViewState>>(() => ({
    [path]: getEditorViewState(path),
  }))
  const [scrollMetrics, setScrollMetrics] = useState({ viewportHeight: 1 })
  const [minimapSize, setMinimapSize] = useState({ width: minimapWidth - minimapPadding * 2, height: 0 })
  const [focused, setFocused] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [charWidth, setCharWidth] = useState(7.8)
  const [foldColumnHovered, setFoldColumnHovered] = useState(false)
  const viewState = editorViews[path] || getEditorViewState(path)
  const selection = {
    start: viewState.selectionStart,
    end: viewState.selectionEnd,
  }
  const collapsedStarts = useMemo(() => new Set(viewState.collapsedStarts), [viewState.collapsedStarts])
  const theme = useMemo(() => getEditorTheme(isDark), [isDark])
  const editorModel = useMemo(() => getEditorModel(path, value, collapsedStarts), [collapsedStarts, path, value])
  const sourceLineStarts = editorModel.sourceLineStarts
  const isLargeFile = editorModel.isLargeFile
  const folds = editorModel.folds
  const foldMap = useMemo(() => new Map(folds.map((fold) => [fold.startLine, fold])), [folds])
  const displayModel = editorModel.displayModel
  const lineCount = displayModel.lineNumbers.length
  const showMinimap = !isLargeFile && value.length <= minimapMaxChars && sourceLineStarts.length <= minimapMaxLines
  const viewport = useMemo(
    () => getViewportWindow(viewState.scrollTop, scrollMetrics.viewportHeight, lineCount),
    [lineCount, scrollMetrics.viewportHeight, viewState.scrollTop]
  )
  const visibleBounds = useMemo(
    () => getLineSliceBounds(displayModel.lineStarts, displayModel.text.length, viewport.startLine, viewport.endLine),
    [displayModel.lineStarts, displayModel.text.length, viewport.endLine, viewport.startLine]
  )
  const visibleText = useMemo(
    () => displayModel.text.slice(visibleBounds.start, visibleBounds.end),
    [displayModel.text, visibleBounds.end, visibleBounds.start]
  )
  const visibleHighlightedLines = useMemo(
    () => (isLargeFile ? [] : highlightValue(visibleText, language, isDark)),
    [isDark, isLargeFile, language, visibleText]
  )
  const minimapHighlightedLines = useMemo(
    () => (showMinimap ? highlightValue(displayModel.text, language, isDark) : []),
    [displayModel.text, isDark, language, showMinimap]
  )
  const minimapLines = useMemo(
    () => (showMinimap ? buildMinimapLines(minimapHighlightedLines, theme.foreground) : []),
    [minimapHighlightedLines, showMinimap, theme.foreground]
  )
  const gutterWidth = `${Math.max(4, String(sourceLineStarts.length).length + 2) + 2}ch`
  const activeSourceLine = findLineIndex(sourceLineStarts, selection.start) + 1
  const activeDisplayLine = Math.max(1, displayModel.lineNumbers.indexOf(activeSourceLine) + 1)
  const contentPaddingRight = showMinimap ? paddingX + minimapWidth + minimapInset * 2 : paddingX
  const documentHeight = lineCount * lineHeight + paddingY * 2
  const displaySelection = {
    start: mapSourceToDisplay(displayModel, selection.start),
    end: mapSourceToDisplay(displayModel, selection.end),
  }
  const [textareaWindow, setTextareaWindow] = useState<TextWindow>(() => getTextWindow(displayModel, viewport, displaySelection.start, displaySelection.end))
  const caretLine = findLineIndex(displayModel.lineStarts, displaySelection.start) + 1
  const caretColumn = displaySelection.start - displayModel.lineStarts[caretLine - 1]
  const lineHighlightTop = paddingY + (activeDisplayLine - 1) * lineHeight - viewState.scrollTop
  const maxScrollTop = Math.max(0, documentHeight - scrollMetrics.viewportHeight)
  const minimapInnerHeight = Math.max(0, minimapSize.height - minimapPadding * 2)
  const minimapScale = documentHeight > 0 ? Math.min(1, minimapInnerHeight / documentHeight) : 1
  const minimapContentHeight = Math.max(1, Math.round(documentHeight * minimapScale))
  const minimapContentWidth = Math.max(1, minimapSize.width)
  const minimapThumbHeight = maxScrollTop > 0
    ? Math.max(24, Math.round(scrollMetrics.viewportHeight * minimapScale))
    : minimapContentHeight
  const minimapThumbTop = minimapPadding + (maxScrollTop > 0 ? viewState.scrollTop * minimapScale : 0)
  const visibleTop = paddingY + viewport.startLine * lineHeight - viewState.scrollTop
  const textareaSelection = {
    start: Math.max(0, Math.min(textareaWindow.text.length, displaySelection.start - textareaWindow.startOffset)),
    end: Math.max(0, Math.min(textareaWindow.text.length, displaySelection.end - textareaWindow.startOffset)),
  }
  const textareaPaddingTop = paddingY + textareaWindow.startLine * lineHeight
  const textareaPaddingBottom = paddingY + Math.max(0, lineCount - textareaWindow.endLine) * lineHeight

  const updateViewState = (updater: (current: EditorViewState) => EditorViewState) => {
    setEditorViews((state) => {
      const current = state[path] || getEditorViewState(path)
      const next = updater(current)
      if (
        current.selectionStart === next.selectionStart &&
        current.selectionEnd === next.selectionEnd &&
        current.scrollTop === next.scrollTop &&
        current.scrollLeft === next.scrollLeft &&
        current.collapsedStarts.length === next.collapsedStarts.length &&
        current.collapsedStarts.every((line, index) => line === next.collapsedStarts[index])
      ) {
        return state
      }
      editorViewStateCache.set(path, next)
      return {
        ...state,
        [path]: next,
      }
    })
  }

  const syncScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller || scrollFrameRef.current !== null) return
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      const nextScroller = scrollerRef.current
      if (!nextScroller) return
      const nextScroll = {
        top: nextScroller.scrollTop,
        left: nextScroller.scrollLeft,
        viewportHeight: nextScroller.clientHeight,
      }
      setScrollMetrics((current) => (
        current.viewportHeight === nextScroll.viewportHeight
          ? current
          : {
              viewportHeight: nextScroll.viewportHeight,
            }
      ))
      updateViewState((current) => (
        current.scrollTop === nextScroll.top &&
        current.scrollLeft === nextScroll.left
          ? current
          : {
              ...current,
              scrollTop: nextScroll.top,
              scrollLeft: nextScroll.left,
            }
      ))
    })
  }

  const syncSelection = () => {
    const textarea = textareaRef.current
    if (!textarea || selectionFrameRef.current !== null) return
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = null
      const nextTextarea = textareaRef.current
      if (!nextTextarea) return
      const start = mapDisplayToSource(displayModel, textareaWindow.startOffset + nextTextarea.selectionStart)
      const end = mapDisplayToSource(displayModel, textareaWindow.startOffset + nextTextarea.selectionEnd)
      updateViewState((current) => (
        current.selectionStart === start && current.selectionEnd === end
          ? current
          : {
              ...current,
              selectionStart: start,
              selectionEnd: end,
            }
      ))
    })
  }

  useEffect(() => {
    const nextWindow = getTextWindow(displayModel, viewport, displaySelection.start, displaySelection.end)
    setTextareaWindow((current) => {
      const sourceChanged =
        current.endOffset > displayModel.text.length ||
        displayModel.text.slice(current.startOffset, current.endOffset) !== current.text
      const viewportOutsideBuffer =
        viewport.startLine < current.startLine + textareaEdgeBuffer ||
        viewport.endLine > current.endLine - textareaEdgeBuffer
      const selectionOutsideBuffer =
        displaySelection.start < current.startOffset ||
        displaySelection.end > current.endOffset
      if (!sourceChanged && !viewportOutsideBuffer && !selectionOutsideBuffer) return current
      return sameTextWindow(current, nextWindow) ? current : nextWindow
    })
  }, [displayModel, displaySelection.end, displaySelection.start, viewport])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (previousPathRef.current !== path) {
      scroller.scrollTop = viewState.scrollTop
      scroller.scrollLeft = viewState.scrollLeft
      previousPathRef.current = path
    }
    syncScroll()
  }, [path])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textareaSelection.start
    const end = textareaSelection.end
    if (textarea.selectionStart === start && textarea.selectionEnd === end) return
    setSelection(textarea, start, end)
  }, [path, textareaSelection.end, textareaSelection.start, textareaWindow.text])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const measure = measureRef.current
    if (!measure) return
    const width = measure.getBoundingClientRect().width
    if (width > 0) setCharWidth(width / 10)
  }, [])

  useEffect(() => {
    if (!showMinimap) return
    const minimap = minimapRef.current
    if (!minimap) return
    const update = () => {
      setMinimapSize({
        width: Math.max(1, minimap.clientWidth - minimapPadding * 2),
        height: minimap.clientHeight,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(minimap)
    return () => observer.disconnect()
  }, [showMinimap])

  useEffect(() => {
    if (!showMinimap) return
    const canvas = minimapCanvasRef.current
    if (!canvas) return
    const width = minimapContentWidth
    const height = minimapContentHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.scale(dpr, dpr)
    context.clearRect(0, 0, width, height)
    context.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
    context.fillRect(0, 0, width, height)
    const lineScale = minimapScale * lineHeight
    const maxColumns = 120
    const xScale = width / maxColumns
    for (let index = 0; index < minimapLines.length; index += 1) {
      const y = index * lineScale
      if (y > height) break
      if (displayModel.lineNumbers[index] === activeSourceLine) {
        context.fillStyle = theme.lineHighlight
        context.fillRect(0, y, width, Math.max(1, lineScale))
      }
      const segments = minimapLines[index]
      const blockHeight = Math.max(1, Math.min(3, lineScale * 0.7))
      const blockY = y + Math.max(0, (lineScale - blockHeight) / 2)
      for (const segment of segments) {
        const text = segment.text.replace(/\u00A0/g, ' ')
        const trimmed = text.trimEnd()
        if (!trimmed) continue
        const x = Math.min(width, segment.x * xScale)
        if (x >= width) break
        context.fillStyle = segment.color
        const blockWidth = Math.min(width - x, Math.max(xScale, trimmed.length * xScale))
        context.fillRect(x, blockY, blockWidth, blockHeight)
      }
    }
  }, [activeSourceLine, displayModel.lineNumbers, isDark, minimapContentHeight, minimapContentWidth, minimapLines, minimapScale, showMinimap, theme.lineHighlight])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      syncScroll()
    })
    return () => cancelAnimationFrame(frame)
  }, [lineCount, path])

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    if (selectionFrameRef.current !== null) cancelAnimationFrame(selectionFrameRef.current)
  }, [])

  const updateSource = (nextValue: string, nextSelectionStart: number, nextSelectionEnd = nextSelectionStart) => {
    onChange(nextValue)
    updateViewState((current) => ({
      ...current,
      selectionStart: nextSelectionStart,
      selectionEnd: nextSelectionEnd,
      collapsedStarts: [],
    }))
  }

  const handleDisplayChange = (nextDisplayValue: string) => {
    const diff = getDiff(textareaWindow.text, nextDisplayValue)
    const globalStart = textareaWindow.startOffset + diff.start
    const globalPreviousEnd = textareaWindow.startOffset + diff.previousEnd
    if (touchesVirtualText(displayModel, globalStart, globalPreviousEnd)) {
      const anchor = mapDisplayToSource(displayModel, globalStart)
      updateViewState((current) => ({
        ...current,
        selectionStart: anchor,
        selectionEnd: anchor,
        collapsedStarts: [],
      }))
      return
    }
    const sourceStart = mapDisplayToSource(displayModel, globalStart)
    const sourceEnd = mapDisplayToSource(displayModel, globalPreviousEnd)
    const insertedText = nextDisplayValue.slice(diff.start, diff.nextEnd)
    const nextSourceValue = `${value.slice(0, sourceStart)}${insertedText}${value.slice(sourceEnd)}`
    const nextCursor = sourceStart + insertedText.length
    updateSource(nextSourceValue, nextCursor)
  }

  const handleTab = (shiftKey: boolean) => {
    if (selection.start === selection.end) {
      const nextValue = `${value.slice(0, selection.start)}${tab}${value.slice(selection.end)}`
      updateSource(nextValue, selection.start + tab.length)
      return
    }
    const bounds = getSelectedLineBounds(value, selection.start, selection.end)
    const block = value.slice(bounds.start, bounds.end)
    const lines = block.split('\n')
    if (shiftKey) {
      let removedBeforeStart = 0
      let removedTotal = 0
      const nextLines = lines.map((lineValue, index) => {
        if (lineValue.startsWith(tab)) {
          removedTotal += tab.length
          if (index === 0) removedBeforeStart = tab.length
          return lineValue.slice(tab.length)
        }
        if (lineValue.startsWith('\t')) {
          removedTotal += 1
          if (index === 0) removedBeforeStart = 1
          return lineValue.slice(1)
        }
        return lineValue
      })
      const nextBlock = nextLines.join('\n')
      const nextValue = `${value.slice(0, bounds.start)}${nextBlock}${value.slice(bounds.end)}`
      updateSource(nextValue, Math.max(bounds.start, selection.start - removedBeforeStart), Math.max(bounds.start, selection.end - removedTotal))
      return
    }
    const nextBlock = lines.map((lineValue) => `${tab}${lineValue}`).join('\n')
    const nextValue = `${value.slice(0, bounds.start)}${nextBlock}${value.slice(bounds.end)}`
    updateSource(nextValue, selection.start + tab.length, selection.end + tab.length * lines.length)
  }

  const handleEnter = () => {
    const indent = getLineIndent(value, selection.start)
    const insertion = `\n${indent}`
    const nextValue = `${value.slice(0, selection.start)}${insertion}${value.slice(selection.end)}`
    updateSource(nextValue, selection.start + insertion.length)
  }

  const handleHome = () => {
    const { lineStart } = getLineRange(value, selection.start, selection.end)
    let contentStart = lineStart
    while (contentStart < value.length && (value[contentStart] === ' ' || value[contentStart] === '\t')) contentStart += 1
    const target = selection.start === contentStart ? lineStart : contentStart
    updateViewState((current) => ({
      ...current,
      selectionStart: target,
      selectionEnd: target,
    }))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      handleTab(event.shiftKey)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      handleEnter()
      return
    }
    if (event.key === 'Home' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      handleHome()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === '[') {
      event.preventDefault()
      updateViewState((current) => ({
        ...current,
        collapsedStarts: [],
      }))
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === ']') {
      event.preventDefault()
      updateViewState((current) => ({
        ...current,
        collapsedStarts: folds.map((fold) => fold.startLine),
      }))
    }
  }

  const toggleFold = (startLine: number) => {
    updateViewState((current) => {
      const next = new Set(current.collapsedStarts)
      if (next.has(startLine)) next.delete(startLine)
      else next.add(startLine)
      return {
        ...current,
        collapsedStarts: Array.from(next).sort((left, right) => left - right),
      }
    })
  }

  const scrollFromMinimap = (clientY: number) => {
    const scroller = scrollerRef.current
    const minimap = minimapRef.current
    if (!scroller || !minimap) return
    const rect = minimap.getBoundingClientRect()
    if (rect.height <= 0) return
    const y = Math.min(minimapContentHeight, Math.max(0, clientY - rect.top - minimapPadding))
    const nextTop = minimapScale > 0
      ? Math.min(maxScrollTop, Math.max(0, y / minimapScale - scroller.clientHeight / 2))
      : 0
    scroller.scrollTop = nextTop
    syncScroll()
  }

  const handleMinimapPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    minimapDraggingRef.current = true
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrollFromMinimap(event.clientY)
  }

  const handleMinimapPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!minimapDraggingRef.current) return
    scrollFromMinimap(event.clientY)
  }

  const handleMinimapPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    minimapDraggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const caretVisible = !isLargeFile && focused && displaySelection.start === displaySelection.end
  const caretTop = paddingY + (caretLine - 1) * lineHeight - viewState.scrollTop + 2
  const caretStyle: CSSProperties = {
    top: caretTop,
    left: paddingX + caretColumn * charWidth - viewState.scrollLeft,
    height: lineHeight - 4,
    backgroundColor: theme.caret,
    boxShadow: isDark ? '0 0 0 1px rgba(30,30,30,0.35)' : '0 0 0 1px rgba(255,255,255,0.35)',
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: theme.background, color: theme.foreground }}>
      <span ref={measureRef} className="absolute opacity-0 pointer-events-none font-mono text-[13px] leading-6">
        0000000000
      </span>
      <div className="flex-1 min-h-0 flex" style={{ backgroundColor: theme.background }}>
        <div
          className="shrink-0 overflow-hidden select-none relative"
          style={{ width: gutterWidth, backgroundColor: theme.gutterBackground, borderRight: `1px solid ${theme.border}` }}
          aria-hidden="true"
        >
          <div className="absolute inset-x-0" style={{ top: visibleTop }}>
            {displayModel.lineNumbers.slice(viewport.startLine, viewport.endLine).map((sourceLine) => {
              const fold = foldMap.get(sourceLine)
              const collapsed = collapsedStarts.has(sourceLine)
              const showFoldControl = Boolean(fold) && (collapsed || foldColumnHovered)
              return (
                <div key={sourceLine} className="flex h-6 items-center px-2 font-mono text-xs leading-6">
                  <div className="min-w-0 flex-1 pr-1 text-right" style={{ color: sourceLine === activeSourceLine ? theme.gutterActiveForeground : theme.gutterForeground }}>
                    {sourceLine}
                  </div>
                  <div
                    className="w-6 shrink-0"
                    onMouseEnter={() => {
                      if (!isLargeFile) setFoldColumnHovered(true)
                    }}
                    onMouseLeave={() => {
                      if (!isLargeFile) setFoldColumnHovered(false)
                    }}
                  >
                    <button
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm cursor-pointer transition-colors"
                      style={{
                        color: showFoldControl ? theme.gutterForeground : 'transparent',
                        backgroundColor: 'transparent',
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (fold) toggleFold(sourceLine)
                      }}
                      tabIndex={-1}
                      aria-label={fold ? (collapsed ? `Expand line ${sourceLine}` : `Collapse line ${sourceLine}`) : undefined}
                    >
                      {fold ? collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" /> : null}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex-1 min-w-0 min-h-0 relative">
          <div
            ref={scrollerRef}
            className="absolute inset-0 overflow-auto"
            onScroll={syncScroll}
          >
            <div
              className="relative"
              style={{
                height: documentHeight,
                minWidth: '100%',
              }}
            >
              <div
                className="pointer-events-none absolute left-0 right-0"
                style={{ top: lineHighlightTop + viewState.scrollTop, height: lineHeight, backgroundColor: theme.lineHighlight }}
              />
              {isLargeFile ? null : (
                <div
                  className="pointer-events-none absolute inset-x-0 overflow-hidden"
                  style={{ backgroundColor: theme.background, color: theme.foreground, top: 0, height: documentHeight }}
                  aria-hidden="true"
                >
                  <div
                    className="absolute"
                    style={{
                      top: paddingY + viewport.startLine * lineHeight,
                      left: paddingX - viewState.scrollLeft,
                      right: contentPaddingRight,
                    }}
                  >
                    {renderHighlightedLines(visibleHighlightedLines, viewport.startLine, lineHeight)}
                  </div>
                </div>
              )}
              {caretVisible ? <div className="code-editor-caret absolute w-[2px] pointer-events-none" style={{ ...caretStyle, top: caretTop + viewState.scrollTop }} /> : null}
              <textarea
                ref={textareaRef}
                spellCheck={false}
                value={textareaWindow.text}
                onChange={(event) => handleDisplayChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onSelect={syncSelection}
                onClick={syncSelection}
                onKeyUp={syncSelection}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="code-editor-input absolute left-0 resize-none border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-transparent outline-none"
                style={{
                  '--code-editor-selection': theme.selection,
                  caretColor: isLargeFile ? theme.caret : 'transparent',
                  color: isLargeFile ? theme.foreground : 'transparent',
                  top: 0,
                  width: `calc(100% - ${showMinimap ? minimapWidth + minimapInset * 2 : 0}px)`,
                  height: textareaPaddingTop + textareaWindow.text.split('\n').length * lineHeight + textareaPaddingBottom,
                  paddingTop: textareaPaddingTop,
                  paddingBottom: textareaPaddingBottom,
                  paddingRight: contentPaddingRight,
                  tabSize: 2,
                  whiteSpace: 'pre',
                  overflow: 'hidden',
                  overflowWrap: 'normal',
                  wordBreak: 'normal',
                } as CSSProperties}
              />
            </div>
          </div>
          {showMinimap ? (
            <div
              ref={minimapRef}
              className="absolute right-3 top-3 bottom-3 overflow-hidden rounded-md border cursor-pointer"
              style={{ width: minimapWidth, backgroundColor: theme.gutterBackground, borderColor: theme.border }}
              onPointerDown={handleMinimapPointerDown}
              onPointerMove={handleMinimapPointerMove}
              onPointerUp={handleMinimapPointerUp}
              onPointerCancel={handleMinimapPointerUp}
            >
              <div
                className="absolute left-[6px] right-[6px] top-[6px]"
                style={{
                  height: minimapContentHeight,
                }}
              >
                <canvas ref={minimapCanvasRef} className="block h-full w-full" aria-hidden="true" />
              </div>
              <div
                className="absolute left-1.5 right-1.5 rounded-sm border pointer-events-none"
                style={{
                  top: minimapThumbTop,
                  height: minimapThumbHeight,
                  backgroundColor: isDark ? 'rgba(110, 118, 129, 0.22)' : 'rgba(9, 105, 218, 0.14)',
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(9,105,218,0.22)',
                  boxShadow: isDark ? '0 0 0 1px rgba(0,0,0,0.16)' : '0 0 0 1px rgba(255,255,255,0.45)',
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
