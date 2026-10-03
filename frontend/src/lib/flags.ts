/** @format */

/**
 * ───────────────────────────────────────────────────────────────────────
 *  A/B SWITCH — measures what the site-specific adapters are actually worth.
 * ───────────────────────────────────────────────────────────────────────
 *
 *  true   Full tiered system. Indeed / Glassdoor / LinkedIn each use their
 *         own adapter, with the generic schema.org JSON-LD fallback behind
 *         them for every other site.
 *
 *  false  Adapters OFF. Every site — Indeed and Glassdoor and LinkedIn
 *         included — goes through the generic JSON-LD fallback only.
 *
 *  To switch arms:
 *      1. change the value below
 *      2. npm run build
 *      3. reload the unpacked extension at chrome://extensions
 *      4. confirm the banner in the page console says the mode you expect
 *
 *  Browse postings the SAME way in both arms — full page load each time,
 *  not in-place SPA clicks. The LinkedIn MutationObserver that catches
 *  pane swaps lives in the adapter, so in fallback-only mode a click-through
 *  extracts nothing and would score as a miss that isn't real.
 */
export const ADAPTERS_ENABLED = true
