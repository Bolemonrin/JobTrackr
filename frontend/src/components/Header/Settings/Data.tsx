import { useEffect, useState, useRef } from 'react'
import type { DataProps } from '../../../types'
import {
    loadSheetUrl,
    saveSheetUrl,
    saveApplications,
} from '../../../lib/storage'
import { checkHeader, handleIdParsing } from '../../../lib/sheets'

const Data = () => {
    const containerColor = 'bg-slate-800 border-slate-700'

    const inputColor = 'border-stone-600 bg-slate-800 text-stone-200'

    const buttonTheme =
        'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-700 disabled:text-slate-500'

    const statusTheme = 'text-slate-400'

    const [sheetUrl, setSheetUrl] = useState('')
    const [status, setStatus] = useState<DataProps['status'] | ''>('')
    const [isImporting, setIsImporting] = useState(false)
    const savedUrlRef = useRef<string | null>(null)

    useEffect(() => {
        let mounted = true

        const load = async () => {
            const url = await loadSheetUrl()
            if (mounted) {
                savedUrlRef.current = url ?? '' // remember it BEFORE setting state
                setSheetUrl(url ?? '')
            }
        }

        load()
        return () => {
            mounted = false
        }
    }, [])

    useEffect(() => {
        if (!sheetUrl) return

        // 1. Skip the initial load echo — nothing actually changed
        if (sheetUrl === savedUrlRef.current) return

        // 2. Skip partial URLs while the user is still typing
        if (!sheetUrl.includes('/spreadsheets/d/')) return

        const t = setTimeout(() => {
            setStatus('saving')
            ;(async () => {
                try {
                    const sheetId = handleIdParsing(sheetUrl) // 3. real validation
                    await checkHeader(sheetId)
                    await saveSheetUrl(sheetUrl)

                    savedUrlRef.current = sheetUrl // keep ref in sync
                    setStatus('saved')
                    setTimeout(() => setStatus('idle'), 800)
                } catch (e) {
                    console.error(e)
                    setStatus('error')
                }
            })()
        }, 350)

        return () => clearTimeout(t)
    }, [sheetUrl])

    const handleImport = async () => {
        if (!sheetUrl) {
            setStatus('error')
            return
        }

        setIsImporting(true)
        setStatus('saving')

        try {
            const res = await chrome?.runtime?.sendMessage?.({
                type: 'SYNC_DATA',
                action: 'READ',
                payload: {},
            })

            if (res?.ok && Array.isArray(res.result)) {
                // setApplications(res.result);
                await saveApplications(res.result) // save to chrome storage
                setStatus('saved')
                alert(
                    `✅ Successfully imported ${res.result.length} application(s)`,
                )
            } else {
                console.error(res?.error)
                setStatus('error')
                alert(
                    '❌ Failed to import applications: ' +
                        (res?.error || 'Unknown error'),
                )
            }
        } catch (e) {
            console.error(e)
            setStatus('error')
            alert('❌ Error during import')
        }
        setIsImporting(false)
    }

    const helperText =
        status === 'saving'
            ? 'Saving...'
            : status === 'saved'
              ? '✅ Saved'
              : status === 'error'
                ? '❌ Error saving data'
                : ''

    // const keyHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
    //     if (e.key === "Enter") {
    //         addSite()
    //     }
    // }
    return (
        <div className={`p-3 rounded-xl border ${containerColor}`}>
            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-1">Data</h2>
                {helperText && (
                    <span className={`text-sm ${statusTheme}`}>
                        {helperText}
                    </span>
                )}
            </div>

            {/* Sheet URL */}
            <div className="space-y-4">
                <div>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">
                            Google Sheet URL:
                        </span>
                        <input
                            className={`border rounded-lg px-3 py-2 text-sm ${inputColor}`}
                            type="url"
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                        />
                    </label>
                    <p className={`text-xs mt-1 ${statusTheme}`}>
                        Link to your Google Sheet for syncing applications
                    </p>
                </div>

                <hr className={`my-3 border-t border-slate-700`} />

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Sync Options</h3>
                    <button
                        onClick={handleImport}
                        disabled={isImporting || !sheetUrl}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${buttonTheme}`}
                    >
                        {isImporting
                            ? '⌛ Importing...'
                            : '⬇️ Import from Google Sheets'}
                    </button>
                    <p className={`text-xs ${statusTheme}`}>
                        ⚠️ This will replace your local data with data from
                        Google Sheets
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Data
