# JobTrackr

A Chrome extension that automatically detects job postings as you browse and saves them to a Google Sheet you own.

No manual data entry, no copy-pasting, and no third-party server holding your job-search history — the extension writes directly to a spreadsheet in your own Google Drive using your own Google account.

---

## Features

- **Automatic detection** of job title, company, location, posting URL, and salary where available
- **Works on any site that publishes standard job-posting data** (schema.org `JobPosting` JSON-LD), plus dedicated support for LinkedIn, Indeed, and Glassdoor
- **One-click confirm** — a detected job appears in the popup; you decide whether to save it
- **Your data, your sheet** — the extension creates a spreadsheet in your Drive and syncs to it
- **Manual entry and editing** for anything the detector misses
- **Status tracking** — applied, interview, offer, rejected
- **Import** — pull your applications back from the sheet onto a new device

---

## How it works

```
┌─────────────────┐
│  Job posting    │
│  (any website)  │
└────────┬────────┘
         │  content script reads the page
         ▼
┌─────────────────────────────────────────┐
│  content.ts  (isolated world)           │
│   • JSON-LD JobPosting extraction       │
│   • LinkedIn DOM extraction (SDUI pane) │
│   • receives messages from inject.ts    │
└────────┬────────────────────────────────┘
         │  chrome.storage.local → detectedJob
         ▼
┌─────────────────────────────────────────┐
│  Popup (React)                          │
│   • shows "Job Detected!" card          │
│   • user confirms / edits / dismisses   │
└────────┬────────────────────────────────┘
         │  chrome.runtime.sendMessage(SYNC_DATA)
         ▼
┌─────────────────────────────────────────┐
│  background.ts (service worker)         │
│   • attaches the user's OAuth token     │
└────────┬────────────────────────────────┘
         │  HTTPS, Authorization: Bearer …
         ▼
┌─────────────────────────────────────────┐
│  sheets.googleapis.com                  │
│   → the user's own spreadsheet          │
└─────────────────────────────────────────┘
```

### Detection strategy

Detection runs in tiers, so coverage extends well past a hardcoded site list:

1. **JSON-LD `JobPosting`** — the generic path. Most job boards and company career pages publish structured data for Google Jobs, so the extension reads it directly. Handles `@type` as a string or array, and `JobPosting` nested inside `@graph`.
2. **Site-specific adapters** — Indeed and Glassdoor intercept the site's own fetch responses (via a MAIN-world script) for richer data; LinkedIn uses scoped DOM extraction against its server-driven UI, since its split-pane view swaps jobs without a page load.

### Authentication

The extension uses `chrome.identity.launchWebAuthFlow` to sign the user in with Google and receive a short-lived access token. That token is attached to Sheets API requests made **directly from the browser**.

Only the `drive.file` scope is requested — the narrowest option available, granting access solely to files the extension itself creates. The extension cannot see or touch anything else in the user's Drive.

**There is no backend.** The developer operates no server, and no job data is ever transmitted anywhere except to Google, authenticated with the user's own credentials.

---

## Tech stack

| Layer     | Tools                           |
| --------- | ------------------------------- |
| Extension | Chrome Manifest V3, TypeScript  |
| UI        | React 19, Tailwind CSS          |
| Build     | Vite                            |
| Testing   | Vitest                          |
| Data      | Google Sheets API v4, OAuth 2.0 |

---

## Project structure

```
frontend/
├── public/
│   ├── manifest.json        # MV3 manifest
│   └── icons/               # extension icons (16/32/48/128)
└── src/
    ├── background.ts        # service worker: SYNC_DATA handler
    ├── content.ts           # isolated world: detection + storage
    ├── inject.ts            # MAIN world: fetch interception
    ├── lib/
    │   ├── auth.ts          # OAuth: signIn / getStoredToken / signOut
    │   ├── sheets.ts        # Sheets API: create, read, update, delete
    │   ├── storage.ts       # chrome.storage wrappers
    │   └── scripts.ts       # dynamic content-script registration
    ├── components/          # React popup UI
    ├── types/               # shared TypeScript types
    └── test/                # Vitest suites
```

---

## Local development

### Prerequisites

- Node.js 20+
- A Google Cloud project with the **Google Sheets API** enabled
- An OAuth 2.0 Client ID of type **Web application**

### 1. Configure OAuth

In the [Google Cloud Console](https://console.cloud.google.com):

1. Enable the **Google Sheets API** and the **Google Drive API**
2. Configure the **OAuth consent screen** (Data Access) with the scopes `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/userinfo.email`
3. Create an OAuth 2.0 Client ID (**Web application**)
4. Add an authorized redirect URI — run `chrome.identity.getRedirectURL()` in the extension's console and paste the result (looks like `https://<extension-id>.chromiumapp.org/`)
5. Put the resulting client ID in `src/lib/authModule.ts`

> To keep a stable extension ID between local and published builds, add the published item's public key to `manifest.json` as the `key` field.

### 2. Install and build

```bash
cd frontend
npm install
cp .env.example .env.local   # then paste the OAuth client secret into it
npm run build
```

The client secret lives in `frontend/.env.local` (gitignored) and is inlined into the bundle at build time — the build fails sign-in at runtime without it.

### 3. Load into Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `frontend/dist`

### Scripts

```bash
npm run build     # tsc -b && vite build
npm run test      # vitest
npm run lint      # eslint
```

Rebuild and hit the reload icon on the extension card after any source change — the extension runs from `dist/`, not from source.

---

## Packaging for the Chrome Web Store

```bash
cd frontend
npm run build
cd dist
zip -r ../jobtrackr.zip .
```

`manifest.json` must sit at the **root** of the archive — hence the `cd dist` before zipping. Verify with `unzip -l ../jobtrackr.zip | head`.

---

## Permissions

| Permission                                                              | Why                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `storage`                                                               | Settings, the pending detected job, and the local access token                                                |
| `scripting`                                                             | Registering content scripts on enabled sites                                                                  |
| `identity`                                                              | Google sign-in via OAuth                                                                                      |
| `<all_urls>`                                                            | Job postings appear on arbitrary career sites; needed to detect structured job data wherever the user browses |
| `sheets.googleapis.com`, `accounts.google.com`, `oauth2.googleapis.com` | Authentication and spreadsheet reads/writes                                                                   |

---

## Privacy

JobTrackr reads job-posting data only, writes only to the user's own spreadsheet, and sends nothing to any developer-operated server. See the [privacy policy](https://bolemonrin.github.io/MyPortfolio/privacy.html) for details.

---

## Known limitations

- **Chrome only.** `chrome.identity` is not available in Microsoft Edge.
- **Access tokens expire hourly.** The implicit OAuth flow provides no refresh token, so re-authentication is occasionally required.
- **Existing sheets can't be connected.** The `drive.file` scope only covers files the extension creates. Connecting a pre-existing spreadsheet would require the Google Picker.
- **Salary extraction** is currently reliable on Indeed only.
- **LinkedIn selectors** depend on generated class names in one place and may need updating after LinkedIn redeploys.

---

## Roadmap

- Google Picker, so users can connect an existing spreadsheet
- Silent re-authentication (`prompt=none`) to reduce sign-in friction
- Salary extraction for LinkedIn and Glassdoor
- Cross-device settings sync via `chrome.storage.sync`
- Firefox / Edge support via a portable auth flow

---

## License

MIT
