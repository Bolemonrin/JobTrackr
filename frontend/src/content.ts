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

    let lastSavedJobId: string | null = null
    let retryTimer: number | null = null

    // LinkedIn puts the selected job's id in the page URL as ?currentJobId=
    const getJobId = (): string | null =>
        new URLSearchParams(window.location.search).get('currentJobId')

    // First matching selector that actually has text wins.
    // Multiple fallbacks because LinkedIn reskins these class names often.
    const readText = (selectors: string[]): string => {
        for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLElement | null
            const t = el?.innerText?.trim()
            if (t) return t
        }
        return ''
    }

    const extractJob = (jobId: string): Application | null => {
        const jobTitle = readText([
            '.job-details-jobs-unified-top-card__job-title h1',
            '.job-details-jobs-unified-top-card__job-title',
            'h1.t-24',
        ])

        const companyName = readText([
            '.job-details-jobs-unified-top-card__company-name a',
            '.job-details-jobs-unified-top-card__company-name',
        ])

        // Core fields not rendered yet — signal the caller to retry
        if (!jobTitle || !companyName) return null

        const location = readText([
            '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text',
            '.job-details-jobs-unified-top-card__primary-description-container',
        ])

        const salary = readText([
            '.job-details-jobs-unified-top-card__job-insight span',
            '.job-details-fit-level-preferences span strong',
        ])

        return {
            id: crypto.randomUUID(),
            jobId,
            jobTitle,
            companyName,
            location,
            salary,
            appliedFromName: 'LinkedIn',
            appliedFromUrl: `https://www.linkedin.com/jobs/view/${jobId}`,
            dateApplied: new Date().toISOString(),
            jobStatus: 'applied',
            syncStatus: 'pending',
        }
    }

    // Try to extract; if the pane hasn't rendered, retry a few times then give up
    const attemptExtract = (tries = 6) => {
        const jobId = getJobId()
        if (!jobId || jobId === lastSavedJobId) return

        const job = extractJob(jobId)
        if (!job) {
            if (tries > 0) {
                retryTimer = window.setTimeout(
                    () => attemptExtract(tries - 1),
                    400,
                )
            }
            return
        }

        lastSavedJobId = jobId
        chrome.storage.local.set({ detectedJob: job }, () => {
            console.log('JobTrackr: Saved detected LinkedIn job:', job)
        })
    }

    const scheduleExtract = () => {
        if (retryTimer) window.clearTimeout(retryTimer)
        // let LinkedIn start swapping the pane before the first read
        retryTimer = window.setTimeout(() => attemptExtract(), 300)
    }

    // The pane swaps without a full page load; DOM mutations are the reliable
    // signal from an isolated content script (shared DOM, unlike history).
    const observer = new MutationObserver(() => {
        const jobId = getJobId()
        if (jobId && jobId !== lastSavedJobId) scheduleExtract()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Initial load
    scheduleExtract()
} else {
    const scriptTags = document.querySelectorAll(
        'script[type="application/ld+json"]',
    )
    console.log('Parsing JSON-LD for job details...')
    const details = Array.from(scriptTags).flatMap((s) => {
        try {
            return [JSON.parse(s.innerHTML)]
        } catch {
            return []
        }
    })
    // const jobDetails = details.find((d) => d['@type'] === 'JobPosting')
    let jobDetails: JsonLdJobPosting | null = null
    for (const parsed of details) {
        const found = findJobPosting(parsed)
        if (found) {
            jobDetails = found
            break
        }
    }

    if (jobDetails) {
        const locationSource = Array.isArray(jobDetails.jobLocation)
            ? jobDetails.jobLocation[0]
            : jobDetails.jobLocation

        const locationCity = locationSource?.address?.addressLocality || ''
        const locationState = locationSource?.address?.addressRegion || ''
        const location = [locationCity, locationState]
            .filter(Boolean)
            .join(', ')

        const baseSalary = jobDetails.baseSalary?.value
        let salary = ''

        if (baseSalary?.value) {
            salary = `$${baseSalary.value}${baseSalary.unitText ? ` per ${baseSalary.unitText.toLowerCase()}` : ''}`
        } else if (baseSalary?.minValue && baseSalary?.maxValue) {
            salary = `$${baseSalary.minValue} - $${baseSalary.maxValue}${baseSalary.unitText ? ` per ${baseSalary.unitText.toLowerCase()}` : ''}`
        } else {
            const patterns = [
                /\$\d{1,3}(,\d{3})*(\.\d+)?\s*-\s*\$\d{1,3}(,\d{3})*(\.\d+)?/,
                /\$\d{1,3}(,\d{3})*(\.\d+)?\s*per\s*(year|month|week|day|hour)/i,
                /\$\d{1,3}(,\d{3})*(\.\d+)?(\/hour)?/,
                /\b\d{1,3}(,\d{3})*(\.\d+)?\s*(USD|EUR|GBP|CAD|AUD)\b/i,
            ]

            const textContent =
                new DOMParser().parseFromString(
                    jobDetails.description || '',
                    'text/html',
                ).body.textContent || ''

            for (const pattern of patterns) {
                const match = textContent.match(pattern)
                if (match) {
                    salary = match[0]
                    break
                }
            }
        }

        const application = {
            id: crypto.randomUUID(),
            jobTitle: jobDetails.title || '',
            companyName: jobDetails.hiringOrganization?.name || '',
            location: location,
            salary: salary,
            appliedFromName:
                toAppliedFrom(new URL(window.location.href).hostname) || '',
            appliedFromUrl: jobDetails.url || window.location.href,
            dateApplied: new Date().toISOString(),
            jobStatus: 'applied',
            syncStatus: 'pending',
            jobId: '',
        }

        chrome.storage.local.set({ detectedJob: application }, () => {
            console.log(
                'JobTrackr: Saved detected job from JSON-LD:',
                application,
            )
        })
    }
}
