/** @format */
import type { Application, AppliedFrom } from './types'
import {
    type JobFields,
    toAppliedFrom,
    extractFromJsonLd,
    extractIndeedSalaryFromDom,
    extractGlassdoorSalaryFromDom,
    extractLinkedInPane,
} from './lib/extractors'
import { ADAPTERS_ENABLED } from './lib/flags'

const url = new URL(window.location.href)

// Which arm is live — check this in the page console before recording results.
console.log(
    `%cJobTrackr: ${ADAPTERS_ENABLED ? 'TIERED (adapters + JSON-LD fallback)' : 'FALLBACK ONLY (adapters disabled)'}`,
    `color:${ADAPTERS_ENABLED ? '#0a0' : '#c60'};font-weight:bold`,
)

function injectScript() {
    if (document.querySelector('script[data-jobtrackr-inject]')) return

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('inject.js')
    script.dataset.jobtrackrInject = 'true'
    script.onload = () => script.remove()
    ;(document.head || document.documentElement).appendChild(script)
}

/** Stamp the runtime-only fields onto extracted fields to make an Application. */
export function toApplication(
    fields: JobFields,
    appliedFromName: AppliedFrom,
): Application {
    return {
        id: crypto.randomUUID(),
        jobId: fields.jobId,
        jobTitle: fields.jobTitle,
        companyName: fields.companyName,
        location: fields.location,
        salary: fields.salary,
        appliedFromName,
        appliedFromUrl: fields.appliedFromUrl,
        dateApplied: new Date().toISOString(),
        jobStatus: 'applied',
        syncStatus: 'pending',
    }
}

function save(application: Application, label: string) {
    chrome.storage.local.set({ detectedJob: application }, () => {
        console.log(`JobTrackr: Saved detected ${label} job:`, application)
    })
}

function runJsonLdFallback(sourceName: AppliedFrom = 'Other'): boolean {
    const fields = extractFromJsonLd(document, window.location.href)
    if (!fields) return false // no JobPosting on the page
    save(toApplication(fields, sourceName), 'JSON-LD')
    return true
}

/**
 * How long to wait for an intercepted payload before giving up on the adapter
 * and running the generic fallback instead.
 */
const ADAPTER_TIMEOUT_MS = 1500

/**
 * Indeed and Glassdoor both work the same way: inject.js intercepts the site's
 * own fetch and posts the parsed payload back here; salary is scraped off the
 * DOM because it is absent from that payload.
 *
 * The adapter only fires when the site actually makes that request, which it
 * does on in-page navigation but NOT on a direct page load, where the posting
 * is server-rendered. Without a net, those loads extracted nothing at all even
 * though the page carried perfectly good JSON-LD — so the fallback runs here
 * on a timer, exactly as it does for any unsupported site.
 */
function wireInterceptedSite(
    siteName: Extract<AppliedFrom, 'Indeed' | 'Glassdoor'>,
    readSalary: (doc: Document) => string,
) {
    injectScript()

    let adapterFired = false
    const net = window.setTimeout(() => {
        if (adapterFired) return
        console.log(`JobTrackr: no ${siteName} payload intercepted, using JSON-LD`)
        runJsonLdFallback(siteName)
    }, ADAPTER_TIMEOUT_MS)

    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'JOB_TRACKR_INJECT') return

        // Adapter won the race. If the net already fired, the richer adapter
        // result simply overwrites what the fallback stored.
        adapterFired = true
        window.clearTimeout(net)

        const { jobTitle, companyName, location, appliedFromUrl, jobId } =
            event.data

        setTimeout(() => {
            save(
                toApplication(
                    {
                        jobTitle,
                        companyName,
                        location,
                        salary: readSalary(document),
                        jobId,
                        appliedFromUrl,
                    },
                    siteName,
                ),
                siteName,
            )
        }, 300)
    })
}

if (ADAPTERS_ENABLED && url.hostname.includes('glassdoor.com')) {
    console.log('Logging from content script on Glassdoor')
    wireInterceptedSite('Glassdoor', extractGlassdoorSalaryFromDom)
} else if (ADAPTERS_ENABLED && url.hostname.includes('indeed.com')) {
    console.log('Logging from content script on Indeed')
    wireInterceptedSite('Indeed', extractIndeedSalaryFromDom)
} else if (ADAPTERS_ENABLED && url.hostname.includes('linkedin.com')) {
    console.log('Logging from content script on LinkedIn')

    // for if linkedin is opened in regular view
    if (!document.querySelector('[data-sdui-screen*="JobDetails"]')) {
        console.log('Logging from content script on LinkedIn (regular view)')
        runJsonLdFallback('LinkedIn')
    } else {
        let lastSavedJobId: string | null = null
        let retryTimer: number | null = null

        // Try to extract; retry a few times if the pane hasn't rendered, then stop.
        const attemptExtract = (tries = 6) => {
            const fields = extractLinkedInPane(document, window.location.href)

            if (!fields) {
                if (tries > 0) {
                    retryTimer = window.setTimeout(
                        () => attemptExtract(tries - 1),
                        400,
                    )
                }
                return
            }

            if (fields.jobId === lastSavedJobId) return // already saved this one

            lastSavedJobId = fields.jobId ?? null
            save(toApplication(fields, 'LinkedIn'), 'LinkedIn')
        }

        const scheduleExtract = () => {
            if (retryTimer) window.clearTimeout(retryTimer)
            // let LinkedIn begin swapping the pane before the first read
            retryTimer = window.setTimeout(() => attemptExtract(), 300)
        }

        // Pane swaps without a full page load; DOM mutation is the reliable signal
        // from an isolated content script (shared DOM, unlike history/fetch).
        const currentJobId = () =>
            new URLSearchParams(window.location.search).get('currentJobId')

        const observer = new MutationObserver(() => {
            const id = currentJobId()
            if (id && id !== lastSavedJobId) scheduleExtract()
        })
        observer.observe(document.body, { childList: true, subtree: true })

        // Initial load
        scheduleExtract()
    }
} else {
    // Flag off, or a site with no adapter: the generic fallback is all that runs.
    console.log('Parsing JSON-LD for job details...')
    runJsonLdFallback(toAppliedFrom(url.hostname))
}
