import { describe, expect, it } from 'vitest'
import { createTranslator } from './i18n'

describe('i18n settings labels', () => {
  it('translates default view mode settings in Chinese and English', () => {
    const zh = createTranslator('zh') as (key: string) => string
    const en = createTranslator('en') as (key: string) => string

    expect(zh('leftDefaultViewModeLabel')).toBe('左侧默认模式')
    expect(zh('rightDefaultViewModeLabel')).toBe('右侧默认模式')
    expect(en('leftDefaultViewModeLabel')).toBe('Left default view')
    expect(en('rightDefaultViewModeLabel')).toBe('Right default view')
  })
})
