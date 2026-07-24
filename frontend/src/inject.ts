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
    let lastSeenJobId: string | null = null

    window.fetch = async function (...args) {
        const response = await ogFetch(...args)
        const url =
            typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url

        if (typeof url === 'string' && url.includes('job-details')) {
            try {
                const res = await response.clone().json()
                // console.log(res)
                const details = res?.jobListingDetails
                const seoLink = details.seoJobLink
                const jobId = seoLink?.split('jl=')[1]

                if (jobId && jobId !== lastSeenJobId) {
                    console.log('Saved detected Glassdoor job:', jobId)
                    window.postMessage(
                        {
                            source: 'JOB_TRACKR_INJECT',
                            companyName: res?.employerName,
                            jobTitle: res?.jobTitle,
                            location: res?.locationName || 'No location found',
                            appliedFromUrl: seoLink,
                            jobId: jobId,
                        },
                        '*',
                    )

                    lastSeenJobId = jobId
                }
            } catch (e) {
                console.error('Failed to parse Glassdoor response: ', e)
            }

            // const jobInfo =

            // console.log('Result', res?.jobListingDetails)
            // console.log('Company Name:', res?.jobListingDetails?.employerName)
            // console.log('Job Title:', res?.jobListingDetails?.title)
            // console.log('Location:', res?.jobListingDetails?.location)
        }

        return response
    }

    console.log('Fetch interceptor installed')
}
// } else if (hostname.includes('linkedin.com')) {
//     console.log('LinkedIn detected - injecting script')
//     const ogFetch = window.fetch
//     let lastSeenJobId: string | null = null

//     window.fetch = async function (...args) {
//         // console.log('fetch request intercepted', args[0])
//         const response = await ogFetch(...args)
//         const url =
//             typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url
//         console.log('fetch request intercepted', url)

//         if (
//             typeof url === 'string' &&
//             url.includes('/voyager/api/jobs/jobPostings/')
//         ) {
//             try {
//                 console.log('fetch request intercepted', url)
//                 // const clone = response.clone()
//                 // const data = await clone
//                 // console.log('html', await data.text())
//                 const res = await response.clone().json()
//                 console.log('LinkedIn response:', res)
//                 const jobId = url.split('/jobPostings/')[1]?.split('?')[0]

//                 if (jobId && jobId != lastSeenJobId) {
//                     console.log('Saved detected LinkedIn job:', jobId)
//                     window.postMessage(
//                         {
//                             source: 'JOB_TRACKR_INJECT',
//                             companyName: res?.employerName,
//                             jobTitle: res?.jobTitle,
//                             location: res?.locationName || 'No location found',
//                             appliedFromUrl: url,
//                             jobId: jobId,
//                         },
//                         '*',
//                     )

//                     lastSeenJobId = jobId
//                 }
//             } catch (e) {
//                 console.log('Error parsing LinkedIn: ', e)
//             }
//         }

//         return response
//     }
// }
