export type Locale = 'zh' | 'en'
export type ThemeMode = 'system' | 'light' | 'dark'

const LOCALE_STORAGE_KEY = 'json-ext-locale'
const THEME_STORAGE_KEY = 'json-ext-theme'

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    localeName: '中文',
    localeLabel: '语言',
    themeLabel: '主题',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '暗色',
    workspaceTitle: '源 JSON',
    sourcePlaceholder: '在此输入 JSON，或通过 JSON 链接自动接管...',
    parsingJson: '正在解析输入中的 JSON...',
    jsonParseFailed: 'JSON 解析失败：{{error}}',
    tree: '树形',
    text: '文本',
    table: '表格',
    treeMode: '树形图模式',
    visibleSummary: '可见 {{visible}} / 总计 {{total}}',
    expandAll: '展开全部',
    collapseAll: '折叠全部',
    noSelectableNode: '无可选节点（请先输入合法 JSON）',
    fullJsonEditorPlaceholder: '编辑完整 JSON 后点击应用',
    format: '格式化',
    applyToLeftSource: '应用到左侧源 JSON',
    leftTextError: '左侧文本错误：{{error}}',
    resizePanes: '调整左右面板宽度',
    nodeDetail: '节点详情',
    collapse: '收起',
    selectLeftNodeHint: '请选择左侧节点查看详情。',
    mainView: '主视图',
    latexRender: 'LaTeX 公式渲染',
    oneClickCopy: '一键复制',
    minify: '压缩',
    escape: '转义',
    unescape: '反转义',
    subviewTree: '子视图树',
    nodeSubtree: '节点子树',
    noData: '无可展示数据。',
    currentNodeEditorPlaceholder: '编辑当前节点 JSON 后点击应用',
    applyToCurrentNode: '应用修改到当前节点',
    rightTextError: '右侧文本错误：{{error}}',
    currentNode: '当前节点',
    global: '全局',
    jsonPathPlaceholder: '输入 JSONPath，例如 $..id',
    execute: '执行',
    copyResult: '复制结果',
    jsonPathError: 'JSONPath 错误：{{error}}',
    jsonPathNoMatch: 'JSONPath 执行成功，但无匹配结果。',
    expandRightPane: '展开右侧面板',
    foldNode: '折叠节点',
    expandNode: '展开节点',
    emptyArray: '空数组 []',
    emptyObject: '空对象 {}',
    imagePreview: '图片预览',
    toggleNode: '切换 {{nodeKey}}',
    actionFailed: '操作失败',
    selectValidNodeFirst: '请先选择有效节点。',
    rightTextEmpty: '右侧文本为空。',
    rightTextFormatted: '右侧文本格式化完成。',
    rightTextMinified: '右侧文本压缩完成。',
    escapeOnlyString: '转义仅支持字符串类型的右侧文本。',
    rightTextEscaped: '右侧文本转义完成。',
    unescapeOnlyString: '反转义仅支持字符串类型的右侧文本。',
    rightTextUnescaped: '右侧文本反转义完成。',
    subviewDepthLimit: '子视图层级已达上限（{{depth}} 层）。',
    subviewTitle: '子视图 {{index}}',
    rightTextUnescapedEnterSubview: '右侧文本反转义完成，并已进入子视图。',
    invalidJsonForJsonPath: '当前 JSON 无法解析，无法执行 JSONPath。',
    selectNodeOrGlobalScope: '请先选择有效节点，或切换到全局作用域。',
    inputJsonPathExpr: '请输入 JSONPath 表达式。',
    rootScopeTooLarge:
      '当前全局节点量约 {{count}}，请先切换到“当前节点”缩小范围后再执行 JSONPath。',
    selectedScopeMaybeSlow: '当前节点子树规模约 {{count}}，执行 JSONPath 可能耗时较长。是否继续？',
    canceledJsonPath: '已取消 JSONPath 执行。',
    jsonPathDone: 'JSONPath 执行完成（{{scope}}），命中 {{count}} 条。',
    jsonPathRunFailed: 'JSONPath 执行失败',
    clipboardBlocked: '当前页面限制了剪贴板访问，请手动复制。',
    jsonPathCopied: 'JSONPath 结果已复制。',
    copyFailed: '复制失败',
    contentEmptyCannotCopy: '当前内容为空，无法复制。',
    contentCopied: '当前内容已复制。',
    leftTextCleared: '左侧文本已清空。',
    leftTextApplied: '左侧文本已应用到源 JSON。',
    jsonParseFailedShort: 'JSON 解析失败',
    leftTextFormatted: '左侧文本格式化完成。',
    rightTextAppliedSubview: '右侧文本已应用到子视图节点。',
    rightTextAppliedCurrent: '右侧文本已应用到当前节点。',
    nodeJsonParseFailed: '节点 JSON 解析失败',
    loadJsonFailed: '自动拉取 JSON 失败，请确认接口可访问后重试。',
    noInterceptData: '未找到拦截数据，请刷新目标 JSON 链接后重试。',
    readInterceptFailed: '读取拦截数据失败，请重试。',
    expandAllConfirm: '当前节点总数约 {{count}}，展开全部可能造成明显卡顿。是否继续展开？',
    canceledExpandAll: '已取消展开全部。',
    cancelJsonPathConfirm: '已取消 JSONPath 执行。',
    largeJsonGuardTitle: '检测到超大 JSON，已暂停自动解析。',
    largeJsonGuardDesc:
      '当前内容长度约 {{count}} 字符。为避免页面卡死与白屏，默认不自动建树；点击下方按钮后继续。',
    continueParseLargeJson: '继续解析（可能较慢）',
    keyCount: '{{count}} keys',
    itemCount: '{{count}} items',
    popupDescription: '打开独立工作区来编辑和分析 JSON。',
    openWorkspace: '打开工作区',
    valueLabel: 'value',
    valuePreviewAlt: '值预览',
    showTime: '时间',
    showTimestamp: '时间戳',
  },
  en: {
    localeName: 'English',
    localeLabel: 'Language',
    themeLabel: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    workspaceTitle: 'Source JSON',
    sourcePlaceholder: 'Paste JSON here, or auto-load from a JSON URL...',
    parsingJson: 'Parsing JSON input...',
    jsonParseFailed: 'JSON parse failed: {{error}}',
    tree: 'Tree',
    text: 'Text',
    table: 'Table',
    treeMode: 'Tree Mode',
    visibleSummary: 'Visible {{visible}} / Total {{total}}',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    noSelectableNode: 'No selectable nodes (please input valid JSON first)',
    fullJsonEditorPlaceholder: 'Edit full JSON and click apply',
    format: 'Format',
    applyToLeftSource: 'Apply To Source JSON',
    leftTextError: 'Left text error: {{error}}',
    resizePanes: 'Resize left and right panes',
    nodeDetail: 'Node Details',
    collapse: 'Collapse',
    selectLeftNodeHint: 'Select a node on the left to view details.',
    mainView: 'Main View',
    latexRender: 'Render LaTeX',
    oneClickCopy: 'Copy',
    minify: 'Minify',
    escape: 'Escape',
    unescape: 'Unescape',
    subviewTree: 'Subview Tree',
    nodeSubtree: 'Node Subtree',
    noData: 'No data to display.',
    currentNodeEditorPlaceholder: 'Edit selected node JSON and click apply',
    applyToCurrentNode: 'Apply To Current Node',
    rightTextError: 'Right text error: {{error}}',
    currentNode: 'Current Node',
    global: 'Global',
    jsonPathPlaceholder: 'Input JSONPath, e.g. $..id',
    execute: 'Run',
    copyResult: 'Copy Result',
    jsonPathError: 'JSONPath error: {{error}}',
    jsonPathNoMatch: 'JSONPath executed successfully, but no matches were found.',
    expandRightPane: 'Expand right pane',
    foldNode: 'Collapse node',
    expandNode: 'Expand node',
    emptyArray: 'Empty array []',
    emptyObject: 'Empty object {}',
    imagePreview: 'Image Preview',
    toggleNode: 'Toggle {{nodeKey}}',
    actionFailed: 'Action failed',
    selectValidNodeFirst: 'Please select a valid node first.',
    rightTextEmpty: 'Right-side text is empty.',
    rightTextFormatted: 'Right-side text formatted.',
    rightTextMinified: 'Right-side text minified.',
    escapeOnlyString: 'Escape only supports string values in right-side text.',
    rightTextEscaped: 'Right-side text escaped.',
    unescapeOnlyString: 'Unescape only supports string values in right-side text.',
    rightTextUnescaped: 'Right-side text unescaped.',
    subviewDepthLimit: 'Subview depth limit reached ({{depth}} levels).',
    subviewTitle: 'Subview {{index}}',
    rightTextUnescapedEnterSubview: 'Right-side text unescaped and entered subview.',
    invalidJsonForJsonPath: 'Current JSON is invalid, JSONPath cannot run.',
    selectNodeOrGlobalScope: 'Select a valid node first, or switch to global scope.',
    inputJsonPathExpr: 'Please input a JSONPath expression.',
    rootScopeTooLarge:
      'Global node count is around {{count}}. Switch to "Current Node" scope before running JSONPath.',
    selectedScopeMaybeSlow:
      'Current node subtree size is around {{count}}. Running JSONPath may be slow. Continue?',
    canceledJsonPath: 'JSONPath execution canceled.',
    jsonPathDone: 'JSONPath done ({{scope}}), matched {{count}} items.',
    jsonPathRunFailed: 'JSONPath execution failed',
    clipboardBlocked: 'Clipboard access is blocked on this page. Please copy manually.',
    jsonPathCopied: 'JSONPath result copied.',
    copyFailed: 'Copy failed',
    contentEmptyCannotCopy: 'Current content is empty and cannot be copied.',
    contentCopied: 'Current content copied.',
    leftTextCleared: 'Left-side text cleared.',
    leftTextApplied: 'Left-side text applied to source JSON.',
    jsonParseFailedShort: 'JSON parse failed',
    leftTextFormatted: 'Left-side text formatted.',
    rightTextAppliedSubview: 'Right-side text applied to subview node.',
    rightTextAppliedCurrent: 'Right-side text applied to current node.',
    nodeJsonParseFailed: 'Node JSON parse failed',
    loadJsonFailed: 'Auto-fetch JSON failed. Please ensure the endpoint is reachable and retry.',
    noInterceptData: 'Intercepted data not found. Refresh the target JSON URL and retry.',
    readInterceptFailed: 'Failed to read intercepted data. Please retry.',
    expandAllConfirm: 'Current node count is around {{count}}. Expand all may cause lag. Continue?',
    canceledExpandAll: 'Expand all canceled.',
    cancelJsonPathConfirm: 'JSONPath execution canceled.',
    largeJsonGuardTitle: 'Very large JSON detected. Auto-parse is paused.',
    largeJsonGuardDesc:
      'Current payload is about {{count}} characters. To avoid freezing and blank screens, tree building is paused by default.',
    continueParseLargeJson: 'Continue Parsing (May Be Slow)',
    keyCount: '{{count}} keys',
    itemCount: '{{count}} items',
    popupDescription: 'Open a standalone workspace for editing and analyzing JSON.',
    openWorkspace: 'Open Workspace',
    valueLabel: 'value',
    valuePreviewAlt: 'value preview',
    showTime: 'Time',
    showTimestamp: 'Timestamp',
  },
}

function normalizeLocale(value: string | null | undefined): Locale {
  if (value === 'zh' || value === 'en') return value
  return 'zh'
}

function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  if (value === 'system' || value === 'light' || value === 'dark') return value
  return 'system'
}

export function getInitialLocale(): Locale {
  try {
    const saved = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
    if (saved) return saved
  } catch {
    // Ignore unavailable storage.
  }
  return 'zh'
}

export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Ignore unavailable storage.
  }
}

export function getInitialThemeMode(): ThemeMode {
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function persistThemeMode(themeMode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  } catch {
    // Ignore unavailable storage.
  }
}

export function createTranslator(locale: Locale) {
  const dict = messages[locale]
  return (key: keyof (typeof messages)['zh'], vars?: Record<string, string | number>) => {
    let template = dict[key] ?? messages.zh[key] ?? String(key)
    if (!vars) return template
    Object.entries(vars).forEach(([name, value]) => {
      template = template.replaceAll(`{{${name}}}`, String(value))
    })
    return template
  }
}
