import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

function inputJson(text: string) {
  const textarea = screen.getByPlaceholderText('在此输入 JSON，或通过 JSON 链接自动接管...')
  fireEvent.change(textarea, { target: { value: text } })
}

function clickTreeKey(key: string) {
  const keyNode = screen.getByText(key)
  const labelButton = keyNode.closest('button')
  if (!labelButton) throw new Error(`未找到 key=${key} 对应按钮`)
  fireEvent.click(labelButton)
}

function clickTreeToggleByKey(key: string) {
  const keyNode = screen.getByText(key)
  const row = keyNode.closest('.tree-row')
  const toggle = row?.querySelector<HTMLButtonElement>('.tree-toggle')
  if (!toggle) throw new Error(`未找到 key=${key} 的展开按钮`)
  fireEvent.click(toggle)
}

function getCurrentPathText() {
  const code = screen.getByTestId('right-active-path')
  return code.textContent ?? ''
}

describe('App M3 interactions', () => {
  it('left selection drives right detail path and value', () => {
    render(<App />)
    inputJson('{"a":{"b":1},"x":2}')

    clickTreeKey('a')

    expect(getCurrentPathText()).toBe('$.a')
    const rightEditor = screen.getByPlaceholderText('编辑当前节点 JSON 后点击应用') as HTMLTextAreaElement
    expect(rightEditor.value).toContain('"b": 1')
  })

  it('shows empty object and empty array hints when expanded', () => {
    render(<App />)
    inputJson('{"emptyObj":{},"emptyArr":[]}')

    clickTreeToggleByKey('emptyObj')
    clickTreeToggleByKey('emptyArr')

    expect(screen.getByText('空对象 {}')).toBeTruthy()
    expect(screen.getByText('空数组 []')).toBeTruthy()
  })

  it('supports keyboard navigation with arrow keys', () => {
    render(<App />)
    inputJson('{"a":{"b":1},"c":2}')

    const panel = screen.getByText('树形图模式').closest('.tree-panel') as HTMLElement | null
    if (!panel) throw new Error('tree panel 未找到')
    panel.focus()

    fireEvent.keyDown(panel, { key: 'ArrowDown' })
    expect(getCurrentPathText()).toBe('$.a')

    fireEvent.keyDown(panel, { key: 'ArrowRight' })
    expect(getCurrentPathText()).toBe('$.a.b')

    fireEvent.keyDown(panel, { key: 'ArrowLeft' })
    expect(getCurrentPathText()).toBe('$.a')

    const rightEditor = screen.getByPlaceholderText('编辑当前节点 JSON 后点击应用') as HTMLTextAreaElement
    expect(rightEditor.value).toContain('"b": 1')
  })

  it('keeps selected path while switching right view modes', () => {
    render(<App />)
    inputJson('{"a":{"b":1},"c":2}')

    clickTreeKey('a')
    expect(getCurrentPathText()).toBe('$.a')

    fireEvent.click(screen.getAllByText('表格')[1])
    expect(getCurrentPathText()).toBe('$.a')

    fireEvent.click(screen.getAllByText('文本')[1])
    expect(getCurrentPathText()).toBe('$.a')
  })

  it('supports right-side local node selection in detail tree', () => {
    render(<App />)
    inputJson('{"a":{"b":1},"c":2}')
    clickTreeKey('a')
    expect(getCurrentPathText()).toBe('$.a')

    fireEvent.click(screen.getAllByText('树形')[1])
    const rightTreePanel = screen.getByText('节点子树').closest('.tree-panel') as HTMLElement | null
    if (!rightTreePanel) throw new Error('右侧树面板未找到')

    const keyNode = within(rightTreePanel).getByText('b')
    const labelButton = keyNode.closest('button')
    if (!labelButton) throw new Error('右侧子节点按钮未找到')
    fireEvent.click(labelButton)

    expect(getCurrentPathText()).toBe('$.a.b')
  })

  it('renders nested table layout for object and object-array values', () => {
    render(<App />)
    inputJson(
      '{"code":0,"message":"ok","data":{"users":[{"id":1,"name":"Alice","role":"admin","active":true,"score":98.5},{"id":2,"name":"Bob","role":"editor","active":false,"score":88.2}],"meta":{"total":2,"traceId":"a8cd-9f10-22bb"}}}',
    )

    fireEvent.click(screen.getAllByText('表格')[0])

    expect(screen.getByText('users')).toBeTruthy()
    expect(screen.getByText('meta')).toBeTruthy()
    expect(screen.getByText('Array[2]')).toBeTruthy()
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('traceId')).toBeTruthy()
  })

  it('supports collapsing and expanding nested table blocks', () => {
    render(<App />)
    inputJson(
      '{"code":0,"message":"ok","data":{"users":[{"id":1,"name":"Alice"}],"meta":{"total":1,"traceId":"x"}}}',
    )

    fireEvent.click(screen.getAllByText('表格')[0])
    expect(screen.getByText('Alice')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('切换 left:$.data.users'))
    expect(screen.queryByText('Alice')).toBeNull()

    fireEvent.click(screen.getByLabelText('切换 left:$.data.users'))
    expect(screen.getByText('Alice')).toBeTruthy()
  })

  it('runs JSONPath and shows expression errors', () => {
    render(<App />)
    inputJson('{"users":[{"id":1},{"id":2}]}')

    clickTreeKey('users')
    fireEvent.change(screen.getByPlaceholderText('输入 JSONPath，例如 $..id'), {
      target: { value: '$..id' },
    })
    fireEvent.click(screen.getByText('执行'))
    expect(screen.getByText(/命中 2 条/)).toBeTruthy()
    expect(screen.getByText(/\[\s*1,\s*2\s*\]/)).toBeTruthy()
    expect(screen.getByText('复制结果')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('输入 JSONPath，例如 $..id'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByText('执行'))
    expect(screen.getByText(/请输入 JSONPath 表达式/)).toBeTruthy()
  })

  it('runs JSONPath when pressing Enter in input', () => {
    render(<App />)
    inputJson('{"users":[{"id":1},{"id":2}]}')

    clickTreeKey('users')
    const input = screen.getByPlaceholderText('输入 JSONPath，例如 $..id')
    fireEvent.change(input, { target: { value: '$..id' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(screen.getByText(/命中 2 条/)).toBeTruthy()
    expect(screen.getByText(/\[\s*1,\s*2\s*\]/)).toBeTruthy()
  })

  it('copies JSONPath result by one click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<App />)
    inputJson('{"users":[{"id":1},{"id":2}]}')
    clickTreeKey('users')
    fireEvent.change(screen.getByPlaceholderText('输入 JSONPath，例如 $..id'), {
      target: { value: '$..id' },
    })
    fireEvent.click(screen.getByText('执行'))

    fireEvent.click(screen.getByText('复制结果'))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('[\n  1,\n  2\n]')
    })
  })

  it('applies left text editor content to source json', () => {
    render(<App />)
    inputJson('{"a":1}')

    fireEvent.click(screen.getAllByText('文本')[0])
    const leftEditor = screen.getByPlaceholderText('编辑完整 JSON 后点击应用')
    fireEvent.change(leftEditor, { target: { value: '{"a":2,"b":{"c":3}}' } })
    fireEvent.click(screen.getByText('应用到左侧源 JSON'))

    const source = screen.getByPlaceholderText('在此输入 JSON，或通过 JSON 链接自动接管...') as HTMLTextAreaElement
    expect(source.value).toContain('"b":{"c":3}')
  })

  it('formats left text editor content', () => {
    render(<App />)
    inputJson('{"a":1}')

    fireEvent.click(screen.getAllByText('文本')[0])
    const leftEditor = screen.getByPlaceholderText('编辑完整 JSON 后点击应用') as HTMLTextAreaElement
    fireEvent.change(leftEditor, { target: { value: '{"a":1,"b":{"c":2}}' } })
    fireEvent.click(screen.getAllByText('格式化')[0])

    expect(leftEditor.value).toContain('\n  "a": 1,')
    expect(leftEditor.value).toContain('\n  "b": {\n    "c": 2\n  }\n')
  })

  it('applies right text editor content to selected node', () => {
    render(<App />)
    inputJson('{"a":{"b":1},"c":2}')
    clickTreeKey('a')

    const rightEditor = screen.getByPlaceholderText('编辑当前节点 JSON 后点击应用')
    fireEvent.change(rightEditor, { target: { value: '{"b":3,"d":4}' } })
    fireEvent.click(screen.getByText('应用修改到当前节点'))

    const source = screen.getByPlaceholderText('在此输入 JSON，或通过 JSON 链接自动接管...') as HTMLTextAreaElement
    expect(source.value).toContain('"b": 3')
    expect(source.value).toContain('"d": 4')
    expect(getCurrentPathText()).toBe('$.a')
  })

  it('keeps source json unchanged when using right-side format/minify buttons', () => {
    render(<App />)
    inputJson('{"a":{"b":1,"c":2},"k":3}')
    clickTreeKey('a')

    const source = screen.getByPlaceholderText('在此输入 JSON，或通过 JSON 链接自动接管...') as HTMLTextAreaElement
    const rightEditor = screen.getByPlaceholderText('编辑当前节点 JSON 后点击应用') as HTMLTextAreaElement
    expect(source.value).toBe('{"a":{"b":1,"c":2},"k":3}')

    fireEvent.click(screen.getByText('压缩'))
    expect(rightEditor.value).toBe('{"b":1,"c":2}')
    expect(source.value).toBe('{"a":{"b":1,"c":2},"k":3}')

    fireEvent.click(screen.getByText('格式化'))
    expect(rightEditor.value).toContain('\n  "b": 1,')
    expect(source.value).toBe('{"a":{"b":1,"c":2},"k":3}')
  })

  it('supports JSONPath scope switching between selected and root', () => {
    render(<App />)
    inputJson('{"users":[{"id":1}],"meta":{"id":9}}')
    clickTreeKey('users')

    fireEvent.change(screen.getByPlaceholderText('输入 JSONPath，例如 $..id'), {
      target: { value: '$.meta.id' },
    })
    fireEvent.click(screen.getByText('执行'))
    expect(screen.getByText('JSONPath 执行成功，但无匹配结果。')).toBeTruthy()

    fireEvent.click(screen.getByText('全局'))
    fireEvent.click(screen.getByText('执行'))
    expect(screen.getByText(/执行完成（全局）/)).toBeTruthy()
    expect(screen.getByText(/\[\s*9\s*\]/)).toBeTruthy()
  })

  it('supports recursive subview enter and breadcrumb back', () => {
    render(<App />)
    inputJson('{"payload":"{\\"id\\":1,\\"nested\\":\\"{\\\\\\"code\\\\\\":200}\\"}"}')
    clickTreeKey('payload')

    fireEvent.click(screen.getByText('反转义'))
    expect(screen.getByRole('button', { name: '子视图 1' })).toBeTruthy()
    expect(getCurrentPathText()).toBe('$')

    fireEvent.click(screen.getAllByText('树形')[1])
    const rightTreePanel = screen.getByText('子视图树').closest('.tree-panel') as HTMLElement | null
    if (!rightTreePanel) throw new Error('子视图树面板未找到')
    const nestedKey = within(rightTreePanel).getByText('nested')
    const nestedBtn = nestedKey.closest('button')
    if (!nestedBtn) throw new Error('nested 节点按钮未找到')
    fireEvent.click(nestedBtn)
    expect(getCurrentPathText()).toBe('$.nested')

    fireEvent.click(screen.getAllByText('文本')[1])
    fireEvent.click(screen.getByText('反转义'))
    expect(screen.getByRole('button', { name: '子视图 2' })).toBeTruthy()
    expect(getCurrentPathText()).toBe('$')

    fireEvent.click(screen.getByRole('button', { name: '子视图 1' }))
    expect(screen.queryByText('子视图 2')).toBeNull()
    expect(getCurrentPathText()).toBe('$')

    fireEvent.click(screen.getByRole('button', { name: '主视图' }))
    expect(screen.queryByText('子视图 1')).toBeNull()
    expect(getCurrentPathText()).toBe('$.payload')
  })
})
