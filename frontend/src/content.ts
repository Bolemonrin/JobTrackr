/** @format */
import type {
    JsonLdJobPosting,
    JsonLdBlock,
    AppliedFrom,
    Application,
} from './types'
const url = new URL(window.location.href)

function injectScript() {
    if (document.querySelector('script[data-jobtrackr-inject]')) return

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('inject.js')
    script.dataset.jobtrackrInject = 'true'
    script.onload = () => script.remove()
    ;(document.head || document.documentElement).appendChild(script)
}

function toAppliedFrom(hostname: string): AppliedFrom {
    const h = hostname.replace(/^www\./, '')
    if (h.includes('linkedin.com')) return 'LinkedIn'
    if (h.includes('indeed.com')) return 'Indeed'
    if (h.includes('glassdoor.com')) return 'Glassdoor'
    if (h.includes('handshake.com')) return 'Handshake'
    return 'Other'
}

function isJobPosting(node: unknown): node is JsonLdJobPosting {
    const t = (node as JsonLdBlock)?.['@type']
    return t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))
}

function findJobPosting(parsed: unknown): JsonLdJobPosting | null {
    // A block may be the JobPosting directly, or wrap it in @graph
    const block = parsed as JsonLdBlock
    const nodes = Array.isArray(block['@graph']) ? block['@graph'] : [parsed]
    return nodes.find(isJobPosting) ?? null
}

function extractFromJsonLd(sourceName: AppliedFrom = 'Other'): boolean {
    const scriptTags = document.querySelectorAll(
        'script[type="application/ld+json"]',
    )

    const details = Array.from(scriptTags).flatMap((s) => {
        try {
            return [JSON.parse(s.innerHTML)]
        } catch {
            return []
        }
    })

    let jobDetails: JsonLdJobPosting | null = null
    for (const parsed of details) {
        const found = findJobPosting(parsed)
        if (found) {
            jobDetails = found
            break
        }
    }

    if (!jobDetails) return false // no JobPosting on the page

    // Location: jobLocation may be a single object or an array
    const locationSource = Array.isArray(jobDetails.jobLocation)
        ? jobDetails.jobLocation[0]
        : jobDetails.jobLocation
    const locationCity = locationSource?.address?.addressLocality ?? ''
    const locationState = locationSource?.address?.addressRegion ?? ''
    const location = [locationCity, locationState].filter(Boolean).join(', ')

    // Salary from baseSalary.value (single or range), else regex the description
    const qv = jobDetails.baseSalary?.value
    let salary = ''
    if (qv?.value) {
        salary = `$${qv.value}${qv.unitText ? ` per ${qv.unitText.toLowerCase()}` : ''}`
    } else if (qv?.minValue && qv?.maxValue) {
        salary = `$${qv.minValue} - $${qv.maxValue}${qv.unitText ? ` per ${qv.unitText.toLowerCase()}` : ''}`
    } else {
        const patterns = [
            /\$\d{1,3}(,\d{3})*(\.\d+)?\s*-\s*\$\d{1,3}(,\d{3})*(\.\d+)?/,
            /\$\d{1,3}(,\d{3})*(\.\d+)?\s*per\s*(year|month|week|day|hour)/i,
            /\$\d{1,3}(,\d{3})*(\.\d+)?(\/hour)?/,
            /\b\d{1,3}(,\d{3})*(\.\d+)?\s*(USD|EUR|GBP|CAD|AUD)\b/i,
        ]
        const text =
            new DOMParser().parseFromString(
                jobDetails.description ?? '',
                'text/html',
            ).body.textContent ?? ''
        for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match) {
                salary = match[0]
                break
            }
        }
    }

    const jobId =
        jobDetails.url?.match(/\/jobs\/view\/(\d+)/)?.[1] ??
        new URL(window.location.href).searchParams.get('currentJobId') ??
        undefined

    const application: Application = {
        id: crypto.randomUUID(),
        jobId,
        jobTitle: jobDetails.title ?? '',
        companyName: jobDetails.hiringOrganization?.name ?? '',
        location,
        salary,
        appliedFromName: sourceName,
        appliedFromUrl: jobDetails.url ?? window.location.href,
        dateApplied: new Date().toISOString(),
        jobStatus: 'applied',
        syncStatus: 'pending',
    }

    chrome.storage.local.set({ detectedJob: application }, () => {
        console.log('JobTrackr: Saved detected job from JSON-LD:', application)
    })
    return true
}

if (url.hostname.includes('glassdoor.com')) {
    console.log('Logging from content script on Glassdoor')
    injectScript()

    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'JOB_TRACKR_INJECT') return

        const { jobTitle, companyName, location, appliedFromUrl, jobId } =
            event.data

        setTimeout(() => {
            let salary = ''

            const salaryContainer = document.querySelector(
                '#PaySection_salaryRange_F6fsy',
            )

            if (salaryContainer) {
                salary = salaryContainer.textContent?.trim() || ''
            }

            // console.log('Received job data from inject script:', {
            //     jobTitle,
            //     companyName,
            //     location,
            //     appliedFromUrl,
            //     jobId,
            //     salary,
            // })

            const application = {
                id: crypto.randomUUID(),
                jobTitle: jobTitle,
                companyName: companyName,
                location: location,
                salary: salary,
                appliedFromName: 'Glassdoor',
                dateApplied: new Date().toISOString(),
                jobStatus: 'applied',
                syncStatus: 'pending',
                appliedFromUrl: appliedFromUrl,
                jobId: jobId,
            }

            chrome.storage.local.set({ detectedJob: application }, () => {
                console.log(
                    'JobTrackr: Saved detected Glassdoor job:',
                    application,
                )
            })
        }, 300)
    })
} else if (url.hostname.includes('indeed.com')) {
    console.log('Logging from content script on Indeed')
    injectScript()

    // let lastSeenJobId: string | null = null
    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'JOB_TRACKR_INJECT') return

        const { jobTitle, companyName, location, appliedFromUrl, jobId } =
            event.data

        setTimeout(() => {
            let salary = ''

            const salaryContainer = document.querySelector(
                '#salaryInfoAndJobType > span.css-1oc7tea.eu4oa1w0',
            )

            if (salaryContainer) {
                salary =
                    salaryContainer.textContent
                        ?.trim()
                        .replace(/^From\s+/i, '') || ''
            }

            const application = {
                id: crypto.randomUUID(),
                jobTitle: jobTitle,
                companyName: companyName,
                location: location,
                salary: salary,
                appliedFromName: 'Indeed',
                dateApplied: new Date().toISOString(),
                jobStatus: 'applied',
                syncStatus: 'pending',
                appliedFromUrl: appliedFromUrl,
                jobId: jobId,
            }

            chrome.storage.local.set({ detectedJob: application }, () => {
                console.log(
                    'JobTrackr: Saved detected Indeed job:',
                    application,
                )
            })
        }, 300)
    })
} else if (url.hostname.includes('linkedin.com')) {
    console.log('Logging from content script on LinkedIn')

    // for if linkedin is opened in regualr view
    if (!document.querySelector('[data-sdui-screen*="JobDetails"]')) {
        extractFromJsonLd('LinkedIn')
    } else {
        let lastSavedJobId: string | null = null
        let retryTimer: number | null = null

        // Confirmed pane root: the SDUI job-details screen. Scoping everything to
        // this keeps the left-list job cards out of the query.
        const getPane = (): Element | null =>
            document.querySelector('[data-sdui-screen*="JobDetails"]')

        const extractJob = (): Application | null => {
            const pane = getPane()
            if (!pane) return null // pane not rendered yet → caller retries

            // Title + ID from the same /jobs/view/ link (first match in pane)
            const titleLink = pane.querySelector('a[href*="/jobs/view/"]')
            const jobTitle =
                (titleLink as HTMLElement | null)?.innerText?.trim() ?? ''
            const jobId =
                titleLink
                    ?.getAttribute('href')
                    ?.match(/\/jobs\/view\/(\d+)/)?.[1] ?? null

            // Company is a SEPARATE /company/ link (confirmed returns "BJAK")
            const companyLink = pane.querySelector('a[href*="/company/"]')
            const companyName =
                (companyLink as HTMLElement | null)?.innerText?.trim() ?? ''

            // Core fields missing → not rendered yet, signal a retry
            if (!jobId || !jobTitle || !companyName) return null

            // Location: first segment of "United States · 1 week ago · ..."
            const metaText =
                (
                    pane.querySelector('span._2da46c2f') as HTMLElement | null
                )?.innerText?.trim() ?? ''
            const location = metaText.split('·')[0]?.trim() ?? ''

            return {
                id: crypto.randomUUID(),
                jobId,
                jobTitle,
                companyName,
                location,
                salary: '', // not present in this layout
                appliedFromName: 'LinkedIn',
                appliedFromUrl: `https://www.linkedin.com/jobs/view/${jobId}`,
                dateApplied: new Date().toISOString(),
                jobStatus: 'applied',
                syncStatus: 'pending',
            }
        }

        // Try to extract; retry a few times if the pane hasn't rendered, then stop.
        const attemptExtract = (tries = 6) => {
            const job = extractJob()

            if (!job) {
                if (tries > 0) {
                    retryTimer = window.setTimeout(
                        () => attemptExtract(tries - 1),
                        400,
                    )
                }
                return
            }

            if (job.jobId === lastSavedJobId) return // already saved this one

            lastSavedJobId = job.jobId ?? null
            chrome.storage.local.set({ detectedJob: job }, () => {
                console.log('JobTrackr: Saved detected LinkedIn job:', job)
            })
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
    console.log('Parsing JSON-LD for job details...')
    extractFromJsonLd(toAppliedFrom(url.hostname))
}
