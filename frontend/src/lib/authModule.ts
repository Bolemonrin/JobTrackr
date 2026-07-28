const CLIENT_ID =
    '365922151307-v93hpaitgkj65nqdmhqh2jrq29ijps0j.apps.googleusercontent.com'
const SCOPE =
    'https://www.googleapis.com/auth/drive.file' +
    ' https://www.googleapis.com/auth/userinfo.email'
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
        `&prompt=${encodeURIComponent('select_account')}`

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

    // Google's granular consent lets users untick individual scopes; a token
    // without Drive access would fail every Sheets call later with a 403.
    // Catch it here where the user can just retry.
    const grantedScopes = params.get('scope') ?? ''
    if (!grantedScopes.includes('drive.file')) {
        throw new Error(
            'Google Drive access was not granted. Please sign in again and ' +
                'tick the Drive checkbox on the consent screen.',
        )
    }

    const stored: StoredToken = {
        accessToken,
        // 60s safety margin so we refresh slightly early
        expiresAt: Date.now() + (expiresIn - 60) * 1000,
    }
    await chrome.storage.local.set({ authToken: stored })

    // Remember which account signed in so silentSignIn can pass it as
    // login_hint. Best-effort — sign-in still succeeds without it.
    try {
        const info = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            { headers: { Authorization: `Bearer ${accessToken}` } },
        ).then((r) => r.json())
        if (info.email) {
            await chrome.storage.local.set({ accountEmail: info.email })
        }
    } catch (e) {
        console.warn('Could not fetch account email', e)
    }

    return accessToken
}

export async function silentSignIn(): Promise<string | null> {
    const { accountEmail } = await chrome.storage.local.get('accountEmail')
    if (typeof accountEmail !== 'string' || !accountEmail) return null

    const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(SCOPE)}` +
        `&prompt=none` +
        `&login_hint=${encodeURIComponent(accountEmail)}`

    // interactive:false rejects whenever Google needs the user (session
    // expired, grant revoked, …) — any failure here just means "can't do
    // it silently", so return null and let the caller go interactive.
    let redirectUrl: string | undefined
    try {
        redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: false,
        })
    } catch {
        return null
    }
    if (!redirectUrl) return null

    // Token comes back in the URL *fragment*, not the query string
    const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1))

    // prompt=none refusals arrive as an error param (interaction_required…)
    if (params.get('error')) return null

    const accessToken = params.get('access_token')
    const expiresIn = Number(params.get('expires_in') ?? 3600)
    if (!accessToken) return null

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
    await chrome.storage.local.remove(['authToken', 'accountEmail'])
    // The sheet belongs to the account that just disconnected; a different
    // account can't use it, so force re-create/re-link on next sign-in.
    await chrome.storage.sync.remove('sheetUrl')
}
