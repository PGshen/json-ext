/// <reference types="chrome" />

import { createRoot } from 'react-dom/client'
import './popup.css'

export function Popup() {
  const openStandalone = () => {
    const url = `${chrome.runtime.getURL('index.html')}?mode=standalone`
    chrome.tabs.create({ url })
    window.close()
  }

  return (
    <main className="popup">
      <h1>JSON-Ext</h1>
      <p>Open a standalone workspace for editing and analyzing JSON.</p>
      <button type="button" onClick={openStandalone}>
        Open Workspace
      </button>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Popup />)
