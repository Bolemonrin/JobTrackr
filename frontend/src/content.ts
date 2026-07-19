/** @format */
import type { JsonLdJobPosting, JsonLdBlock, AppliedFrom } from "./types"
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
            appliedFromName: toAppliedFrom(new URL(window.location.href).hostname) || '',
            appliedFromUrl: jobDetails.url || window.location.href,
            dateApplied: new Date().toISOString(),
            jobStatus: 'applied',
            syncStatus: 'pending',
            jobId: ''
        }

        chrome.storage.local.set({ detectedJob: application }, () => {
            console.log(
                'JobTrackr: Saved detected job from JSON-LD:',
                application,
            )
        })
    }
}
