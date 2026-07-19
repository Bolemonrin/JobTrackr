# JobTrackr

A Chrome extension that automatically detects jobs you view on Indeed, lets you confirm or edit the details, and syncs your applications directly to a Google Sheet — no manual data entry required.

---

## Features

- **Auto-detection** — Intercepts Indeed's internal API calls to extract job metadata (title, company, location, salary) as you browse
- **One-click logging** — Confirm, edit, or dismiss detected jobs from the extension popup
- **Google Sheets sync** — Applications sync to your own Google Sheet via a Google Apps Script backend
- **Manual entry** — Add applications from any site manually through the popup form
- **Status tracking** — Track each application through stages: Applied, Interview, Offer, Rejected
- **Offline-first** — All data is stored locally in `chrome.storage.local` first, then synced

---

## How It Works

```
Indeed page loads
      ↓
inject.js intercepts /viewjob fetch (runs in page context)
      ↓
Extracts job metadata from Indeed's API response + DOM (salary)
      ↓
Sends data to content.js via window.postMessage
      ↓
content.js writes to chrome.storage.local as `detectedJob`
      ↓
Popup (Home.tsx) reads storage and shows confirmation card
      ↓
On confirm → saved to applications[] → synced to Google Sheets
```

---

## Installation (Development)

### Prerequisites
- Node.js 18+
- A Google account (for Sheets sync)

### Setup

```bash
git clone https://github.com/AfricanBolu/JobTrackr.git
cd JobTrackr/frontend
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Google Sheets Sync Setup

1. Create a new Google Sheet
2. Open **Extensions → Apps Script** and paste in the Apps Script backend code
3. Deploy as a **Web App** (execute as yourself, access to anyone with the link)
4. Copy the deployment URL
5. Open the JobTrackr extension → **Settings** → paste the URL into the Sheet URL field

---

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx
│   ├── content.ts          # Content script — bridges inject.js and chrome storage
│   ├── inject.ts           # Page script — intercepts Indeed fetch calls
│   ├── background.ts       # Service worker — handles Google Sheets sync messages
│   ├── lib/
│   │   ├── storage.ts      # Chrome storage read/write abstraction
│   │   ├── schema.ts       # Application → Sheets row mapping
|   |   └── script.ts       # Make the websites easier to add for auto detection
│   ├── components/
│   │   ├── Body/
│   │   │   ├── Home/
|   │   │   │   ├── PopUp.tsx         # Detected job confirmation card
|   |   │   │   ├── ApplicationsCard.tsx
│   │   │   |   ├── Form.tsx
│   │   │   |   ├── ManualEntry.tsx
│   │   │   |   └── Stats.tsx
|   |   |   └── Home.tsx
│   │   └── Header/
│   │   │   ├── Settings/
|   |   │   │   ├── Data.tsx
│   │   │   |   ├── Settings.tsx
│   │   │   |   ├── SiteSettings.tsx
│   │   │   └── Nav.tsx
│   ├── types/
|   |   └── index.ts
├── public/
|   └── manifest.json
|   ...
└── vite.config.ts
```

---

## Tech Stack

- **React 19** + **TypeScript** — Popup UI
- **Tailwind CSS v4** — Styling
- **Vite** — Build tool (dual build: app + extension scripts)
- **Chrome Extensions Manifest V3**
- **Google Apps Script** — Sheets sync backend

---

## Supported Job Sites

| Site | Auto-detection | Manual Entry |
|------|---------------|--------------|
| Indeed | ✅ | ✅ |
| LinkedIn | 🚧 In progress | ✅ |
| Glassdoor | ✅ | ✅ |
| Handshake | ✅ | ✅ |
| Other Websites | ✅ | ✅ |

---

## Application Data Model

Each tracked application stores:

| Field | Description |
|-------|-------------|
| `id` | Unique ID (`crypto.randomUUID()`) |
| `jobTitle` | Role title |
| `companyName` | Company name |
| `location` | Location or remote status |
| `salary` | Salary range if listed |
| `jobStatus` | `applied` / `interview` / `offer` / `rejected` |
| `syncStatus` | `pending` / `synced` / `failed` |
| `appliedFromName` | Source site (e.g. "Indeed") |
| `appliedFromUrl` | Direct link to the job posting |
| `dateApplied` | ISO timestamp |

---

## Build Scripts

```bash
npm run dev       # Start Vite dev server (popup UI only)
npm run build     # Full build: tsc + popup + extension scripts
npm run lint      # ESLint
```

The build runs in two passes:
1. **Main build** — React popup app → `dist/assets/`
2. **Scripts build** (`BUILD_TARGET=scripts`) — `content.ts`, `inject.ts`, `background.ts` bundled as IIFE (no ES module imports) → `dist/`

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/linkedin-support`)
3. Commit your changes
4. Open a pull request

---

## License

MIT
