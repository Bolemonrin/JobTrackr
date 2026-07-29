const CLIENT_ID =
    '365922151307-v93hpaitgkj65nqdmhqh2jrq29ijps0j.apps.googleusercontent.com'
// The authorization-code exchange happens directly against Google's token
// endpoint. A "Web application" OAuth client requires its client secret
// there (an extension can't truly hide it — it ships in the bundle — but
// PKCE+state still protect the flow). Kept out of the repo via .env.local;
// a "Chrome Extension" type client needs no secret at all.
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? ''
const SCOPE =
    'https://www.googleapis.com/auth/drive.file' +
    ' https://www.googleapis.com/auth/userinfo.email'
const REDIRECT = chrome.identity.getRedirectURL()
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

type StoredToken = { accessToken: string; expiresAt: number }

// ---- PKCE / state helpers ----

function base64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

function randomString(len = 64): string {
    return base64url(crypto.getRandomValues(new Uint8Array(len)))
}

async function sha256(text: string): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text),
    )
    return new Uint8Array(digest)
}

type TokenResponse = {
    access_token: string
    expires_in: number
    refresh_token?: string
    scope?: string
}

async function storeTokenResponse(data: TokenResponse): Promise<string> {
    const stored: StoredToken = {
        accessToken: data.access_token,
        // 60s safety margin so we refresh slightly early
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    }
    await chrome.storage.local.set({ authToken: stored })
    // Google only returns a refresh token on the first consent — don't
    // overwrite a stored one with undefined on later sign-ins.
    if (data.refresh_token) {
        await chrome.storage.local.set({ refreshToken: data.refresh_token })
    }
    return data.access_token
}

async function exchangeCodeForToken(
    code: string,
    codeVerifier: string,
): Promise<string> {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT,
    })
    if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET)

    const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)

    const data = (await res.json()) as TokenResponse

    // Google's granular consent lets users untick individual scopes; a token
    // without Drive access would fail every Sheets call later with a 403.
    // Catch it here where the user can just retry.
    if (!data.scope?.includes('drive.file')) {
        throw new Error(
            'Google Drive access was not granted. Please sign in again and ' +
                'tick the Drive checkbox on the consent screen.',
        )
    }

    return storeTokenResponse(data)
}

// Launch the consent flow (authorization code + PKCE). Returns a token
// and caches it; also stores a refresh token for silent renewal.
export async function signIn(): Promise<string> {
    const state = randomString(32)
    const codeVerifier = randomString(64)
    const codeChallenge = base64url(await sha256(codeVerifier))

    const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPE)}` +
        `&prompt=${encodeURIComponent('select_account')}` +
        `&state=${encodeURIComponent(state)}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256` +
        `&access_type=offline`

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
    })
    if (!redirectUrl) throw new Error('Sign-in was cancelled')

    // Code flow returns params in the query string, not the fragment
    const params = new URL(redirectUrl).searchParams

    // Reject any response that doesn't echo our state back (CSRF guard)
    if (params.get('state') !== state)
        throw new Error('OAuth state mismatch — aborting sign-in')

    // Google reports refusals (access_denied, org policy blocks, …) as an
    // error param on the redirect — surface it instead of a generic message
    const oauthError = params.get('error')
    if (oauthError) throw new Error(`Google refused sign-in: ${oauthError}`)

    const code = params.get('code')
    if (!code) throw new Error('No authorization code in redirect')

    return exchangeCodeForToken(code, codeVerifier)
}

// Renew the access token without any UI, using the stored refresh token.
// Returns null when silent renewal isn't possible (never signed in, grant
// revoked, …) — the caller decides whether to go interactive.
export async function silentSignIn(): Promise<string | null> {
    const { refreshToken } = await chrome.storage.local.get('refreshToken')
    if (typeof refreshToken !== 'string' || !refreshToken) return null

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    })
    if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET)

    try {
        const res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        })
        if (!res.ok) {
            // Refresh token revoked or expired — clear it so we stop trying
            await chrome.storage.local.remove('refreshToken')
            return null
        }
        return await storeTokenResponse((await res.json()) as TokenResponse)
    } catch {
        return null // network failure etc. — just report "can't do it silently"
    }
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
    // reuses the same account's session. Revoking the refresh token kills
    // the whole grant. Best-effort — clear local state even if revocation
    // fails (e.g. token already expired).
    const { refreshToken } = await chrome.storage.local.get('refreshToken')
    const token =
        typeof refreshToken === 'string' && refreshToken
            ? refreshToken
            : await getStoredToken()
    if (token) {
        await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
            { method: 'POST' },
        ).catch(() => {})
    }
    await chrome.storage.local.remove([
        'authToken',
        'refreshToken',
        'accountEmail', // legacy key from the pre-PKCE flow
    ])
    // The sheet belongs to the account that just disconnected; a different
    // account can't use it, so force re-create/re-link on next sign-in.
    await chrome.storage.sync.remove('sheetUrl')
}
