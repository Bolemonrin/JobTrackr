/** @format */
import { describe, it, expect } from 'vitest'
import { extractSalaryFromText } from '../lib/extractors'

// Imports the shipping implementation rather than re-declaring the patterns,
// so a change to the extractor can actually fail this suite.
describe('salary extraction', () => {
    it('extracts a range', () => {
        expect(extractSalaryFromText('Salary: $161,800 - $184,600 per year')).toBe(
            '$161,800 - $184,600',
        )
    })
    it('extracts hourly with no dollar sign', () => {
        expect(extractSalaryFromText('an Hourly salary of 41.53 USD')).toBe('41.53 USD')
    })
    it('returns empty string when no salary found', () => {
        expect(extractSalaryFromText('No compensation info available')).toBe('')
    })
})
