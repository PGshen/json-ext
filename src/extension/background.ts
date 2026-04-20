/// <reference types="chrome" />

import {
  MESSAGE_TYPE_OPEN_JSON_TOOL,
  QUERY_MODE_INTERCEPT
} from './constants'

type OpenJsonToolMessage = {
  type: typeof MESSAGE_TYPE_OPEN_JSON_TOOL
  payload: {
    jsonText: string
    sourceUrl: string
  }
}

async function createInterceptToolUrl(payload: OpenJsonToolMessage['payload']) {
  const sessionKey = `json-ext-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await chrome.storage.session.set({
    [sessionKey]: {
      jsonText: payload.jsonText,
      sourceUrl: payload.sourceUrl,
      createdAt: Date.now(),
    },
  })

  return (
    `${chrome.runtime.getURL('index.html')}` +
    `?mode=${QUERY_MODE_INTERCEPT}` +
    `&sessionKey=${encodeURIComponent(sessionKey)}` +
    `&sourceUrl=${encodeURIComponent(payload.sourceUrl)}`
  )
}

chrome.runtime.onMessage.addListener((message: OpenJsonToolMessage, _sender, sendResponse) => {
  if (message.type !== MESSAGE_TYPE_OPEN_JSON_TOOL) {
    return false
  }

  createInterceptToolUrl(message.payload)
    .then((targetUrl) => sendResponse({ ok: true, targetUrl }))
    .catch((error: unknown) => {
      console.error('[JSON-Ext] Failed to prepare intercept tool URL:', error)
      sendResponse({ ok: false })
    })

  return true
})
