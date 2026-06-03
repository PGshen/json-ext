/// <reference types="chrome" />

import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createTranslator,
  getInitialLeftDefaultViewMode,
  getInitialLocale,
  getInitialRightDefaultViewMode,
  getInitialThemeMode,
  persistLeftDefaultViewMode,
  persistLocale,
  persistRightDefaultViewMode,
  persistThemeMode,
  type JsonViewMode,
  type Locale,
  type ThemeMode,
} from './i18n'
import './popup.css'

export function Popup() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale())
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode())
  const [leftDefaultViewMode, setLeftDefaultViewMode] = useState<JsonViewMode>(getInitialLeftDefaultViewMode())
  const [rightDefaultViewMode, setRightDefaultViewMode] = useState<JsonViewMode>(getInitialRightDefaultViewMode())
  const t = useMemo(() => createTranslator(locale), [locale])

  useEffect(() => {
    persistLocale(locale)
  }, [locale])

  useEffect(() => {
    persistThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    persistLeftDefaultViewMode(leftDefaultViewMode)
  }, [leftDefaultViewMode])

  useEffect(() => {
    persistRightDefaultViewMode(rightDefaultViewMode)
  }, [rightDefaultViewMode])

  const openStandalone = () => {
    const url = `${chrome.runtime.getURL('index.html')}?mode=standalone`
    window.open(url, '_blank', 'noopener')
    window.close()
  }

  return (
    <main className="popup">
      <header className="popup-header">
        <h1>JSON-Ext</h1>
        <p>{t('popupDescription')}</p>
      </header>
      <section className="popup-settings">
        <div className="popup-field">
          <label htmlFor="popup-locale-select">{t('localeLabel')}</label>
          <select
            id="popup-locale-select"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="popup-field">
          <label htmlFor="popup-theme-select">{t('themeLabel')}</label>
          <select
            id="popup-theme-select"
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
          >
            <option value="system">{t('themeSystem')}</option>
            <option value="light">{t('themeLight')}</option>
            <option value="dark">{t('themeDark')}</option>
          </select>
        </div>
        <div className="popup-field">
          <label htmlFor="popup-left-view-select">{t('leftDefaultViewModeLabel')}</label>
          <select
            id="popup-left-view-select"
            value={leftDefaultViewMode}
            onChange={(event) => setLeftDefaultViewMode(event.target.value as JsonViewMode)}
          >
            <option value="tree">{t('tree')}</option>
            <option value="text">{t('text')}</option>
            <option value="table">{t('table')}</option>
          </select>
        </div>
        <div className="popup-field">
          <label htmlFor="popup-right-view-select">{t('rightDefaultViewModeLabel')}</label>
          <select
            id="popup-right-view-select"
            value={rightDefaultViewMode}
            onChange={(event) => setRightDefaultViewMode(event.target.value as JsonViewMode)}
          >
            <option value="tree">{t('tree')}</option>
            <option value="text">{t('text')}</option>
            <option value="table">{t('table')}</option>
          </select>
        </div>
      </section>
      <button className="popup-primary" type="button" onClick={openStandalone}>
        {t('openWorkspace')}
      </button>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Popup />)
