/** @format */

const hostname = window.location.hostname

if (hostname.includes('indeed.com')) {
    const ogFetch = window.fetch
    console.log('Intercepting fetch requests...')
    // console.log('Original fetch:', ogFetch)
    let lastSeenJobId: string | null = null

    window.fetch = async function (...args) {
        // console.log('fetch request intercepted', args[0])
        const response = await ogFetch(...args)
        const url = args[0]

        if (typeof url === 'string' && url.includes('/viewjob')) {
            // console.log("fetch request intercepted", url);
            const clone = response.clone()

            try {
                const data = await clone
                // console.log(
                // 	"html",
                // 	html
                // 		.json()
                // 		.then((res) => res.body.jobInfoWrapperModel.jobInfoModel.jobInfoHeaderModel),
                // );
                const res = await data.json()
                const jobInfo =
                    res.body?.jobInfoWrapperModel.jobInfoModel
                        ?.jobInfoHeaderModel

                const urlObj = new URL(url, window.location.origin)
                const jobId = urlObj.searchParams.get('jk')
                // const companyName = jobResult.then((res) => res.companyName)
                // console.log('companyName', companyName)

                if (jobId && jobId !== lastSeenJobId) {
                    // console.log("Job ID:", jobId);
                    // console.log("Saved detected Indeed job:", jobId);
                    // console.log('job data', html[0])
                    // console.log('html', )
                    // console.log("jobInfo", jobInfo);
                    // console.log("companyName", companyName);
                    // console.log("jobTitle", jobTitle);
                    // console.log("location", location);

                    window.postMessage(
                        {
                            source: 'JOB_TRACKR_INJECT',
                            companyName: jobInfo?.companyName,
                            jobTitle: jobInfo?.jobTitle,
                            location:
                                jobInfo?.remoteWorkModel?.text ||
                                jobInfo?.formattedLocation ||
                                'No location found',
                            appliedFromUrl: `https://indeed.com/viewjob?jk=${jobId}`,
                            jobId: jobId,
                        },
                        '*',
                    )

                    lastSeenJobId = jobId
                }
            } catch (e) {
                console.error('Failed to parse Indeed response HTML', e)
            }
        }

        return response
    }

    console.log('Fetch interceptor installed')
} else if (hostname.includes('glassdoor.com')) {
    console.log('Glassdoor detected - setting up fetch interceptor')
    const ogFetch = window.fetch
    const lastSeenJobId: string | null = null

    window.fetch = async function (...args) {
        const response = await ogFetch(...args)
        const url = args[0]

        if (typeof url === 'string' && url.includes('job-details')) {
            const clone = response.clone()
            const data = await clone
            const res = await data.json()
            console.log(res)
            // const jobInfo =
            const url = res?.jobListingDetails?.seoJobLink
            const jobId = url.split('jl=')[1]
            // console.log('Result', res?.jobListingDetails)
            // console.log('Company Name:', res?.jobListingDetails?.employerName)
            // console.log('Job Title:', res?.jobListingDetails?.title)
            // console.log('Location:', res?.jobListingDetails?.location)

            if (jobId && jobId !== lastSeenJobId) {
                console.log('Saved detected Glassdoor job:', jobId)
                window.postMessage(
                    {
                        source: 'JOB_TRACKR_INJECT',
                        companyName: res?.employerName,
                        jobTitle: res?.jobTitle,
                        location: res?.locationName || 'No location found',
                        appliedFromUrl: url,
                        jobId: jobId,
                    },
                    '*',
                )
            }
        }

        return response
    }

    console.log('Fetch interceptor installed')
} else if (hostname.includes('linkedin.com')) {
    console.log('LinkedIn detected - injecting script')
    const ogFetch = window.fetch
    // const lastSeenJobId: string | null = null

    window.fetch = async function (...args) {
        // console.log('fetch request intercepted', args[0])
        const response = await ogFetch(...args)
        const url = args[0]
        console.log('fetch request intercepted', url);

        if (
            typeof url === 'string' &&
            url.includes('/voyager/api/jobs/jobPostings/')
        ) {
            console.log('fetch request intercepted', url)
            const clone = response.clone()
            const data = await clone
            // console.log('html', await data.text())
            const res = await data.json()
            console.log(res)
        }

        return response
    }
}
