/** @format */
import { loadSheetUrl, loadSupportedSites } from '../src/lib/storage'
import { syncContentScripts } from './lib/scripts'
import {
    createRow,
    deleteRow,
    updateStatus,
    editRow,
    handleIdParsing,
    importFromSheet,
} from './lib/sheets'
import type { Application } from './types'

type SyncMessage =
    | { action: 'CREATE'; payload: Application }
    | { action: 'EDIT'; payload: Application }
    | { action: 'DELETE'; payload: { id: string } }
    | {
          action: 'UPDATE'
          payload: { id: string; updates: Partial<Application> }
      }
    | { action: 'READ'; payload: Record<string, never> }

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('background got the message', message)
    if (message.type === 'SYNC_DATA') {
        handleSync(message as SyncMessage)
            .then((res) => sendResponse(res))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))

        return true // keeps message channel open for async response
    }
})

chrome.runtime.onInstalled.addListener(async () => {
    const sites = await loadSupportedSites()
    await syncContentScripts(sites)
})

async function handleSync(msg: SyncMessage) {
    try {
        const sheetUrl = await loadSheetUrl() // get sheet url
        if (!sheetUrl) return { ok: false, error: 'No Sheet URL saved yet' }

        const sheetId = handleIdParsing(sheetUrl) // parse spreadsheet id

        console.log(
            'BG sending',
            msg.action,
            msg.payload,
            'spreadsheetId',
            sheetId,
        )

        // check for both sheet url and spreadsheet id

        // send request
        switch (msg.action) {
            case 'CREATE':
                await createRow(sheetId, msg.payload)
                break
            case 'UPDATE': {
                const status = msg.payload.updates.jobStatus
                if (!status) throw new Error('UPDATE requires a jobStatus')
                await updateStatus(sheetId, msg.payload.id, status)
                break
            }
            case 'EDIT':
                await editRow(sheetId, msg.payload)
                break
            case 'DELETE':
                await deleteRow(sheetId, msg.payload.id)
                break
            case 'READ': {
                const apps = await importFromSheet(sheetId)
                return { ok: true, result: apps }
            }
            default: {
                const _exhaustive: never = msg
                throw new Error(
                    `Unknown action: ${JSON.stringify(_exhaustive)}`,
                )
            }
        }

        return { ok: true }
    } catch (e) {
        console.log('Sync failed', e)
        return {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        }
    }
}
