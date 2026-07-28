/** @format */
// export type Theme = "lightmode" | "darkmode";

// export interface ThemeProps {
// 	theme: Theme;
// }
export type ApplicationStatus = 'applied' | 'interview' | 'offer' | 'rejected'
export type SyncStatus = 'synced' | 'pending' | 'failed' // sync status
export type AppliedFrom =
    | 'LinkedIn'
    | 'Indeed'
    | 'Glassdoor'
    | 'Handshake'
    | 'Company Website'
    | 'Other'

export type Application = {
    id: string
    jobTitle: string
    dateApplied: string
    jobStatus: ApplicationStatus
    appliedFromUrl: string // url of website applying on
    appliedFromName: AppliedFrom //name if website applying on
    companyName: string // name of company applying to
    syncStatus: SyncStatus // sync status

    //optional
    resumeRef?: string
    jobUrl?: string // url of job after ai search
    jobId?: string // id of job after ai search
    notes?: string // notes about the job
    salary?: string // how much the job pays
    location?: string // location of the job
    jobDescription?: string // description of the job
    lastSyncError?: string // last sync error
    updatedAt?: string // last updated
}

export type StatsData = {
    totalApplications: number
    thisWeek: number
    interviews: number
}

// export interface SettingsProps extends ThemeProps {
// 	changeTheme: (e: React.ChangeEvent<HTMLInputElement>) => void;
// }

export type ApplicationsProps = {
    applications: Application[]
    // theme: Theme;
    onDelete: (id: string) => void
    onStatusChange: (id: string, status: ApplicationStatus) => void
    onEdit: (app: Application) => void
}

export type ManualEntryProps = {
    onOpen: () => void
    onAdd: (application: Application) => void
    // theme: Theme;
}

export type FormProps = {
    mode: 'edit' | 'create'
    initialValues?: Application
    onSubmit: (application: Application) => void
    // theme: Theme;
    onClose: () => void
}

export type DataProps = {
    status: 'idle' | 'saving' | 'saved' | 'error' | 'loading' | 'loaded'
}

export type NavProps = {
    settingsClick: () => void
    showSettings: boolean
    // theme: Theme;
}

export interface PopupProps {
    detectedJob: Application | null
    // theme: Theme;
    onConfirm: () => void
    onEdit: () => void
    onDismiss: () => void
}

export interface JobLocation {
    address?: { addressLocality?: string; addressRegion?: string }
}

export interface JsonLdJobPosting extends JobLocation {
    '@type'?: string | string[]
    title?: string
    hiringOrganization?: { name?: string }
    jobLocation?: JobLocation | JobLocation[]
    baseSalary?: {
        value?: { value?: number; minValue?: number; maxValue?: number; unitText?: string }
    }
    description?: string
    url?: string
}

// A parsed JSON-LD block: either a node itself, or a container with @graph
export interface JsonLdBlock {
    '@type'?: string | string[]
    '@graph'?: unknown[]
}

export type SheetLookup =
    | { status: 'found'; sheetId: string }
    | { status: 'none' }
    | { status: 'error'; message: string }
