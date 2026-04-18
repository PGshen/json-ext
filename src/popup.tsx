/// <reference types="chrome" />

import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createTranslator,
  getInitialLocale,
  getInitialThemeMode,
  persistLocale,
  persistThemeMode,
  type Locale,
  type ThemeMode,
} from './i18n'
import './popup.css'

export function Popup() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale())
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode())
  const t = useMemo(() => createTranslator(locale), [locale])

  useEffect(() => {
    persistLocale(locale)
  }, [locale])

  useEffect(() => {
    persistThemeMode(themeMode)
  }, [themeMode])

  const openStandalone = () => {
    const url = `${chrome.runtime.getURL('index.html')}?mode=standalone`
    chrome.tabs.create({ url })
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
      </section>
      <button className="popup-primary" type="button" onClick={openStandalone}>
        {t('openWorkspace')}
      </button>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Popup />)
