/** @format */
import { parseIndeedApi, parseGlassdoorApi } from './lib/extractors'
import { ADAPTERS_ENABLED } from './lib/flags'

const hostname = window.location.hostname

/**
 * Both supported sites fetch their job payload as JSON after the initial page
 * load, so the adapter wraps window.fetch, sniffs the matching request, and
 * posts the parsed fields across to the content script.
 */
function installInterceptor(
    matches: (url: string) => boolean,
    parse: (body: unknown, url: string) => ReturnType<typeof parseIndeedApi>,
    label: string,
) {
    const ogFetch = window.fetch
    let lastSeenJobId: string | null = null

    window.fetch = async function (...args) {
        const response = await ogFetch(...args)
        const url =
            typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url

        if (typeof url === 'string' && matches(url)) {
            try {
                const body = await response.clone().json()
                const fields = parse(body, url)

                if (fields?.jobId && fields.jobId !== lastSeenJobId) {
                    console.log(`Saved detected ${label} job:`, fields.jobId)
                    window.postMessage(
                        { source: 'JOB_TRACKR_INJECT', ...fields },
                        '*',
                    )
                    lastSeenJobId = fields.jobId
                }
            } catch (e) {
                console.error(`Failed to parse ${label} response`, e)
            }
        }

        return response
    }

    console.log('Fetch interceptor installed')
}

if (!ADAPTERS_ENABLED) {
    // Fallback-only arm: never wrap fetch, so no adapter data reaches content.js.
    console.log('JobTrackr: adapters disabled, fetch interceptor not installed')
} else if (hostname.includes('indeed.com')) {
    console.log('Intercepting fetch requests...')
    installInterceptor(
        (url) => url.includes('/viewjob'),
        (body, url) => parseIndeedApi(body, url, window.location.origin),
        'Indeed',
    )
} else if (hostname.includes('glassdoor.com')) {
    console.log('Glassdoor detected - setting up fetch interceptor')
    installInterceptor(
        (url) => url.includes('job-details'),
        (body) => parseGlassdoorApi(body),
        'Glassdoor',
    )
}
