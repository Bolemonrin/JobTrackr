/** @format */

import type { Application } from '../types'

// ---- Keys (one place only) ----
export const STORAGE_KEYS = {
    // theme: "theme",
    supportedSites: 'supportedSites',
    sheetUrl: 'sheetUrl',
    status: 'status',

    // large data
    applications: 'applications',
    detectedJob: 'detectedJob',
} as const

// ---- Defaults ----
// const DEFAULT_THEME: Theme = "lightmode";
const DEFAULT_SITES: string[] = [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
    'handshake.com',
]

// ---- Small utils ----
function hasChromeStorage(): boolean {
    return typeof chrome !== 'undefined' && !!chrome?.storage
}

function getSync<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        if (!hasChromeStorage()) return resolve(undefined)

        chrome.storage.sync.get([key], (data) => {
            const err = chrome.runtime?.lastError
            if (err) return reject(err)
            resolve(data[key] as T | undefined)
        })
    })
}

function setSync(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!hasChromeStorage()) return resolve()

        chrome.storage.sync.set({ [key]: value }, () => {
            const err = chrome.runtime?.lastError
            if (err) return reject(err)
            resolve()
        })
    })
}

function getLocal<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        if (!hasChromeStorage()) return resolve(undefined)

        chrome.storage.local.get([key], (data) => {
            const err = chrome.runtime?.lastError
            if (err) return reject(err)
            resolve(data[key] as T | undefined)
        })
    })
}

function setLocal(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!hasChromeStorage()) return resolve()

        chrome.storage.local.set({ [key]: value }, () => {
            const err = chrome.runtime?.lastError
            if (err) return reject(err)
            resolve()
        })
    })
}

// ---- Type guards ----
// function isTheme(v: unknown): v is Theme {
// 	// considers v as THEME type
// 	// checks if v is lightmode or darkmode
// 	return v === "lightmode" || v === "darkmode";
// }

function isStringArray(v: unknown): v is string[] {
    // makees the v a string array
    //first checks if v is an array
    // then checks if every element in the array is a string
    return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isApplicationArray(v: unknown): v is Application[] {
    // keep this light; full validation is overkill for now
    //considers v as Application array
    //checks if v is an array
    return Array.isArray(v)
}

function isADetectedJob(v: unknown): v is Application | null {
    // If it's null, that's valid (no job detected)
    if (v === null) return true

    // If it's not an object, it's invalid
    if (typeof v !== 'object' || v === null) return false

    // Check if it has the required Application fields
    // At minimum, check for 'id' field
    const hasId = 'id' in v

    return hasId
}

// ---- Public API: Preferences (sync) ----
// export async function loadTheme(): Promise<Theme> {
// 	// loads theme from chrome storage
// 	// check if theme is valid
// 	// if not, return default
// 	const v = await getSync<unknown>(STORAGE_KEYS.theme);
// 	return isTheme(v) ? v : DEFAULT_THEME;
// }

// export async function saveTheme(theme: Theme): Promise<void> {
// 	// saves theme to chrome storage
// 	await setSync(STORAGE_KEYS.theme, theme);
// }

export async function loadSupportedSites(): Promise<string[]> {
    // loads supported sites from chrome storage
    // check if sites is valid
    // if not, return default sites
    const v = await getSync<unknown>(STORAGE_KEYS.supportedSites)
    return isStringArray(v) && v.length ? v : DEFAULT_SITES
}

export async function saveSupportedSites(sites: string[]): Promise<void> {
    // saves supported sites to chrome storage
    await setSync(STORAGE_KEYS.supportedSites, sites)
}

export async function loadSheetUrl(): Promise<string> {
    // loads sheet url from chrome storage
    // check if sheet url is valid
    // if not, return empty
    const v = await getSync<unknown>(STORAGE_KEYS.sheetUrl)
    return typeof v === 'string' ? v : ''
}

export async function saveSheetUrl(url: string): Promise<void> {
    // saves sheet url to chrome storage
    await setSync(STORAGE_KEYS.sheetUrl, url)
}

// ---- Public API: Applications (local) ----
export async function loadApplications(): Promise<Application[]> {
    // loads applications from chrome storage
    // check if applications is valid
    // if not, return empty
    // uses chrome local storage cause total applications can get very big
    const v = await getLocal<unknown>(STORAGE_KEYS.applications)
    return isApplicationArray(v) ? v : []
}

export async function saveApplications(apps: Application[]): Promise<void> {
    // saves applications to chrome storage
    await setLocal(STORAGE_KEYS.applications, apps)
}

export async function loadDetectedJob(): Promise<Application | null> {
    // loads applications from chrome storage
    // check if applications is valid
    // if not, return empty
    // uses chrome local storage cause total applications can get very big
    const v = await getLocal<unknown>(STORAGE_KEYS.detectedJob)
    return isADetectedJob(v) ? v : null
}

export async function saveDetectedJob(job: Application | null): Promise<void> {
    // saves applications to chrome storage
    await setLocal(STORAGE_KEYS.detectedJob, job)
}
