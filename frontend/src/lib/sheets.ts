import type { Application, ApplicationStatus, AppliedFrom } from '../types'
import { getStoredToken, signIn, silentSignIn } from './authModule'
import { APPLICATION_COLUMNS, applicationToRow } from './schema'
import type { SheetLookup } from '../types'

const SHEET_NAME = 'Applications'
const API = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE = 'https://www.googleapis.com/drive/v3/files'

// User stores a full sheet URL in settings; pull the id out of it.
// function sheetIdFromUrl(url: string): string {
//     const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
//     if (!m) throw new Error('Invalid Google Sheet URL')
//     return m[1]
// }

function rowToApplication(row: string[]): Application {
    const get = (col: string) => row[APPLICATION_COLUMNS.indexOf(col)] ?? ''
    return {
        id: get('id'),
        companyName: get('companyName'),
        jobTitle: get('jobTitle'),
        jobStatus: (get('jobStatus') || 'applied') as ApplicationStatus,
        dateApplied: get('dateApplied'),
        appliedFromName: (get('appliedFromName') || 'Other') as AppliedFrom,
        appliedFromUrl: get('appliedFromUrl'),
        location: get('location') || undefined,
        salary: get('salary') || undefined,
        jobId: get('jobId') || undefined,
        notes: get('notes') || undefined,
        syncStatus: 'synced', // it came FROM the sheet
    }
}

export function handleIdParsing(url: string): string {
    const u = new URL(url) // throws on malformed input — fine, caller catches

    if (u.hostname !== 'docs.google.com')
        throw new Error('Invalid Google Sheet URL')
    if (!u.pathname.includes('/spreadsheets/d/'))
        throw new Error('Invalid Google Sheet URL')

    const match = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) throw new Error('Invalid Google Sheet URL')

    const id = match[1]
    if (id.length < 25) throw new Error('Invalid Google Sheet URL')

    return id
}

export async function authFetch<T>(
    url: string,
    init: RequestInit = {},
): Promise<T> {
    const call = async (token: string) =>
        fetch(url, {
            ...init,
            headers: {
                ...init.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

    // Expired cached token? Try a silent refresh before giving up.
    let token = (await getStoredToken()) ?? (await silentSignIn())
    if (!token) throw new Error('Not signed in')

    let res = await call(token)

    if (res.status === 401) {
        // Token rejected — drop it (no revoke: that would kill the grant
        // and force the consent screen), refresh silently if possible,
        // only bother the user as a last resort.
        await chrome.storage.local.remove('authToken')
        token = (await silentSignIn()) ?? (await signIn())
        res = await call(token)
    }

    if (!res.ok) throw new Error(`Error: ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
}

export async function checkHeader(sheetId: string): Promise<void> {
    const data = await authFetch<{ values?: string[][] }>(
        `${API}/${sheetId}/values/${SHEET_NAME}!A1:N1`,
    )
    if (!data.values || data.values.length === 0) {
        await authFetch(
            `${API}/${sheetId}/values/${SHEET_NAME}!A1:N1?valueInputOption=RAW`,
            {
                method: 'PUT',
                body: JSON.stringify({ values: [APPLICATION_COLUMNS] }),
            },
        )
    }
}

// Find the 1-based sheet row for a given application id.
async function findRow(sheetId: string, id: string): Promise<number> {
    const data = (await authFetch(
        `${API}/${sheetId}/values/${SHEET_NAME}!A:A`,
    )) as { values?: string[][] }

    const rows = data.values ?? []
    const idx = rows.findIndex((r) => r[0] === id)
    return idx === -1 ? -1 : idx + 1 // array index → sheet row
}

export async function createRow(sheetId: string, app: Application) {
    await authFetch(
        `${API}/${sheetId}/values/${SHEET_NAME}!A:N:append` +
            `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: 'POST',
            body: JSON.stringify({ values: [applicationToRow(app)] }),
        },
    )
}

export async function editRow(sheetId: string, app: Application) {
    const row = await findRow(sheetId, app.id)
    if (row === -1) return createRow(sheetId, app) // upsert, same as your UI logic

    await authFetch(
        `${API}/${sheetId}/values/${SHEET_NAME}!A${row}:N${row}` +
            `?valueInputOption=USER_ENTERED`,
        {
            method: 'PUT',
            body: JSON.stringify({ values: [applicationToRow(app)] }),
        },
    )
}

export async function updateStatus(
    sheetId: string,
    id: string,
    status: string,
) {
    const row = await findRow(sheetId, id)
    if (row === -1) throw new Error('Row not found')

    // jobStatus is column D
    await authFetch(
        `${API}/${sheetId}/values/${SHEET_NAME}!D${row}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', body: JSON.stringify({ values: [[status]] }) },
    )
}

export async function deleteRow(sheetId: string, id: string) {
    const row = await findRow(sheetId, id)
    if (row === -1) return

    // deleteDimension needs the tab's numeric gid, not the spreadsheet id
    const meta = (await authFetch(
        `${API}/${sheetId}?fields=sheets.properties`,
    )) as {
        sheets: { properties: { sheetId: number; title: string } }[]
    }
    const gid = meta.sheets.find((s) => s.properties.title === SHEET_NAME)
        ?.properties.sheetId
    if (gid === undefined) throw new Error('Sheet tab not found')

    await authFetch(`${API}/${sheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: gid,
                            dimension: 'ROWS',
                            startIndex: row - 1,
                            endIndex: row,
                        },
                    },
                },
            ],
        }),
    })
}

export async function importFromSheet(sheetId: string): Promise<Application[]> {
    const data = await authFetch<{ values?: string[][] }>(
        `${API}/${sheetId}/values/${SHEET_NAME}!A2:N`, // A2 skips headers
    )
    return (data.values ?? []).map(rowToApplication)
}

export async function createSheet(): Promise<string> {
    const res = await authFetch<{ spreadsheetId: string }>(API, {
        method: 'POST',
        body: JSON.stringify({
            properties: { title: 'JobTrackr Applications' },
            sheets: [{ properties: { title: 'Applications' } }],
        }),
    })
    await checkHeader(res.spreadsheetId) // writes the header row
    return res.spreadsheetId
}

export async function checkForSheets(): Promise<SheetLookup> {
    const query =
        "mimeType = 'application/vnd.google-apps.spreadsheet'" +
        " and name = 'JobTrackr Applications' and trashed = false"
    const params = new URLSearchParams({
        q: query,
        fields: 'files(id,name)',
    })
    const res = await authFetch<{ files?: { id: string; name: string }[] }>(
        `${DRIVE}?${params}`,
    )
    const first = res.files?.[0]
    if (!first) return { status: 'none' }
    return { status: 'found', sheetId: first.id }
}
