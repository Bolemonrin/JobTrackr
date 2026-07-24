import { useEffect, useState } from 'react'

import type { Application, ApplicationStatus } from '../../types'
import {
    loadApplications,
    saveApplications,
    loadDetectedJob,
    saveDetectedJob,
} from '../../lib/storage'
// import { loadApplications, saveApplications } from "../../lib/storage";

import Stats from './Home/Stats'
import ApplicationsCard from './Home/ApplicationsCard'
import ManualEntry from './Home/ManualEntry'
import Form from './Home/Form'
import PopUp from './Home/PopUp'

const Home = () => {
    const [applications, setApplications] = useState<Application[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isEdit, setIsEdit] = useState<Application | null>(null)
    const [showManualEntry, setShowManualEntry] = useState(false)
    const [detectedJob, setDetectedJob] = useState<Application | null>(null)

    const stats = {
        totalApplications: applications.length,
        thisWeek: applications.filter((app) => {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            return new Date(app.dateApplied) > weekAgo
        }).length,
        interviews: applications.filter((app) => app.jobStatus === 'interview')
            .length,
    }

    useEffect(() => {
        let unmounted = false

        const checkForDetectedJob = async () => {
            const job = await loadDetectedJob()
            if (!unmounted && job) {
                setDetectedJob(job)
            }
        }

        checkForDetectedJob()

        return () => {
            unmounted = true
        }
    }, [])

    useEffect(() => {
        const onStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string,
        ) => {
            if (areaName !== 'local') return

            if (changes.detectedJob) {
                const newValue = changes.detectedJob.newValue
                setDetectedJob(newValue as Application | null)
            }
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [])

    useEffect(() => {
        let unmounted = false
        const load = async () => {
            const apps = await loadApplications()
            if (!unmounted) {
                setApplications(apps)
                setIsLoading(false)
            }
        }

        load()

        return () => {
            unmounted = true
        }
    }, [])

    useEffect(() => {
        if (isLoading) return

        saveApplications(applications)
    }, [applications, isLoading])

    const setAppSync = (id: string, patch: Partial<Application>) => {
        setApplications((apps) =>
            apps.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        )
    }

    const addApplication = async (application: Application) => {
        setApplications((a) => [...a, application])

        if (chrome && chrome.runtime) {
            console.log('SYNC_DATA', 'CREATE', application.id, application)

            const res = await chrome.runtime.sendMessage({
                type: 'SYNC_DATA',
                action: 'CREATE',
                payload: stripForSheets(application),
            })

            if (res?.ok) {
                setAppSync(application.id, {
                    syncStatus: 'synced',
                    lastSyncError: undefined,
                })
            } else {
                setAppSync(application.id, {
                    syncStatus: 'failed',
                    lastSyncError: res?.error || 'Unknown error',
                })
            }
        }
    }

    const deleteApplication = (id: string) => {
        setApplications((a) => a.filter((app) => app.id !== id))

        if (chrome && chrome.runtime) {
            console.log('SYNC_DATA', 'DELETE', id)
            chrome.runtime.sendMessage({
                type: 'SYNC_DATA',
                action: 'DELETE',
                payload: { id: id },
            })
        }
    }

    const updateStatus = async (id: string, status: ApplicationStatus) => {
        setApplications((prev) =>
            prev.map((app) =>
                app.id === id
                    ? {
                          ...app,
                          jobStatus: status,
                      }
                    : app,
            ),
        )

        console.log('SYNC_DATA', 'UPDATE', id, status)
        const res = await chrome?.runtime?.sendMessage?.({
            type: 'SYNC_DATA',
            action: 'UPDATE',
            payload: {
                id,
                updates: { jobStatus: status },
            },
        })

        if (res?.ok) {
            setAppSync(id, { syncStatus: 'synced', lastSyncError: undefined })
        } else {
            setAppSync(id, {
                syncStatus: 'failed',
                lastSyncError: res?.error || 'Sync failed',
            })
        }
    }

    const editApplication = async (app: Application) => {
        const exists = applications.some((a) => a.id === app.id)

        setApplications((prev) => exists ? prev.map((a) => (a.id === app.id ? app : a)) : [...prev, app]
    )

        console.log('SYNC_DATA', 'EDIT', app.id, app)
        const res = await chrome?.runtime?.sendMessage?.({
            type: 'SYNC_DATA',
            action: exists ? 'EDIT' : 'CREATE',
            payload: app,
        })

        if (res?.ok) {
            setAppSync(app.id, {
                syncStatus: 'synced',
                lastSyncError: undefined,
            })
        } else {
            setAppSync(app.id, {
                syncStatus: 'failed',
                lastSyncError: res?.error || 'Sync failed',
            })
        }

        setIsEdit(null)
    }

    const stripForSheets = (a: Application) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { syncStatus, lastSyncError, updatedAt, ...rest } = a
        return rest
    }

    const handleConfirmDetectedJob = () => {
        if (!detectedJob) return

        // Add to applications
        addApplication(detectedJob)

        // Clear detected job from storage
        saveDetectedJob(null)
        setDetectedJob(null)
    }

    const handleEditDetectedJob = () => {
        if (!detectedJob) return

        // Open edit form with detected job data
        setIsEdit(detectedJob)

        // Clear detected job
        saveDetectedJob(null)
        setDetectedJob(null)
    }

    const handleDismissDetectedJob = () => {
        // Clear detected job
        saveDetectedJob(null)
        setDetectedJob(null)
    }

    const bgOverlay = 'bg-black/50'

    if (isLoading) return <div>Loading...</div>
    return (
        <>
            <div className="h-full flex flex-col p-4 gap-3">
                <div className="shrink-0">
                    <Stats
                        stats={stats}
                        // theme={theme}
                    />
                </div>
                <div className="flex-1 min-h-0">
                    <ApplicationsCard
                        applications={applications}
                        // theme={theme}
                        onDelete={deleteApplication}
                        onStatusChange={updateStatus}
                        onEdit={(app) => setIsEdit(app)}
                    />
                </div>
                <div className="shrink-0">
                    <ManualEntry
                        onOpen={() => setShowManualEntry(true)}
                        onAdd={addApplication}
                        // theme={theme}
                    />
                </div>
            </div>

            {/* Modal overlay for edit form */}
            {isEdit && (
                <div
                    className={`fixed inset-0 ${bgOverlay} flex items-center justify-center z-50 p-4`}
                    onClick={() => setIsEdit(null)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <Form
                            mode="edit"
                            initialValues={isEdit}
                            onSubmit={editApplication}
                            // theme={theme}
                            onClose={() => setIsEdit(null)}
                        />
                    </div>
                </div>
            )}

            {/* Show confirmation card if job detected */}
            {detectedJob && (
                <div
                    className={`fixed inset-0 ${bgOverlay} flex items-end justify-center z-50 p-4`}
                    onClick={handleDismissDetectedJob}
                >
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PopUp
                            detectedJob={detectedJob}
                            // theme={theme}
                            onConfirm={handleConfirmDetectedJob}
                            onEdit={handleEditDetectedJob}
                            onDismiss={handleDismissDetectedJob}
                        />
                    </div>
                </div>
            )}

            {/* Modal Overlay for Manual Entry Form */}
            {showManualEntry && (
                <div
                    className={`fixed inset-0 ${bgOverlay} flex items-center justify-center z-50 p-4`}
                    onClick={() => setShowManualEntry(false)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <Form
                            mode="create"
                            onSubmit={(app) => {
                                addApplication(app)
                                setShowManualEntry(false)
                            }}
                            // theme={theme}
                            onClose={() => setShowManualEntry(false)}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

export default Home
