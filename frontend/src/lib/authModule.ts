const CLIENT_ID =
    '365922151307-v93hpaitgkj65nqdmhqh2jrq29ijps0j.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const REDIRECT = chrome.identity.getRedirectURL()

type StoredToken = { accessToken: string; expiresAt: number }

// Launch the consent flow. Returns a token and caches it.
export async function signIn(): Promise<string> {
    const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(SCOPE)}` +
        `&prompt=${encodeURIComponent('select_account consent')}`

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
    })
    if (!redirectUrl) throw new Error('Sign-in was cancelled')

    // Token comes back in the URL *fragment*, not the query string
    const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1))

    // Google reports refusals (access_denied, org policy blocks, …) as an
    // error param on the redirect — surface it instead of a generic message
    const oauthError = params.get('error')
    if (oauthError) throw new Error(`Google refused sign-in: ${oauthError}`)

    const accessToken = params.get('access_token')
    const expiresIn = Number(params.get('expires_in') ?? 3600)
    if (!accessToken) throw new Error('No access token in redirect')

    const stored: StoredToken = {
        accessToken,
        // 60s safety margin so we refresh slightly early
        expiresAt: Date.now() + (expiresIn - 60) * 1000,
    }
    await chrome.storage.local.set({ authToken: stored })
    return accessToken
}

// Read the cached token; null if missing or expired.
export async function getStoredToken(): Promise<string | null> {
    const { authToken } = await chrome.storage.local.get('authToken')
    const t = authToken as StoredToken | undefined
    if (!t?.accessToken) return null
    if (Date.now() >= t.expiresAt) return null
    return t.accessToken
}

export async function signOut(): Promise<void> {
    // Revoke the grant with Google, otherwise the next signIn silently
    // reuses the same account's session. Best-effort — clear local state
    // even if revocation fails (e.g. token already expired).
    const token = await getStoredToken()
    if (token) {
        await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
            { method: 'POST' },
        ).catch(() => {})
    }
    await chrome.storage.local.remove('authToken')
    // The sheet belongs to the account that just disconnected; a different
    // account can't use it, so force re-create/re-link on next sign-in.
    await chrome.storage.sync.remove('sheetUrl')
}
