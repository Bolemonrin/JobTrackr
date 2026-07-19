/** @format */
import { loadSheetUrl } from '../src/lib/storage'
import { syncContentScripts } from './lib/scripts'
import { loadSupportedSites } from './lib/storage'

interface ResponseData {
    status: string
    message: string
    result?: unknown
    // other properties...
}

const GOOGLE_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbyLAl5H9eAdR8osbSq3EOn0rj92o29EPHnIXTiDt7ssekgLVAV2A2ryxdgQE9Hythbp/exec'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('background got the message', message)
    if (message.type === 'SYNC_DATA') {
        handleSync(message.action, message.payload)
            .then((res) => sendResponse(res))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))

        return true // keeps message channel open for async response
    }
})

chrome.runtime.onInstalled.addListener(async () => {
    const sites = await loadSupportedSites()
    await syncContentScripts(sites)
})

async function handleSync(action: string, payload: object) {
    try {
        const sheetUrl = await loadSheetUrl() // get sheet url
        const spreadsheetId = handleIdParsing(sheetUrl) // parse spreadsheet id

        console.log(
            'BG sending',
            action,
            payload,
            'spreadsheetId',
            spreadsheetId,
        )

        // check for both sheet url and spreadsheet id
        if (!sheetUrl) return { ok: false, error: 'No Sheet URL saved yet' }
        if (!spreadsheetId) return { ok: false, error: 'Invalid Sheet URL' }

        // send request
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: action,
                payload: payload,
                sheetId: spreadsheetId,
                token: import.meta.env.SHARED_TOKEN,
            }),
        })

        // app script should return json
        const text = await res.text()

        let data: ResponseData | null = null
        try {
            data = JSON.parse(text)
        } catch {
            // console.log("failed to parse json", text);
            // apps scripts can return html error pages for some reason
            return {
                ok: false,
                error: `Non-JSON response: ${text.slice(0, 200)}`,
            }
        }

        // check status
        if (data?.status != 'success')
            return {
                ok: false,
                error: data?.message || 'Unknown error',
            }

        return { ok: true, result: data.result }
    } catch (e) {
        console.log('Sync failed', e)
        return {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        }
    }
}

export function handleIdParsing(url: string): string | null {
    try {
        const u = new URL(url)

        if (u.hostname !== 'docs.google.com') return null
        if (!u.pathname.includes('/spreadsheets/d/')) return null

        const match = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
        if (!match) return null

        const id = match[1]

        if (id.length < 25) return null

        return id
    } catch {
        return null
    }
}
