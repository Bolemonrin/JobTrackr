import { describe, it, expect } from 'vitest'

const patterns = [
    /\$\d{1,3}(,\d{3})*(\.\d+)?\s*-\s*\$\d{1,3}(,\d{3})*(\.\d+)?/,
    /\$\d{1,3}(,\d{3})*(\.\d+)?\s*per\s*(year|month|week|day|hour)/i,
    /\$\d{1,3}(,\d{3})*(\.\d+)?(\/hour)?/,
    /\b\d{1,3}(,\d{3})*(\.\d+)?\s*(USD|EUR|GBP|CAD|AUD)\b/i,
]

function extractSalary(text: string) {
    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[0]
    }
    return ''
}

describe('salary extraction', () => {
    it('extracts a range', () => {
        expect(extractSalary('Salary: $161,800 - $184,600 per year')).toBe('$161,800 - $184,600')
    })
    it('extracts hourly with no dollar sign', () => {
        expect(extractSalary('an Hourly salary of 41.53 USD')).toBe('41.53 USD')
    })
    it('returns empty string when no salary found', () => {
        expect(extractSalary('No compensation info available')).toBe('')
    })
})
