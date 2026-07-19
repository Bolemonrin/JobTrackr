import { useRef, useState } from 'react'
import type { Application, FormProps, AppliedFrom } from '../../../types'
import { nanoid } from 'nanoid'

const Form = ({ mode, initialValues, onSubmit, onClose }: FormProps) => {
    const submitButton = 'bg-white hover:bg-gray-300 text-slate-700'

    const container = 'bg-slate-800 border-slate-700 text-slate-100'

    const input = 'bg-slate-900 border-slate-700 text-slate-100'

    // const fileTheme = theme === "darkmode"
    //     ? "bg-slate-900 border-slate-700 hover:bg-gray-500"
    //     : "bg-gray-50 border-gray-300 hover:bg-gray-100"

    const [companyName, setCompanyName] = useState(
        initialValues?.companyName ?? '',
    )
    const [jobTitle, setJobTitle] = useState(initialValues?.jobTitle ?? '')
    // const [dateApplied, setDateApplied] = useState("")
    const [status, setStatus] = useState<Application['jobStatus'] | ''>(
        initialValues?.jobStatus ?? '',
    )
    const [websiteUrl, setWebsiteUrl] = useState(
        initialValues?.appliedFromUrl ?? '',
    )
    const [websiteName, setWebsiteName] = useState<AppliedFrom | ''>(
        initialValues?.appliedFromName ?? '',
    )
    const [resumeUsed, setResumeUsed] = useState(initialValues?.resumeRef ?? '')
    const [jobLocation, setJobLocation] = useState(
        initialValues?.location ?? '',
    )
    const [fileName, setFileName] = useState(initialValues?.resumeRef ?? '')

    const fileRef = useRef<HTMLInputElement>(null)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!companyName || !jobTitle || !websiteUrl) {
            alert(
                'Please fill in required fields: Company Name, Job Title, Website Name, and URL',
            )
            return
        }

        const updated: Application = {
            // Keep existing id and dateApplied for edits
            id: initialValues?.id ?? nanoid(),
            dateApplied: initialValues?.dateApplied ?? new Date().toISOString(),

            // Updated fields from form
            companyName,
            jobTitle,
            jobStatus: status || 'applied',
            appliedFromUrl: websiteUrl,
            appliedFromName: websiteName as Application['appliedFromName'],
            resumeRef: resumeUsed,
            location: jobLocation || undefined,

            // Keep existing optional fields or set to undefined
            jobUrl: initialValues?.jobUrl,
            jobId: initialValues?.jobId,
            notes: initialValues?.notes,
            salary: initialValues?.salary,
            jobDescription: initialValues?.jobDescription,

            // Sync status
            syncStatus:
                mode === 'edit'
                    ? (initialValues?.syncStatus ?? 'pending')
                    : 'pending',
            updatedAt: new Date().toISOString(),
            lastSyncError: undefined,
        }
        // const base: Partial<Application> =
        //     mode === "edit" && initialValues
        //         ? {
        //             ...initialValues
        //         }
        //         : {
        //             id: nanoid(),
        //             dateApplied: new Date().toISOString(),
        //             // jobTitle: "",
        //             // jobStatus: "applied",
        //             // appliedFromName: "",
        //             // appliedFromUrl: "",
        //             // companyName: "",
        //             // jobUrl: "",
        //             // jobId: "",
        //             // notes: "",
        //             // salary: "",
        //             // jobDescription: "",
        //         };

        // const updated: Application = {
        //     // required fields (ensure these exist)
        //     id: base.id!,
        //     dateApplied: base.dateApplied!,
        //     companyName: companyName || base.companyName!,
        //     jobTitle: jobTitle || base.jobTitle!,
        //     jobStatus: status || base.jobStatus!,
        //     appliedFromUrl: websiteUrl || base.appliedFromUrl!,
        //     appliedFromName: websiteName as Application["appliedFromName"] || base.appliedFromName!,
        //     resumeRef: resumeUsed || "",
        //     syncStatus: "pending",

        //     // keep optional fields from edit (if any)
        //     jobUrl: base.jobUrl,
        //     jobId: base.jobId,
        //     notes: base.notes,
        //     salary: base.salary,
        //     jobDescription: base.jobDescription,
        //     location: jobLocation || base.location,
        //     updatedAt: new Date().toISOString(),
        //     lastSyncError: undefined,
        // };

        onSubmit(updated)
        onClose()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFileName(file.name)
            setResumeUsed(file.name)
        }
    }

    const handleAddFile = () => {
        if (fileRef.current) {
            fileRef.current.click()
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className={`p-4 rounded-xl border max-h-[80vh] overflow-y-auto ${container}`}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                    {mode === 'edit' ? 'Edit Application' : 'Manual Entry'}
                </h3>
                <button
                    onClick={onClose}
                    type="button"
                    className="text-sm hover:opacity-70"
                >
                    ✕ Close
                </button>
            </div>

            {/* grid form layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                    className={`px-3 py-2 rounded border ${input}`}
                    type="text"
                    placeholder="Company name *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                />
                <input
                    className={`px-3 py-2 rounded border ${input}`}
                    type="text"
                    placeholder="Job title *"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                />
                <input
                    className={`px-3 py-2 rounded border ${input}`}
                    type="text"
                    placeholder="Job location"
                    value={jobLocation}
                    onChange={(e) => setJobLocation(e.target.value)}
                />
                <select
                    className={`px-3 py-2 rounded border ${input}`}
                    title="Select status of job application"
                    value={status}
                    onChange={(e) =>
                        setStatus(e.target.value as Application['jobStatus'])
                    }
                >
                    <option value="">Select Status</option>
                    <option value="applied">Applied</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select
                    className={`px-3 py-2 rounded border ${input}`}
                    value={websiteName}
                    onChange={(e) =>
                        setWebsiteName(e.target.value as AppliedFrom)
                    }
                    title="Select website applied on"
                >
                    <option value="">Select Website</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Indeed">Indeed</option>
                    <option value="Glassdoor">Glassdoor</option>
                    <option value="Handshake">Handshake</option>
                    <option value="Company Website">Company Website</option>
                    <option value="Other">Other</option>
                </select>
                <input
                    className={`px-3 py-2 rounded border ${input}`}
                    type="url"
                    placeholder="wesite applied on *"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                />
                {/* file upload */}
                <div className="md:col-span-2 flex items-center gap-3">
                    <input
                        placeholder="resume"
                        ref={fileRef}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        type="file"
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        className={`px-4 py-2 rounded-lg font-medium ${submitButton}`}
                        onClick={handleAddFile}
                    >
                        Choose Resume
                    </button>
                    <span
                        className={`text-sm truncate max-w-50 ${fileName ? '' : 'text-gray-400'}`}
                    >
                        {fileName || 'No file selected'}
                    </span>
                </div>
            </div>
            <button
                type="submit"
                className={`w-full mt-4 px-4 py-2 rounded-lg font-medium ${submitButton}`}
            >
                {mode === 'edit' ? 'Update Application' : 'Add Application'}
            </button>
        </form>
    )
}

export default Form
