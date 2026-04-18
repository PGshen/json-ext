/// <reference types="chrome" />

const MIN_JSON_LENGTH = 2
const OVERLAY_ROOT_ID = '__json_ext_overlay_root__'
const OVERLAY_STYLE_ID = '__json_ext_overlay_style__'
const QUERY_MODE_INTERCEPT = 'intercept'

function tryGetJsonTextFromPage() {
  if (window.top !== window) {
    return null
  }

  const contentType = document.contentType.toLowerCase()
  const pageText = document.body?.innerText?.trim()

  if (!pageText || pageText.length < MIN_JSON_LENGTH) {
    return null
  }

  const looksLikeJsonByType =
    contentType.includes('application/json') || contentType.includes('text/json')
  const looksLikeJsonByContent =
    (pageText.startsWith('{') && pageText.endsWith('}')) ||
    (pageText.startsWith('[') && pageText.endsWith(']'))

  if (!looksLikeJsonByType && !looksLikeJsonByContent) {
    return null
  }

  try {
    JSON.parse(pageText)
    return pageText
  } catch {
    return null
  }
}

function getInterceptUrl(sourceUrl: string) {
  return (
    `${chrome.runtime.getURL('index.html')}` +
    `?mode=${QUERY_MODE_INTERCEPT}` +
    `&sourceUrl=${encodeURIComponent(sourceUrl)}`
  )
}

function ensureOverlayStyle() {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.textContent = `
#${OVERLAY_ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: #ffffff;
}
#${OVERLAY_ROOT_ID} iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
#${OVERLAY_ROOT_ID} .json-ext-close {
  position: absolute;
  top: 12px;
  right: 12px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
  line-height: 32px;
  color: #24292f;
  z-index: 1;
}
`
  document.documentElement.appendChild(style)
}

function mountInterceptOverlay(targetUrl: string) {
  if (document.getElementById(OVERLAY_ROOT_ID)) {
    return
  }

  ensureOverlayStyle()
  const previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'

  const root = document.createElement('div')
  root.id = OVERLAY_ROOT_ID

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'json-ext-close'
  closeButton.setAttribute('aria-label', '返回原页面')
  closeButton.textContent = '返回原页面'

  const iframe = document.createElement('iframe')
  iframe.src = targetUrl
  iframe.title = 'JSON-Ext'

  const closeOverlay = () => {
    root.remove()
    document.documentElement.style.overflow = previousOverflow
    window.removeEventListener('keydown', onKeyDown, true)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeOverlay()
    }
  }

  closeButton.addEventListener('click', closeOverlay)
  window.addEventListener('keydown', onKeyDown, true)

  root.appendChild(closeButton)
  root.appendChild(iframe)
  document.documentElement.appendChild(root)
}

const jsonText = tryGetJsonTextFromPage()
if (jsonText) {
  mountInterceptOverlay(getInterceptUrl(location.href))
}
