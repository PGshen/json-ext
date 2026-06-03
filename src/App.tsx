/* eslint-disable react-hooks/set-state-in-effect */
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { JSONPath } from 'jsonpath-plus'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './App.css'
import {
  createTranslator,
  getInitialLeftDefaultViewMode,
  getInitialLocale,
  getInitialRightDefaultViewMode,
  getInitialThemeMode,
  persistLocale,
  type JsonViewMode,
  type Locale,
  type ThemeMode,
} from './i18n'

type JsonValue = null | boolean | number | bigint | string | JsonValue[] | { [k: string]: JsonValue }
type ViewMode = JsonViewMode
type PathSegment = string | number
type JsonPathScope = 'selected' | 'root'
type JsonPathInput = string | number | boolean | object | unknown[] | null
type RecursiveSubviewFrame = {
  id: string
  title: string
  rootValue: JsonValue
}
type TreeRenderOptions = {
  selectedPath: string | null
  expandedPaths: Set<string>
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}

type TreeNode = {
  path: string
  label: string
  value: JsonValue
  nodeType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  children: TreeNode[]
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const IMAGE_URL_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i
const MIN_PANE_RATIO = 0.25
const MAX_SUBVIEW_DEPTH = 10
const EXPAND_ALL_GUARD_COUNT = 4000
const JSONPATH_GUARD_NODE_COUNT = 30000
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'
const TIMESTAMP_SECONDS_MIN = 946684800
const TIMESTAMP_SECONDS_MAX = 4102444800
const TIMESTAMP_MILLISECONDS_MIN = TIMESTAMP_SECONDS_MIN * 1000
const TIMESTAMP_MILLISECONDS_MAX = TIMESTAMP_SECONDS_MAX * 1000
const LARGE_JSON_PARSE_GUARD_CHARS = 2_000_000
const MAX_SAFE_JSON_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)
const PRESERVED_INTEGER_MARKER_END = '\u0000'

function getPreferredTheme(): 'light' | 'dark' {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

type ValueEnhanceOptions = {
  enableImagePreview: boolean
  enableLatexPreview: boolean
  enableLinkOpening: boolean
}

type LatexSegment =
  | {
      kind: 'text'
      value: string
    }
  | {
      kind: 'math'
      value: string
      displayMode: boolean
    }

type ParseJsonResult = {
  parsed: JsonValue | undefined
  error: string
}

function getNodeType(value: JsonValue): TreeNode['nodeType'] {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'object':
      return 'object'
    case 'bigint':
      return 'number'
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'null'
  }
}

function isDigit(char: string | undefined) {
  return char !== undefined && char >= '0' && char <= '9'
}

function isNonZeroDigit(char: string | undefined) {
  return char !== undefined && char >= '1' && char <= '9'
}

function scanJsonNumberEnd(text: string, startIndex: number) {
  let index = startIndex
  if (text[index] === '-') index += 1

  if (text[index] === '0') {
    index += 1
  } else if (isNonZeroDigit(text[index])) {
    index += 1
    while (isDigit(text[index])) index += 1
  } else {
    return null
  }

  if (text[index] === '.') {
    index += 1
    if (!isDigit(text[index])) return null
    while (isDigit(text[index])) index += 1
  }

  if (text[index] === 'e' || text[index] === 'E') {
    index += 1
    if (text[index] === '+' || text[index] === '-') index += 1
    if (!isDigit(text[index])) return null
    while (isDigit(text[index])) index += 1
  }

  return index
}

function isUnsafeIntegerLiteral(literal: string) {
  if (literal.includes('.') || /e/i.test(literal)) return false
  try {
    const value = BigInt(literal)
    return value > MAX_SAFE_JSON_INTEGER || value < -MAX_SAFE_JSON_INTEGER
  } catch {
    return false
  }
}

function createPreservedIntegerMarker() {
  return `\u0000json-ext-preserved-integer:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}:`
}

function protectUnsafeIntegerLiterals(text: string, marker: string) {
  let transformed = ''
  const preservedValues = new Set<string>()
  let index = 0

  while (index < text.length) {
    const char = text[index]

    if (char === '"') {
      const start = index
      index += 1
      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2
          continue
        }
        if (text[index] === '"') {
          index += 1
          break
        }
        index += 1
      }
      transformed += text.slice(start, index)
      continue
    }

    if (char === '-' || isDigit(char)) {
      const end = scanJsonNumberEnd(text, index)
      if (end === null) {
        transformed += char
        index += 1
        continue
      }
      const literal = text.slice(index, end)
      if (isUnsafeIntegerLiteral(literal)) {
        const preservedValue = `${marker}${literal}${PRESERVED_INTEGER_MARKER_END}`
        preservedValues.add(preservedValue)
        transformed += JSON.stringify(preservedValue)
      } else {
        transformed += literal
      }
      index = end
      continue
    }

    transformed += char
    index += 1
  }

  return { transformed, preservedValues }
}

function restoreUnsafeIntegerLiterals(
  value: unknown,
  marker: string,
  preservedValues: Set<string>,
): JsonValue {
  if (typeof value === 'string') {
    if (preservedValues.has(value)) {
      const literal = value.slice(marker.length, -PRESERVED_INTEGER_MARKER_END.length)
      return BigInt(literal)
    }
    return value
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => restoreUnsafeIntegerLiterals(item, marker, preservedValues))
  }

  if (typeof value === 'object') {
    const restored: Record<string, JsonValue> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      restored[key] = restoreUnsafeIntegerLiterals(item, marker, preservedValues)
    })
    return restored
  }

  throw new Error('Invalid JSON value')
}

function parseJsonPreservingUnsafeIntegers(text: string): JsonValue {
  const marker = createPreservedIntegerMarker()
  const { transformed, preservedValues } = protectUnsafeIntegerLiterals(text, marker)
  const parsed = JSON.parse(transformed) as unknown
  return restoreUnsafeIntegerLiterals(parsed, marker, preservedValues)
}

function stringifyJson(value: JsonValue, space = 0): string {
  const indentSize = Math.min(10, Math.max(0, Math.floor(space)))
  const indentUnit = indentSize > 0 ? ' '.repeat(indentSize) : ''

  const write = (current: JsonValue, depth: number): string => {
    if (current === null) return 'null'

    if (typeof current === 'string') return JSON.stringify(current)
    if (typeof current === 'bigint') return current.toString()
    if (typeof current === 'number') return Number.isFinite(current) ? String(current) : 'null'
    if (typeof current === 'boolean') return current ? 'true' : 'false'

    if (Array.isArray(current)) {
      if (current.length === 0) return '[]'
      const items = current.map((item) => write(item, depth + 1))
      if (!indentUnit) return `[${items.join(',')}]`

      const nextIndent = indentUnit.repeat(depth + 1)
      const currentIndent = indentUnit.repeat(depth)
      return `[\n${items.map((item) => `${nextIndent}${item}`).join(',\n')}\n${currentIndent}]`
    }

    const entries = Object.entries(current)
    if (entries.length === 0) return '{}'
    if (!indentUnit) {
      return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${write(item, depth + 1)}`).join(',')}}`
    }

    const nextIndent = indentUnit.repeat(depth + 1)
    const currentIndent = indentUnit.repeat(depth)
    return `{\n${entries
      .map(([key, item]) => `${nextIndent}${JSON.stringify(key)}: ${write(item, depth + 1)}`)
      .join(',\n')}\n${currentIndent}}`
  }

  return write(value, 0)
}

function toObjectChildPath(parentPath: string, key: string) {
  if (IDENTIFIER_RE.test(key)) {
    return `${parentPath}.${key}`
  }
  return `${parentPath}[${JSON.stringify(key)}]`
}

function buildTreeAndPathMap(rootValue: JsonValue) {
  const pathMap = new Map<string, JsonValue>()
  const parentPathMap = new Map<string, string | null>()
  const nodeMap = new Map<string, TreeNode>()
  const allPaths: string[] = []

  const walk = (value: JsonValue, path: string, label: string, parentPath: string | null): TreeNode => {
    pathMap.set(path, value)
    parentPathMap.set(path, parentPath)
    allPaths.push(path)
    const nodeType = getNodeType(value)
    const children: TreeNode[] = []

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const childPath = `${path}[${index}]`
        children.push(walk(item, childPath, `[${index}]`, path))
      })
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => {
        const childPath = toObjectChildPath(path, key)
        children.push(walk(item, childPath, key, path))
      })
    }

    const node = { path, label, value, nodeType, children }
    nodeMap.set(path, node)
    return node
  }

  return {
    rootNode: walk(rootValue, '$', '$', null),
    pathMap,
    parentPathMap,
    nodeMap,
    allPaths,
  }
}

function parseJsonSafely(text: string): ParseJsonResult {
  if (!text.trim()) {
    return { parsed: undefined, error: '' }
  }

  try {
    return { parsed: parseJsonPreservingUnsafeIntegers(text), error: '' }
  } catch (error) {
    return {
      parsed: undefined,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

function collectVisiblePaths(rootNode: TreeNode, expandedPaths: Set<string>) {
  const visible: string[] = []

  const visit = (node: TreeNode) => {
    visible.push(node.path)
    const isExpanded = expandedPaths.has(node.path)
    const isContainer = node.nodeType === 'object' || node.nodeType === 'array'
    if (!isContainer || !isExpanded) return
    node.children.forEach(visit)
  }

  visit(rootNode)
  return visible
}

function parsePathSegments(path: string): PathSegment[] {
  if (path === '$') return []
  if (!path.startsWith('$')) throw new Error('Invalid path')

  const segments: PathSegment[] = []
  let index = 1

  while (index < path.length) {
    const char = path[index]

    if (char === '.') {
      let end = index + 1
      while (end < path.length && /[A-Za-z0-9_$]/.test(path[end])) {
        end += 1
      }
      const key = path.slice(index + 1, end)
      if (!key) throw new Error('Invalid dot path segment')
      segments.push(key)
      index = end
      continue
    }

    if (char === '[') {
      const closeIndex = path.indexOf(']', index)
      if (closeIndex === -1) throw new Error('Invalid bracket path segment')
      const raw = path.slice(index + 1, closeIndex)
      if (/^\d+$/.test(raw)) {
        segments.push(Number(raw))
      } else {
        segments.push(JSON.parse(raw) as string)
      }
      index = closeIndex + 1
      continue
    }

    throw new Error('Unknown path segment')
  }

  return segments
}

function updateValueAtPath(root: JsonValue, path: string, nextValue: JsonValue): JsonValue {
  if (path === '$') return nextValue
  const segments = parsePathSegments(path)

  const walk = (current: JsonValue, cursor: number): JsonValue => {
    if (cursor >= segments.length) return nextValue
    const segment = segments[cursor]

    if (typeof segment === 'number' && Array.isArray(current)) {
      const cloned = current.slice()
      cloned[segment] = walk(cloned[segment], cursor + 1)
      return cloned
    }

    if (typeof segment === 'string' && current && typeof current === 'object' && !Array.isArray(current)) {
      const cloned = { ...(current as Record<string, JsonValue>) }
      cloned[segment] = walk(cloned[segment], cursor + 1)
      return cloned
    }

    return current
  }

  return walk(root, 0)
}

function buildPathFromSegments(segments: PathSegment[]) {
  if (segments.length === 0) return '$'
  let path = '$'
  for (const segment of segments) {
    if (typeof segment === 'number') {
      path = `${path}[${segment}]`
      continue
    }
    if (IDENTIFIER_RE.test(segment)) {
      path = `${path}.${segment}`
      continue
    }
    path = `${path}[${JSON.stringify(segment)}]`
  }
  return path
}

function mergePaths(basePath: string, localPath: string) {
  if (basePath === '$') return localPath
  if (localPath === '$') return basePath
  const baseSegments = parsePathSegments(basePath)
  const localSegments = parsePathSegments(localPath)
  return buildPathFromSegments([...baseSegments, ...localSegments])
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRecordArray(value: JsonValue[]): value is Record<string, JsonValue>[] {
  return value.length > 0 && value.every((item) => isRecord(item))
}

function summarizeValue(value: JsonValue) {
  if (Array.isArray(value)) return `Array[${value.length}]`
  if (isRecord(value)) return `Object{${Object.keys(value).length}}`
  return ''
}

function scalarClass(value: JsonValue) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function detectTimestampUnit(value: number): 'seconds' | 'milliseconds' | null {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null
  if (value >= TIMESTAMP_SECONDS_MIN && value <= TIMESTAMP_SECONDS_MAX) return 'seconds'
  if (value >= TIMESTAMP_MILLISECONDS_MIN && value <= TIMESTAMP_MILLISECONDS_MAX) return 'milliseconds'
  return null
}

function formatTimestamp(value: number, unit: 'seconds' | 'milliseconds') {
  const milliseconds = unit === 'seconds' ? value * 1000 : value
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function isImageUrl(value: string) {
  if (value.startsWith('data:image/')) return true
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const fileLike = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return IMAGE_URL_RE.test(fileLike)
  } catch {
    return false
  }
}

function getOpenableUrl(value: string) {
  const candidate = value.trim()
  if (!candidate || /\s/.test(candidate)) return null
  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

function isEscapedAt(text: string, index: number) {
  let slashCount = 0
  let cursor = index - 1
  while (cursor >= 0 && text[cursor] === '\\') {
    slashCount += 1
    cursor -= 1
  }
  return slashCount % 2 === 1
}

function parseLatexSegments(value: string): LatexSegment[] {
  const segments: LatexSegment[] = []
  let cursor = 0

  const pushText = (text: string) => {
    if (!text) return
    segments.push({ kind: 'text', value: text })
  }

  while (cursor < value.length) {
    let nextStart = -1
    let startDelimiter = ''
    let endDelimiter = ''
    let displayMode = false

    const candidates: Array<[string, string, boolean]> = [
      ['$$', '$$', true],
      ['\\[', '\\]', true],
      ['\\(', '\\)', false],
      ['$', '$', false],
    ]

    candidates.forEach(([start, end, isDisplay]) => {
      const index = value.indexOf(start, cursor)
      if (index === -1) return
      if (start === '$' && isEscapedAt(value, index)) return
      if (nextStart === -1 || index < nextStart) {
        nextStart = index
        startDelimiter = start
        endDelimiter = end
        displayMode = isDisplay
      }
    })

    if (nextStart === -1) {
      pushText(value.slice(cursor))
      break
    }

    pushText(value.slice(cursor, nextStart))
    const mathStart = nextStart + startDelimiter.length
    let mathEnd = value.indexOf(endDelimiter, mathStart)
    while (mathEnd !== -1 && isEscapedAt(value, mathEnd)) {
      mathEnd = value.indexOf(endDelimiter, mathEnd + endDelimiter.length)
    }

    if (mathEnd === -1) {
      pushText(value.slice(nextStart))
      break
    }

    const expression = value.slice(mathStart, mathEnd).trim()
    if (expression) {
      segments.push({
        kind: 'math',
        value: expression,
        displayMode,
      })
    } else {
      pushText(value.slice(nextStart, mathEnd + endDelimiter.length))
    }
    cursor = mathEnd + endDelimiter.length
  }

  return segments
}

function renderLatexHtml(expression: string, displayMode: boolean) {
  return katex.renderToString(expression, {
    throwOnError: false,
    displayMode,
    strict: 'ignore',
  })
}

function buildParseApprovalSignature(text: string) {
  return `${text.length}:${text.slice(0, 128)}`
}

async function fetchSourceJson(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.text()
}

function App() {
  const [sourceText, setSourceText] = useState('')
  const [, setSourceUrl] = useState('')
  const [mode, setMode] = useState('standalone')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState('')
  const [leftViewMode, setLeftViewMode] = useState<ViewMode>(() => getInitialLeftDefaultViewMode())
  const [rightViewMode, setRightViewMode] = useState<ViewMode>(() => getInitialRightDefaultViewMode())
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [jsonPathExpr, setJsonPathExpr] = useState('')
  const [jsonPathResult, setJsonPathResult] = useState<JsonValue[] | null>(null)
  const [jsonPathError, setJsonPathError] = useState('')
  const [jsonPathScope, setJsonPathScope] = useState<JsonPathScope>('selected')
  const [isJsonPathCollapsed, setIsJsonPathCollapsed] = useState(true)
  const [leftTextDraft, setLeftTextDraft] = useState('')
  const [leftTextError, setLeftTextError] = useState('')
  const [rightTextDraft, setRightTextDraft] = useState('')
  const [rightTextError, setRightTextError] = useState('')
  const [collapsedTableNodes, setCollapsedTableNodes] = useState<Set<string>>(new Set())
  const [timeDisplayValueKeys, setTimeDisplayValueKeys] = useState<Set<string>>(new Set())
  const [rightLocalSelectedPath, setRightLocalSelectedPath] = useState<string | null>(null)
  const [rightExpandedPaths, setRightExpandedPaths] = useState<Set<string>>(new Set())
  const [subviewStack, setSubviewStack] = useState<RecursiveSubviewFrame[]>([])
  const [enableLatexPreview, setEnableLatexPreview] = useState(true)
  const [leftPaneRatio, setLeftPaneRatio] = useState(0.5)
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode())
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getPreferredTheme())
  const theme = themeMode === 'system' ? systemTheme : themeMode
  const [parseApprovalSignature, setParseApprovalSignature] = useState<string | null>(null)
  const [locale, ] = useState<Locale>(getInitialLocale())
  const t = useMemo(() => createTranslator(locale), [locale])
  const panesRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    persistLocale(locale)
  }, [locale])

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY)
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)

    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme)
    }
  }, [])

  useEffect(() => {
    const syncThemeMode = () => setThemeMode(getInitialThemeMode())
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'json-ext-theme') return
      syncThemeMode()
    }

    window.addEventListener('focus', syncThemeMode)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', syncThemeMode)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextMode = params.get('mode') ?? 'standalone'
    const nextSourceUrl = params.get('sourceUrl') ?? ''
    const sessionKey = params.get('sessionKey')

    setMode(nextMode)
    setSourceUrl(nextSourceUrl)

    if (!sessionKey) {
      if (nextMode === 'intercept' && nextSourceUrl) {
        fetchSourceJson(nextSourceUrl)
          .then((text) => {
            setSourceText(text)
            setLoadError('')
          })
          .catch(() => {
            setLoadError(t('loadJsonFailed'))
          })
      }
      return
    }

    chrome.storage.session
      .get(sessionKey)
      .then((result) => {
        const record = result[sessionKey] as { jsonText?: string } | undefined
        if (!record?.jsonText) {
          setLoadError(t('noInterceptData'))
          return
        }

        setSourceText(record.jsonText)
        return chrome.storage.session.remove(sessionKey)
      })
      .catch(() => {
        setLoadError(t('readInterceptFailed'))
      })
  }, [t])

  const sourceParseSignature = useMemo(() => buildParseApprovalSignature(sourceText), [sourceText])
  const requiresLargeJsonApproval = sourceText.length > LARGE_JSON_PARSE_GUARD_CHARS
  const canParseSource = !requiresLargeJsonApproval || parseApprovalSignature === sourceParseSignature
  const deferredSourceText = useDeferredValue(canParseSource ? sourceText : '')
  const isSourceDeferred = canParseSource && deferredSourceText !== sourceText
  const { parsed, error } = useMemo(() => {
    if (!canParseSource) {
      return { parsed: undefined, error: '' }
    }
    return parseJsonSafely(deferredSourceText)
  }, [canParseSource, deferredSourceText])
  const { rootNode, pathMap, parentPathMap, nodeMap, allPaths } = useMemo(() => {
    if (parsed === undefined) {
      return {
        rootNode: null as TreeNode | null,
        pathMap: new Map<string, JsonValue>(),
        parentPathMap: new Map<string, string | null>(),
        nodeMap: new Map<string, TreeNode>(),
        allPaths: [],
      }
    }
    return buildTreeAndPathMap(parsed)
  }, [parsed])

  useEffect(() => {
    if (parsed === undefined) {
      setSelectedPath(null)
      setExpandedPaths(new Set())
      return
    }

    setSelectedPath((prev) => {
      if (prev && pathMap.has(prev)) return prev
      return '$'
    })

    setExpandedPaths((prev) => {
      const next = new Set<string>(['$'])
      prev.forEach((path) => {
        if (pathMap.has(path)) {
          next.add(path)
        }
      })
      return next
    })
  }, [parsed, pathMap])

  const hasSelectedNode = selectedPath ? pathMap.has(selectedPath) : false
  const selectedValue = selectedPath ? pathMap.get(selectedPath) : undefined
  const activeSubview = subviewStack.length > 0 ? subviewStack[subviewStack.length - 1] : null
  const rightRootValue = activeSubview ? activeSubview.rootValue : hasSelectedNode ? (selectedValue as JsonValue) : undefined
  const hasRightRoot = rightRootValue !== undefined
  // const rightContextLabel = activeSubview ? activeSubview.title : selectedPath ?? '$'
  const rightContextPath = selectedPath ?? '$'
  const {
    rootNode: rightRootNode,
    pathMap: rightPathMap,
    parentPathMap: rightParentPathMap,
  } = useMemo(() => {
    if (rightRootValue === undefined) {
      return {
        rootNode: null as TreeNode | null,
        pathMap: new Map<string, JsonValue>(),
        parentPathMap: new Map<string, string | null>(),
        nodeMap: new Map<string, TreeNode>(),
        allPaths: [],
      }
    }
    return buildTreeAndPathMap(rightRootValue)
  }, [rightRootValue])
  const hasRightSelection = rightLocalSelectedPath ? rightPathMap.has(rightLocalSelectedPath) : false
  const rightSelectedValue = rightLocalSelectedPath ? rightPathMap.get(rightLocalSelectedPath) : undefined
  const rightSelectedAbsolutePath =
    rightLocalSelectedPath && hasSelectedNode && !activeSubview
      ? mergePaths(selectedPath as string, rightLocalSelectedPath)
      : rightLocalSelectedPath ?? '$'
  const totalNodeCount = allPaths.length
  const visiblePaths = useMemo(() => {
    if (!rootNode) return []
    return collectVisiblePaths(rootNode, expandedPaths)
  }, [rootNode, expandedPaths])
  const visibleNodeCount = visiblePaths.length
  useEffect(() => {
    if (!selectedPath || !pathMap.has(selectedPath)) return

    setExpandedPaths((prev) => {
      const next = new Set(prev)
      let cursor: string | null = selectedPath
      while (cursor) {
        next.add(cursor)
        cursor = parentPathMap.get(cursor) ?? null
      }
      return next
    })
  }, [selectedPath, pathMap, parentPathMap])

  useEffect(() => {
    setSubviewStack([])
  }, [selectedPath])

  useEffect(() => {
    setActionMessage('')
    setActionError('')
    setJsonPathResult(null)
    setJsonPathError('')
  }, [selectedPath, subviewStack.length, rightLocalSelectedPath])

  useEffect(() => {
    setLeftTextDraft(sourceText)
    setLeftTextError('')
  }, [sourceText])

  useEffect(() => {
    if (!hasRightRoot) {
      setRightLocalSelectedPath(null)
      setRightExpandedPaths(new Set())
      return
    }

    setRightLocalSelectedPath((prev) => {
      if (prev && rightPathMap.has(prev)) return prev
      return '$'
    })

    setRightExpandedPaths((prev) => {
      const next = new Set<string>(['$'])
      prev.forEach((path) => {
        if (rightPathMap.has(path)) {
          next.add(path)
        }
      })
      return next
    })
  }, [hasRightRoot, rightPathMap, rightRootValue])

  useEffect(() => {
    if (!hasRightSelection || !rightLocalSelectedPath) {
      setRightTextDraft('')
      setRightTextError('')
      return
    }
    setRightTextDraft(stringifyJson(rightSelectedValue as JsonValue, 2))
    setRightTextError('')
  }, [hasRightSelection, rightSelectedValue, rightLocalSelectedPath])

  useEffect(() => {
    setCollapsedTableNodes(new Set())
    setTimeDisplayValueKeys(new Set())
  }, [parsed, selectedPath, subviewStack.length, rightLocalSelectedPath])

  useEffect(() => {
    if (!rightLocalSelectedPath || !rightPathMap.has(rightLocalSelectedPath)) return

    setRightExpandedPaths((prev) => {
      const next = new Set(prev)
      let cursor: string | null = rightLocalSelectedPath
      while (cursor) {
        next.add(cursor)
        cursor = rightParentPathMap.get(cursor) ?? null
      }
      return next
    })
  }, [rightLocalSelectedPath, rightPathMap, rightParentPathMap])

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleRightPath = (path: string) => {
    setRightExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const expandAllRight = () => {
    setRightExpandedPaths(new Set(rightPathMap.keys()))
  }

  const collapseAllRight = () => {
    setRightExpandedPaths(new Set(['$']))
  }

  const expandAll = () => {
    if (allPaths.length > EXPAND_ALL_GUARD_COUNT) {
      const confirmed = window.confirm(
        t('expandAllConfirm', { count: allPaths.length }),
      )
      if (!confirmed) {
        setActionMessage(t('canceledExpandAll'))
        return
      }
    }
    setExpandedPaths(new Set(allPaths))
  }

  const collapseAll = () => {
    setExpandedPaths(new Set(['$']))
  }

  const onTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selectedPath || !hasSelectedNode) return

    const currentIndex = visiblePaths.indexOf(selectedPath)
    if (currentIndex === -1) return

    if (event.key === 'ArrowDown') {
      const nextPath = visiblePaths[Math.min(currentIndex + 1, visiblePaths.length - 1)]
      if (nextPath) {
        event.preventDefault()
        setSelectedPath(nextPath)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      const prevPath = visiblePaths[Math.max(currentIndex - 1, 0)]
      if (prevPath) {
        event.preventDefault()
        setSelectedPath(prevPath)
      }
      return
    }

    if (event.key === 'ArrowRight') {
      const currentNode = nodeMap.get(selectedPath)
      if (!currentNode) return
      const isContainer = currentNode.nodeType === 'object' || currentNode.nodeType === 'array'
      if (!isContainer) return

      event.preventDefault()
      const isExpanded = expandedPaths.has(selectedPath)
      if (!isExpanded) {
        setExpandedPaths((prev) => new Set(prev).add(selectedPath))
      } else if (currentNode.children.length > 0) {
        setSelectedPath(currentNode.children[0].path)
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      const currentNode = nodeMap.get(selectedPath)
      if (!currentNode) return
      const isContainer = currentNode.nodeType === 'object' || currentNode.nodeType === 'array'
      const isExpanded = expandedPaths.has(selectedPath)

      event.preventDefault()
      if (isContainer && isExpanded && currentNode.children.length > 0) {
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          next.delete(selectedPath)
          return next
        })
        return
      }

      const parentPath = parentPathMap.get(selectedPath)
      if (parentPath) setSelectedPath(parentPath)
    }
  }

  const renderTree = (node: TreeNode, options: TreeRenderOptions, depth = 0, isLast = true) => {
    const isContainer = node.nodeType === 'object' || node.nodeType === 'array'
    const isExpanded = options.expandedPaths.has(node.path)
    const isSelected = options.selectedPath === node.path
    const isRoot = node.path === '$'
    const openToken = node.nodeType === 'array' ? '[' : '{'
    const closeToken = node.nodeType === 'array' ? ']' : '}'
    const displayKey =
      isRoot ? '' : /^\[\d+\]$/.test(node.label) ? node.label : JSON.stringify(node.label)
    const containerSummary = isContainer
      ? node.nodeType === 'array'
        ? `Array [${(node.value as JsonValue[]).length}]`
        : `Object {${Object.keys(node.value as Record<string, JsonValue>).length}}`
      : ''
    const scalarLiteral =
      node.nodeType === 'string' ? JSON.stringify(node.value as string) : String(node.value)
    const rowPadding = `${depth * 16}px`

    return (
      <li key={node.path}>
        <div className={`tree-code-row ${isSelected ? 'selected' : ''}`} style={{ paddingLeft: rowPadding }}>
          {isContainer ? (
            <button
              type="button"
              className="tree-toggle"
              onClick={() => options.onToggle(node.path)}
              aria-label={isExpanded ? t('foldNode') : t('expandNode')}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="tree-toggle-placeholder" />
          )}
          <button type="button" className="tree-code-main" onClick={() => options.onSelect(node.path)}>
            {!isRoot ? <span className="tree-json-key">{displayKey}</span> : null}
            {!isRoot ? <span className="tree-json-colon">: </span> : null}
            {isContainer && isExpanded ? <span className="tree-json-brace">{openToken}</span> : null}
            {isContainer && !isExpanded ? (
              <>
                <span className="tree-inline-summary">{containerSummary}</span>
                {!isLast ? <span className="tree-json-comma">,</span> : null}
              </>
            ) : null}
            {!isContainer ? (
              <>
                <span className={`tree-json-value ${node.nodeType}`}>{scalarLiteral}</span>
                {!isLast ? <span className="tree-json-comma">,</span> : null}
              </>
            ) : null}
          </button>
        </div>

        {isContainer && isExpanded ? (
          <>
            {node.children.length > 0 ? (
              <ul className="tree-list">
                {node.children.map((child, index) =>
                  renderTree(child, options, depth + 1, index === node.children.length - 1),
                )}
              </ul>
            ) : (
              <div className="tree-code-row tree-empty-row" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
                <span className="tree-toggle-placeholder" />
                <span className="tree-empty">
                  {node.nodeType === 'array' ? t('emptyArray') : t('emptyObject')}
                </span>
              </div>
            )}
            <div className="tree-code-row tree-close-row" style={{ paddingLeft: rowPadding }}>
              <span className="tree-toggle-placeholder" />
              <span className="tree-json-brace">
                {closeToken}
                {!isLast ? ',' : ''}
              </span>
            </div>
          </>
        ) : null}
      </li>
    )
  }

  const toggleNestedTable = (nodeKey: string) => {
    setCollapsedTableNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeKey)) next.delete(nodeKey)
      else next.add(nodeKey)
      return next
    })
  }

  const toggleScalarTimeDisplay = (valueKey: string) => {
    setTimeDisplayValueKeys((prev) => {
      const next = new Set(prev)
      if (next.has(valueKey)) next.delete(valueKey)
      else next.add(valueKey)
      return next
    })
  }

  const renderScalar = (value: JsonValue, path: string, contextKey: string, enhanceOptions: ValueEnhanceOptions) => {
    const display = value === null ? 'null' : String(value)
    if (typeof value === 'number') {
      const timestampUnit = detectTimestampUnit(value)
      if (!timestampUnit) {
        return <span className={`json-scalar ${scalarClass(value)}`}>{display}</span>
      }
      const valueKey = `${contextKey}:${path}`
      const showTime = timeDisplayValueKeys.has(valueKey)
      const renderedValue = showTime ? formatTimestamp(value, timestampUnit) : display
      return (
        <span className="timestamp-display">
          <span className={`json-scalar ${scalarClass(value)}`}>{renderedValue}</span>
          <button
            type="button"
            className="timestamp-toggle"
            onClick={() => toggleScalarTimeDisplay(valueKey)}
            aria-label={showTime ? t('showTimestamp') : t('showTime')}
          >
            {showTime ? t('showTimestamp') : t('showTime')}
          </button>
        </span>
      )
    }

    if (typeof value !== 'string') {
      return <span className={`json-scalar ${scalarClass(value)}`}>{display}</span>
    }

    const latexSegments = enhanceOptions.enableLatexPreview ? parseLatexSegments(value) : []
    const hasLatex = latexSegments.some((segment) => segment.kind === 'math')
    if (hasLatex) {
      return (
        <span className="json-scalar string latex-mixed">
          {latexSegments.map((segment, index) => {
            if (segment.kind === 'text') {
              return <span key={`text-${index}`}>{segment.value}</span>
            }
            return (
              <span
                key={`math-${index}`}
                className={segment.displayMode ? 'latex-display-segment' : 'latex-inline-segment'}
                dangerouslySetInnerHTML={{
                  __html: renderLatexHtml(segment.value, segment.displayMode),
                }}
              />
            )
          })}
        </span>
      )
    }

    const openableUrl = enhanceOptions.enableLinkOpening ? getOpenableUrl(value) : null
    const renderedScalar = openableUrl ? (
      <a
        className={`json-scalar ${scalarClass(value)} json-link`}
        href={openableUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {display}
      </a>
    ) : (
      <span className={`json-scalar ${scalarClass(value)}`}>{display}</span>
    )
    const imagePreviewUrl = enhanceOptions.enableImagePreview && isImageUrl(value) ? value : null
    const hasHoverEnhancement = Boolean(imagePreviewUrl)

    if (!hasHoverEnhancement) {
      return renderedScalar
    }

    return (
      <span className="enhanced-value">
        {renderedScalar}
        <span className="value-hover-card">
          {imagePreviewUrl ? (
            <div className="value-preview-section">
              <strong>{t('imagePreview')}</strong>
              <img src={imagePreviewUrl} alt={t('valuePreviewAlt')} className="value-hover-image" loading="lazy" />
            </div>
          ) : null}
        </span>
      </span>
    )
  }

  const renderNestedValue = (value: JsonValue, path: string, contextKey: string, enhanceOptions: ValueEnhanceOptions) => {
    if (Array.isArray(value)) {
      const nodeKey = `${contextKey}:${path}`
      const collapsed = collapsedTableNodes.has(nodeKey)
      const summary = summarizeValue(value)
      if (value.length === 0) {
        return (
          <div className="nested-block">
            <span className="nested-summary">{summary}</span>
          </div>
        )
      }

      if (collapsed) {
        return (
          <div className="nested-block">
            <div className="nested-header">
              <span className="nested-summary">{summary}</span>
              <button
                type="button"
                className="nested-toggle"
                aria-label={t('toggleNode', { nodeKey })}
                onClick={() => toggleNestedTable(nodeKey)}
              >
                +
              </button>
            </div>
          </div>
        )
      }

      if (isRecordArray(value)) {
        const columns: string[] = []
        value.forEach((record) => {
          Object.keys(record).forEach((key) => {
            if (!columns.includes(key)) columns.push(key)
          })
        })

        return (
          <div className="nested-block">
            <div className="nested-header">
              <span className="nested-summary">{summary}</span>
              <button
                type="button"
                className="nested-toggle"
                aria-label={t('toggleNode', { nodeKey })}
                onClick={() => toggleNestedTable(nodeKey)}
              >
                -
              </button>
            </div>
            <table className="json-table nested-json-table">
              <thead>
                <tr>
                  <th>#</th>
                  {columns.map((column) => (
                    <th key={`${path}:${column}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.map((record, rowIndex) => (
                  <tr key={`${path}[${rowIndex}]`}>
                    <td>{rowIndex + 1}</td>
                    {columns.map((column) => (
                      <td key={`${path}[${rowIndex}].${column}`}>
                        {renderNestedValue(
                          record[column] ?? null,
                          toObjectChildPath(`${path}[${rowIndex}]`, column),
                          contextKey,
                          enhanceOptions,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      return (
        <div className="nested-block">
          <div className="nested-header">
            <span className="nested-summary">{summary}</span>
            <button
              type="button"
              className="nested-toggle"
              aria-label={t('toggleNode', { nodeKey })}
              onClick={() => toggleNestedTable(nodeKey)}
            >
              -
            </button>
          </div>
          <table className="json-table nested-json-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('valueLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {value.map((item, index) => (
                <tr key={`${path}[${index}]`}>
                  <td>{index + 1}</td>
                  <td>{renderNestedValue(item, `${path}[${index}]`, contextKey, enhanceOptions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (isRecord(value)) {
      const nodeKey = `${contextKey}:${path}`
      const collapsed = collapsedTableNodes.has(nodeKey)
      const entries = Object.entries(value)
      const summary = summarizeValue(value)

      if (entries.length === 0) {
        return (
          <div className="nested-block">
            <span className="nested-summary">{summary}</span>
          </div>
        )
      }

      if (collapsed) {
        return (
          <div className="nested-block">
            <div className="nested-header">
              <span className="nested-summary">{summary}</span>
              <button
                type="button"
                className="nested-toggle"
                aria-label={t('toggleNode', { nodeKey })}
                onClick={() => toggleNestedTable(nodeKey)}
              >
                +
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="nested-block">
          <div className="nested-header">
            <span className="nested-summary">{summary}</span>
            <button
              type="button"
              className="nested-toggle"
              aria-label={t('toggleNode', { nodeKey })}
              onClick={() => toggleNestedTable(nodeKey)}
            >
              -
            </button>
          </div>
          <table className="json-table nested-json-table">
            <tbody>
              {entries.map(([key, item]) => (
                <tr key={`${path}:${key}`}>
                  <th>{key}</th>
                  <td>{renderNestedValue(item, toObjectChildPath(path, key), contextKey, enhanceOptions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return renderScalar(value, path, contextKey, enhanceOptions)
  }

  const renderTable = (value: JsonValue | null, contextKey: string, enhanceOptions: ValueEnhanceOptions) => {
    if (value === null) {
      return <p className="muted">{t('noData')}</p>
    }
    return <div className="table-wrap">{renderNestedValue(value, '$', contextKey, enhanceOptions)}</div>
  }

  const handleAction = (runner: () => void) => {
    try {
      runner()
      setActionError('')
    } catch (error) {
      setActionMessage('')
      setActionError(error instanceof Error ? error.message : t('actionFailed'))
    }
  }

  const parseRightDraft = () => {
    if (!hasRightSelection) {
      throw new Error(t('selectValidNodeFirst'))
    }
    if (!rightTextDraft.trim()) {
      throw new Error(t('rightTextEmpty'))
    }
    const result = parseJsonSafely(rightTextDraft)
    if (result.parsed === undefined) {
      throw new Error(result.error || t('nodeJsonParseFailed'))
    }
    return result.parsed
  }

  const handleFormat = () =>
    handleAction(() => {
      const value = parseRightDraft()
      setRightTextError('')
      setRightTextDraft(stringifyJson(value, 2))
      setActionMessage(t('rightTextFormatted'))
    })

  const handleMinify = () =>
    handleAction(() => {
      const value = parseRightDraft()
      setRightTextError('')
      setRightTextDraft(stringifyJson(value))
      setActionMessage(t('rightTextMinified'))
    })

  const handleEscape = () =>
    handleAction(() => {
      const value = parseRightDraft()
      if (typeof value !== 'string') {
        throw new Error(t('escapeOnlyString'))
      }
      const next = JSON.stringify(value).slice(1, -1)
      setRightTextError('')
      setRightTextDraft(stringifyJson(next))
      setActionMessage(t('rightTextEscaped'))
    })

  const handleUnescape = () =>
    handleAction(() => {
      const value = parseRightDraft()
      if (typeof value !== 'string') {
        throw new Error(t('unescapeOnlyString'))
      }
      let next = value
      try {
        next = JSON.parse(`"${value}"`) as string
      } catch {
        next = value
      }
      setRightTextError('')
      setRightTextDraft(stringifyJson(next))
      const parsedSubview = parseJsonSafely(next).parsed
      if (parsedSubview === undefined) {
        setActionMessage(t('rightTextUnescaped'))
        return
      }
      if (subviewStack.length >= MAX_SUBVIEW_DEPTH) {
        throw new Error(t('subviewDepthLimit', { depth: MAX_SUBVIEW_DEPTH }))
      }
      setSubviewStack((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          title: t('subviewTitle', { index: prev.length + 1 }),
          rootValue: parsedSubview,
        },
      ])
      setActionMessage(t('rightTextUnescapedEnterSubview'))
    })

  const handleJsonPath = () =>
    handleAction(() => {
      const rootValue = parsed
      if (rootValue === undefined) {
        throw new Error(t('invalidJsonForJsonPath'))
      }
      const selected = hasRightSelection ? (rightSelectedValue as JsonValue) : null
      if (jsonPathScope === 'selected' && selected === null) {
        throw new Error(t('selectNodeOrGlobalScope'))
      }
      if (!jsonPathExpr.trim()) {
        throw new Error(t('inputJsonPathExpr'))
      }
      if (jsonPathScope === 'root' && allPaths.length > JSONPATH_GUARD_NODE_COUNT) {
        throw new Error(
          t('rootScopeTooLarge', { count: allPaths.length }),
        )
      }
      if (jsonPathScope === 'selected' && rightPathMap.size > JSONPATH_GUARD_NODE_COUNT) {
        const confirmed = window.confirm(
          t('selectedScopeMaybeSlow', { count: rightPathMap.size }),
        )
        if (!confirmed) {
          setActionMessage(t('canceledJsonPath'))
          return
        }
      }
      try {
        const result = JSONPath({
          path: jsonPathExpr,
          json: (jsonPathScope === 'root' ? rootValue : (selected as JsonValue)) as unknown as JsonPathInput,
          wrap: true,
        }) as unknown as JsonValue[]
        setJsonPathResult(result)
        setJsonPathError('')
        setActionMessage(
          t('jsonPathDone', {
            scope: jsonPathScope === 'root' ? t('global') : t('currentNode'),
            count: result.length,
          }),
        )
      } catch (error) {
        setJsonPathResult(null)
        const message = error instanceof Error ? error.message : t('jsonPathRunFailed')
        setJsonPathError(message)
        throw new Error(message)
      }
    })

  const copyText = async (content: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content)
        return
      } catch {
        // Ignore and fallback to execCommand.
      }
    }

    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    textarea.style.top = '0'
    textarea.style.left = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!copied) {
      throw new Error(t('clipboardBlocked'))
    }
  }

  const handleCopyJsonPathResult = async () => {
    if (!jsonPathResult) return
    const content = stringifyJson(jsonPathResult, 2)
    try {
      await copyText(content)
      setActionError('')
      setActionMessage(t('jsonPathCopied'))
    } catch (error) {
      setActionMessage('')
      setActionError(error instanceof Error ? error.message : t('copyFailed'))
    }
  }

  const handleCopyCurrentNode = async () => {
    if (!hasRightSelection) {
      setActionMessage('')
      setActionError(t('selectValidNodeFirst'))
      return
    }

    const content =
      rightViewMode === 'text'
        ? rightTextDraft
        : stringifyJson((rightSelectedValue as JsonValue) ?? null, 2)

    if (!content.trim()) {
      setActionMessage('')
      setActionError(t('contentEmptyCannotCopy'))
      return
    }

    try {
      await copyText(content)
      setActionError('')
      setActionMessage(t('contentCopied'))
    } catch (error) {
      setActionMessage('')
      setActionError(error instanceof Error ? error.message : t('copyFailed'))
    }
  }

  const applyLeftTextDraft = () => {
    setLeftTextError('')
    setActionMessage('')
    setActionError('')
    setJsonPathResult(null)
    setJsonPathError('')
    if (!leftTextDraft.trim()) {
      setSourceText('')
      setActionMessage(t('leftTextCleared'))
      return
    }
    try {
      const result = parseJsonSafely(leftTextDraft)
      if (result.parsed === undefined) {
        throw new Error(result.error || t('jsonParseFailedShort'))
      }
      setSourceText(leftTextDraft)
      setActionMessage(t('leftTextApplied'))
    } catch (error) {
      setLeftTextError(error instanceof Error ? error.message : t('jsonParseFailedShort'))
    }
  }

  const formatLeftTextDraft = () => {
    setLeftTextError('')
    setActionMessage('')
    setActionError('')
    if (!leftTextDraft.trim()) return
    try {
      const result = parseJsonSafely(leftTextDraft)
      if (result.parsed === undefined) {
        throw new Error(result.error || t('jsonParseFailedShort'))
      }
      const formatted = stringifyJson(result.parsed, 2)
      setLeftTextDraft(formatted)
      setActionMessage(t('leftTextFormatted'))
    } catch (error) {
      setLeftTextError(error instanceof Error ? error.message : t('jsonParseFailedShort'))
    }
  }

  const applyRightTextDraft = () => {
    if (!hasRightSelection || !rightLocalSelectedPath) {
      setRightTextError(t('selectValidNodeFirst'))
      return
    }
    setRightTextError('')
    setActionMessage('')
    setActionError('')
    setJsonPathResult(null)
    setJsonPathError('')
    try {
      const result = parseJsonSafely(rightTextDraft)
      if (result.parsed === undefined) {
        throw new Error(result.error || t('nodeJsonParseFailed'))
      }
      const nextValue = result.parsed
      if (activeSubview) {
        setSubviewStack((prev) => {
          if (prev.length === 0) return prev
          const next = [...prev]
          const topIndex = next.length - 1
          next[topIndex] = {
            ...next[topIndex],
            rootValue: updateValueAtPath(next[topIndex].rootValue, rightLocalSelectedPath, nextValue),
          }
          return next
        })
        setActionMessage(t('rightTextAppliedSubview'))
        return
      }

      if (!hasSelectedNode || !selectedPath || parsed === undefined) {
        throw new Error(t('selectValidNodeFirst'))
      }
      const absolutePath = mergePaths(selectedPath, rightLocalSelectedPath)
      const nextRoot = updateValueAtPath(parsed, absolutePath, nextValue)
      setSourceText(stringifyJson(nextRoot, 2))
      setActionMessage(t('rightTextAppliedCurrent'))
    } catch (error) {
      setRightTextError(error instanceof Error ? error.message : t('nodeJsonParseFailed'))
    }
  }

  const startPaneResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isRightPaneCollapsed) return
    event.preventDefault()
    const panesElement = panesRef.current
    if (!panesElement) return
    const rect = panesElement.getBoundingClientRect()
    if (rect.width <= 0) return

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextRatio = (moveEvent.clientX - rect.left) / rect.width
      const clamped = Math.min(1 - MIN_PANE_RATIO, Math.max(MIN_PANE_RATIO, nextRatio))
      setLeftPaneRatio(clamped)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.classList.remove('is-resizing-panes')
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    document.body.classList.add('is-resizing-panes')
  }

  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing-panes')
    }
  }, [])

  return (
    <main className={`workspace theme-${theme}`}>
      {/* <div className="locale-switch">
        <label htmlFor="locale-select">{t('localeLabel')}</label>
        <select
          id="locale-select"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div> */}
      {/* <header className="topbar">
        <div>
          <strong>JSON-Ext M3</strong>
          <span className="badge">{mode}</span>
        </div>
        <div className="topbar-source">
          Source URL: <span>{sourceUrl || 'N/A'}</span>
        </div>
      </header> */}

      {loadError ? <div className="error-banner">{loadError}</div> : null}

      <section className="panes" ref={panesRef}>
        <section
          className="pane pane-left"
          style={!isRightPaneCollapsed ? { flexGrow: leftPaneRatio, flexBasis: 0 } : undefined}
        >
          <h2>{t('workspaceTitle')}</h2>
          {mode !== 'intercept' ? (
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder={t('sourcePlaceholder')}
            />
          ) : null}
          {requiresLargeJsonApproval && !canParseSource ? (
            <div className="error-banner">
              <strong>{t('largeJsonGuardTitle')}</strong>
              <p>{t('largeJsonGuardDesc', { count: sourceText.length })}</p>
              <button type="button" onClick={() => setParseApprovalSignature(sourceParseSignature)}>
                {t('continueParseLargeJson')}
              </button>
            </div>
          ) : null}
          {isSourceDeferred ? <p className="muted">{t('parsingJson')}</p> : null}
          {error ? <p className="error-text">{t('jsonParseFailed', { error })}</p> : null}

          <div className="view-switch">
            <button
              type="button"
              className={leftViewMode === 'tree' ? 'active' : ''}
              onClick={() => setLeftViewMode('tree')}
            >
              {t('tree')}
            </button>
            <button
              type="button"
              className={leftViewMode === 'text' ? 'active' : ''}
              onClick={() => setLeftViewMode('text')}
            >
              {t('text')}
            </button>
            <button
              type="button"
              className={leftViewMode === 'table' ? 'active' : ''}
              onClick={() => setLeftViewMode('table')}
            >
              {t('table')}
            </button>
          </div>

          {leftViewMode === 'tree' ? (
            <div className="tree-panel" tabIndex={0} onKeyDown={onTreeKeyDown}>
              <div className="tree-header">
                <div className="tree-title-group">
                  <strong>{t('treeMode')}</strong>
                  <span className="tree-meta">
                    {t('visibleSummary', { visible: visibleNodeCount, total: totalNodeCount })}
                  </span>
                </div>
                <div className="tree-actions">
                  <button type="button" onClick={expandAll}>
                    {t('expandAll')}
                  </button>
                  <button type="button" onClick={collapseAll}>
                    {t('collapseAll')}
                  </button>
                </div>
              </div>
              <div className="tree-scroll">
                {!rootNode ? (
                  <p className="muted">{t('noSelectableNode')}</p>
                ) : (
                  <ul className="tree-list">
                    {renderTree(rootNode, {
                      selectedPath,
                      expandedPaths,
                      onSelect: setSelectedPath,
                      onToggle: togglePath,
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : leftViewMode === 'text' ? (
            <div className="text-editor">
              <textarea
                value={leftTextDraft}
                onChange={(event) => setLeftTextDraft(event.target.value)}
                placeholder={t('fullJsonEditorPlaceholder')}
              />
              <div className="text-editor-actions">
                <button type="button" onClick={formatLeftTextDraft}>
                  {t('format')}
                </button>
                <button type="button" onClick={applyLeftTextDraft}>
                  {t('applyToLeftSource')}
                </button>
              </div>
              {leftTextError ? <p className="error-text">{t('leftTextError', { error: leftTextError })}</p> : null}
            </div>
          ) : (
            renderTable(parsed ?? null, 'left', {
              enableImagePreview: false,
              enableLatexPreview: false,
              enableLinkOpening: false,
            })
          )}
        </section>

        {!isRightPaneCollapsed ? (
          <>
            <div
              className="pane-resizer"
              role="separator"
              aria-label={t('resizePanes')}
              aria-orientation="vertical"
              onMouseDown={startPaneResize}
            />
            <section className="pane pane-right" style={{ flexGrow: 1 - leftPaneRatio, flexBasis: 0 }}>
              <div className="pane-title-row">
                <h2>{t('nodeDetail')}</h2>
                <button type="button" className="pane-collapse-btn" onClick={() => setIsRightPaneCollapsed(true)}>
                  {t('collapse')}
                </button>
              </div>
              {!hasRightRoot ? (
                <p className="muted">{t('selectLeftNodeHint')}</p>
              ) : (
                <div className="detail">
              <div className="detail-item">
                <div className="subview-breadcrumbs">
                  <button
                    type="button"
                    className={subviewStack.length === 0 ? 'active' : ''}
                    onClick={() => setSubviewStack([])}
                  >
                    {t('mainView')}
                  </button>
                  {subviewStack.map((frame, index) => (
                    <button
                      key={frame.id}
                      type="button"
                      className={index === subviewStack.length - 1 ? 'active' : ''}
                      onClick={() => setSubviewStack((prev) => prev.slice(0, index + 1))}
                    >
                      {frame.title}
                    </button>
                  ))}
                </div>
                {/* <span>{rightContextLabel}</span> */}
                <code data-testid="right-active-path">{rightSelectedAbsolutePath}</code>
              </div>
              <div className="view-switch">
                <button
                  type="button"
                  className={rightViewMode === 'tree' ? 'active' : ''}
                  onClick={() => setRightViewMode('tree')}
                >
                  {t('tree')}
                </button>
                <button
                  type="button"
                  className={rightViewMode === 'text' ? 'active' : ''}
                  onClick={() => setRightViewMode('text')}
                >
                  {t('text')}
                </button>
                <button
                  type="button"
                  className={rightViewMode === 'table' ? 'active' : ''}
                  onClick={() => setRightViewMode('table')}
                >
                  {t('table')}
                </button>
                {rightViewMode === 'table' ? (
                  <label className="table-enhance-switch">
                    <input
                      type="checkbox"
                      checked={enableLatexPreview}
                      onChange={(event) => setEnableLatexPreview(event.target.checked)}
                    />
                    {t('latexRender')}
                  </label>
                ) : null}
                <div className="ops ops-inline">
                  <button type="button" onClick={() => void handleCopyCurrentNode()}>
                    {t('oneClickCopy')}
                  </button>
                  {rightViewMode === 'text' ? (
                    <button type="button" onClick={handleFormat}>
                      {t('format')}
                    </button>
                  ) : null}
                  {rightViewMode === 'text' ? (
                    <button type="button" onClick={handleMinify}>
                      {t('minify')}
                    </button>
                  ) : null}
                  {rightViewMode === 'text' ? (
                    <button type="button" onClick={handleEscape}>
                      {t('escape')}
                    </button>
                  ) : null}
                  {rightViewMode === 'text' ? (
                    <button type="button" onClick={handleUnescape}>
                      {t('unescape')}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="detail-main">
                {rightViewMode === 'tree' ? (
                  <div className="tree-panel">
                    <div className="tree-header">
                      <div className="tree-title-group">
                        <strong>{activeSubview ? t('subviewTree') : t('nodeSubtree')}</strong>
                      </div>
                      <div className="tree-actions">
                        <button type="button" onClick={expandAllRight}>
                          {t('expandAll')}
                        </button>
                        <button type="button" onClick={collapseAllRight}>
                          {t('collapseAll')}
                        </button>
                      </div>
                    </div>
                    <div className="tree-scroll">
                      {rightRootNode ? (
                        <ul className="tree-list">
                          {renderTree(rightRootNode, {
                            selectedPath: rightLocalSelectedPath,
                            expandedPaths: rightExpandedPaths,
                            onSelect: setRightLocalSelectedPath,
                            onToggle: toggleRightPath,
                          })}
                        </ul>
                      ) : (
                        <p className="muted">{t('noData')}</p>
                      )}
                    </div>
                  </div>
                ) : rightViewMode === 'text' ? (
                  <div className="text-editor text-editor-fill">
                    <textarea
                      value={rightTextDraft}
                      onChange={(event) => setRightTextDraft(event.target.value)}
                      placeholder={t('currentNodeEditorPlaceholder')}
                    />
                    <div className="text-editor-actions">
                      <button type="button" onClick={applyRightTextDraft}>
                        {t('applyToCurrentNode')}
                      </button>
                    </div>
                    {rightTextError ? <p className="error-text">{t('rightTextError', { error: rightTextError })}</p> : null}
                  </div>
                ) : (
                  renderTable((rightSelectedValue as JsonValue) ?? null, `right:${activeSubview?.id ?? rightContextPath}`, {
                    enableImagePreview: true,
                    enableLatexPreview,
                    enableLinkOpening: true,
                  })
                )}
              </div>
              {actionMessage ? <p className="success-text">{actionMessage}</p> : null}
              {actionError ? <p className="error-text">{actionError}</p> : null}
              <div className={`jsonpath ${isJsonPathCollapsed ? 'collapsed' : ''}`}>
                <button
                  type="button"
                  className="jsonpath-toggle"
                  onClick={() => setIsJsonPathCollapsed((prev) => !prev)}
                  aria-expanded={!isJsonPathCollapsed}
                >
                  <span>JSONPath</span>
                  <span>{isJsonPathCollapsed ? '▾' : '▴'}</span>
                </button>
                <div className="scope-switch">
                  <button
                    type="button"
                    className={jsonPathScope === 'selected' ? 'active' : ''}
                    onClick={() => setJsonPathScope('selected')}
                  >
                    {t('currentNode')}
                  </button>
                  <button
                    type="button"
                    className={jsonPathScope === 'root' ? 'active' : ''}
                    onClick={() => setJsonPathScope('root')}
                  >
                    {t('global')}
                  </button>
                </div>
                <div className="jsonpath-inputs">
                  <input
                    value={jsonPathExpr}
                    onChange={(event) => setJsonPathExpr(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleJsonPath()
                      }
                    }}
                    placeholder={t('jsonPathPlaceholder')}
                  />
                  <button type="button" onClick={handleJsonPath}>
                    {t('execute')}
                  </button>
                  <button type="button" onClick={() => void handleCopyJsonPathResult()}>
                    {t('copyResult')}
                  </button>
                </div>
                {jsonPathError ? <p className="error-text">{t('jsonPathError', { error: jsonPathError })}</p> : null}
                {jsonPathResult ? (
                  <div className="jsonpath-result">
                    {jsonPathResult.length === 0 ? (
                      <p className="muted">{t('jsonPathNoMatch')}</p>
                    ) : (
                      <pre>{stringifyJson(jsonPathResult, 2)}</pre>
                    )}
                  </div>
                ) : null}
              </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <button
            type="button"
            className="pane-expand-right-btn"
            onClick={() => setIsRightPaneCollapsed(false)}
            aria-label={t('expandRightPane')}
            title={t('expandRightPane')}
          >
            ◂
          </button>
        )}
      </section>
    </main>
  )
}

export default App
