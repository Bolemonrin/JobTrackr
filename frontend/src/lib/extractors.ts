/** @format */
import type { JsonLdJobPosting, JsonLdBlock, AppliedFrom } from '../types'

/**
 * The fields every extraction tier produces. Kept separate from `Application`
 * so extractors stay pure: no crypto.randomUUID, no Date.now, no chrome.*.
 * The caller (content script) stamps those on afterwards.
 */
export type JobFields = {
    jobTitle: string
    companyName: string
    location: string
    salary: string
    jobId?: string
    appliedFromUrl: string
}

export const SALARY_PATTERNS = [
    /\$\d{1,3}(,\d{3})*(\.\d+)?\s*-\s*\$\d{1,3}(,\d{3})*(\.\d+)?/,
    /\$\d{1,3}(,\d{3})*(\.\d+)?\s*per\s*(year|month|week|day|hour)/i,
    /\$\d{1,3}(,\d{3})*(\.\d+)?(\/hour)?/,
    /\b\d{1,3}(,\d{3})*(\.\d+)?\s*(USD|EUR|GBP|CAD|AUD)\b/i,
]

export function extractSalaryFromText(text: string): string {
    for (const pattern of SALARY_PATTERNS) {
        const match = text.match(pattern)
        if (match) return match[0]
    }
    return ''
}

export function toAppliedFrom(hostname: string): AppliedFrom {
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

/**
 * TIER 2 — the generic schema.org JSON-LD fallback.
 * Works on any site that publishes a JobPosting block, with no site knowledge.
 */
export function extractFromJsonLd(doc: Document, pageUrl: string): JobFields | null {
    const scriptTags = doc.querySelectorAll('script[type="application/ld+json"]')

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

    if (!jobDetails) return null // no JobPosting on the page

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
        const text =
            new DOMParser().parseFromString(jobDetails.description ?? '', 'text/html')
                .body.textContent ?? ''
        salary = extractSalaryFromText(text)
    }

    const jobId =
        jobDetails.url?.match(/\/jobs\/view\/(\d+)/)?.[1] ??
        new URL(pageUrl).searchParams.get('currentJobId') ??
        undefined

    return {
        jobTitle: jobDetails.title ?? '',
        companyName: jobDetails.hiringOrganization?.name ?? '',
        location,
        salary,
        jobId,
        appliedFromUrl: jobDetails.url ?? pageUrl,
    }
}

/* ------------------------------------------------------------------ *
 * TIER 1 — site-specific adapters.
 *
 * Indeed and Glassdoor adapters read an intercepted fetch response (see
 * inject.ts); only their salary comes from the DOM. LinkedIn's reads the
 * SDUI pane directly. That asymmetry is why an A/B fixture has to carry
 * both the page HTML and the captured API JSON for the same posting.
 * ------------------------------------------------------------------ */

/** Indeed: parse the intercepted /viewjob response body. */
export function parseIndeedApi(
    res: unknown,
    requestUrl: string,
    origin = 'https://www.indeed.com',
): Omit<JobFields, 'salary'> | null {
    const r = res as {
        body?: {
            jobInfoWrapperModel?: {
                jobInfoModel?: {
                    jobInfoHeaderModel?: {
                        companyName?: string
                        jobTitle?: string
                        formattedLocation?: string
                        remoteWorkModel?: { text?: string }
                    }
                }
            }
        }
    }
    const jobInfo =
        r?.body?.jobInfoWrapperModel?.jobInfoModel?.jobInfoHeaderModel
    if (!jobInfo) return null

    let jobId: string | null = null
    try {
        jobId = new URL(requestUrl, origin).searchParams.get('jk')
    } catch {
        jobId = null
    }
    if (!jobId) return null

    return {
        jobTitle: jobInfo.jobTitle ?? '',
        companyName: jobInfo.companyName ?? '',
        location:
            jobInfo.remoteWorkModel?.text ||
            jobInfo.formattedLocation ||
            'No location found',
        jobId,
        appliedFromUrl: `https://indeed.com/viewjob?jk=${jobId}`,
    }
}

/** Indeed: salary is not in the intercepted payload, so it comes off the DOM. */
export function extractIndeedSalaryFromDom(doc: Document): string {
    const el = doc.querySelector('#salaryInfoAndJobType > span.css-1oc7tea.eu4oa1w0')
    return el?.textContent?.trim().replace(/^From\s+/i, '') || ''
}

/** Glassdoor: parse the intercepted job-details response body. */
export function parseGlassdoorApi(
    res: unknown,
): Omit<JobFields, 'salary'> | null {
    const r = res as {
        employerName?: string
        jobTitle?: string
        locationName?: string
        jobListingDetails?: { seoJobLink?: string }
    }
    const seoLink = r?.jobListingDetails?.seoJobLink
    const jobId = seoLink?.split('jl=')[1]
    if (!jobId) return null

    return {
        jobTitle: r?.jobTitle ?? '',
        companyName: r?.employerName ?? '',
        location: r?.locationName || 'No location found',
        jobId,
        appliedFromUrl: seoLink ?? '',
    }
}

/** Glassdoor: salary comes off the DOM pay section. */
export function extractGlassdoorSalaryFromDom(doc: Document): string {
    const el = doc.querySelector('#PaySection_salaryRange_F6fsy')
    return el?.textContent?.trim() || ''
}

/**
 * LinkedIn: the SDUI job-details pane, read straight from the DOM.
 *
 * `pageUrl` is passed in rather than read off `doc` so the function stays
 * testable against a parsed document.
 */
export function extractLinkedInPane(
    doc: Document,
    pageUrl: string,
): JobFields | null {
    const pane = doc.querySelector('[data-sdui-screen*="JobDetails"]')
    if (!pane) return null // pane not rendered yet

    // The id is unambiguous in the URL. The pane's first /jobs/view/ link is
    // NOT reliably the title — on a job's own page it is a filter pill (which
    // is how "Hybrid" and pay ranges ended up in jobTitle) — so that link is
    // only a last resort for both fields.
    const fallbackLink = pane.querySelector('a[href*="/jobs/view/"]')
    const jobId =
        pageUrl.match(/\/jobs\/view\/(\d+)/)?.[1] ??
        new URL(pageUrl).searchParams.get('currentJobId') ??
        fallbackLink?.getAttribute('href')?.match(/\/jobs\/view\/(\d+)/)?.[1] ??
        null

    const jobTitle =
        textOf(pane.querySelector('h1')) ||
        textOf(doc.querySelector('h1')) ||
        textOf(pane.querySelector('[role="heading"][aria-level="1"]')) ||
        titleFromDocumentTitle(doc.title) ||
        textOf(fallbackLink)

    // Company is a SEPARATE /company/ link
    const companyName = textOf(pane.querySelector('a[href*="/company/"]'))

    // Core fields missing → not rendered yet, signal a retry
    if (!jobId || !jobTitle || !companyName) return null

    // Location: first segment of "United States · 1 week ago · ..."
    // NOTE: this hashed class has rotated on LinkedIn's side and currently
    // matches nothing, so location comes back empty. Known gap.
    const metaText = textOf(pane.querySelector('span._2da46c2f'))
    const location = metaText.split('·')[0]?.trim() ?? ''

    return {
        jobTitle,
        companyName,
        location,
        salary: '', // not present in this layout
        jobId,
        appliedFromUrl: `https://www.linkedin.com/jobs/view/${jobId}`,
    }
}

/**
 * A job's own LinkedIn page renders no <h1> and no [role="heading"], and every
 * a[href*="/jobs/view/"] in the pane shares one href with pill text ("Hybrid",
 * "Full-time", "I'm interested"), so the link cannot identify the title there.
 *
 * document.title does: an own page reads "<title> | <company> | LinkedIn",
 * while the split view shows the search page's title with no company segment
 * ("(24) Software Engineer jobs | LinkedIn"). Requiring three or more segments
 * is what keeps this from hijacking the split view, where the pane's first
 * /jobs/view/ link IS the title and is used instead.
 *
 * Everything but the trailing company and "LinkedIn" is rejoined, so a title
 * that itself contains " | " survives.
 */
function titleFromDocumentTitle(docTitle: string): string {
    const parts = docTitle
        .split(' | ')
        .map((p) => p.trim())
        .filter(Boolean)
    if (parts.length < 3 || parts[parts.length - 1] !== 'LinkedIn') return ''
    return parts.slice(0, -2).join(' | ')
}

/**
 * jsdom does not implement innerText, so the pane reads fall back to
 * textContent. Both collapse to the same string for these link/span nodes.
 */
function textOf(el: Element | null): string {
    if (!el) return ''
    const node = el as HTMLElement
    return (node.innerText ?? node.textContent ?? '').trim()
}
