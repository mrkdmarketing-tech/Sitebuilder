import { describe, expect, it } from 'vitest'
import {
  canMove, checkableText, emptyCreative, emptyLeadForm, fieldLabel, fillPlaceholders, fillTemplate,
  findingKey, parseCheckResult, placeholderValues, toCreative, toLeadForm, unfilledPlaceholders,
} from './approvals.ts'

describe('status moves', () => {
  it('follows draft -> review -> approved -> live', () => {
    expect(canMove('draft', 'review_pending')).toBe(true)
    expect(canMove('review_pending', 'approved')).toBe(true)
    expect(canMove('approved', 'completed')).toBe(true)
  })
  it('allows changes to bounce back and forth', () => {
    expect(canMove('review_pending', 'request_changes')).toBe(true)
    expect(canMove('request_changes', 'review_pending')).toBe(true)
  })
  it('blocks skipping review and reopening live ads', () => {
    expect(canMove('draft', 'approved')).toBe(false)
    expect(canMove('completed', 'draft')).toBe(false)
  })
})

describe('placeholders', () => {
  const values = { city: 'Boca Raton', business_name: 'Renzo Gracie Boca', offer: '' }
  it('fills known keys regardless of spacing and case', () => {
    expect(fillPlaceholders('Train in {{ city }} at {{Business_Name}}', values)).toBe('Train in Boca Raton at Renzo Gracie Boca')
  })
  it('leaves unknown or empty keys visible', () => {
    expect(fillPlaceholders('{{ offer }} {{ nope }}', values)).toBe('{{ offer }} {{ nope }}')
    expect(unfilledPlaceholders('{{ offer }} and {{offer}} and {{ nope }}')).toEqual(['offer', 'nope'])
  })
  it('fills nested template bodies', () => {
    expect(fillTemplate({ headline: 'Hi {{city}}', questions: ['In {{ city }}?'] }, values))
      .toEqual({ headline: 'Hi Boca Raton', questions: ['In Boca Raton?'] })
  })
})

describe('copy', () => {
  it('reads partial or odd JSON safely', () => {
    expect(toCreative({ headline: 'Hi', tracking: ['CRM Event', null] })).toEqual({ ...emptyCreative(), headline: 'Hi', tracking: ['CRM Event'] })
    expect(toLeadForm(null)).toEqual(emptyLeadForm())
  })
  it('lists only text that has content, with stable field names', () => {
    const t = checkableText(
      { ...emptyCreative(), headline: 'Free week', primaryText: '  ' },
      { ...emptyLeadForm(), questions: ['Name?', '', 'Age?'] },
    )
    expect(t.map((x) => x.field)).toEqual(['creative.headline', 'leadform.questions.0', 'leadform.questions.2'])
    expect(fieldLabel('leadform.questions.2')).toBe('Question 3')
    expect(fieldLabel('creative.primaryText')).toBe('Primary text')
  })
})

describe('Retool shapes', () => {
  it('reads Retool lead form and creative names', () => {
    expect(toLeadForm({ messageForLeadsHeadline: 'Almost done' }).thankYouHeadline).toBe('Almost done')
    expect(toCreative({ descriptionAdCreative: 'Free class' }).description).toBe('Free class')
  })
  it('offers the placeholder names Retool templates use', () => {
    const v = placeholderValues({ business_name: 'Northside BJJ', address: '1 Main St', city: 'Ottawa', state: 'ON', phone: null })
    expect(fillPlaceholders('{{ company_name }} at {{ business_address }} ({{ contact.city }})', v))
      .toBe('Northside BJJ at 1 Main St, Ottawa, ON (Ottawa)')
    expect(v.phone).toBeUndefined()
  })
})

describe('parseCheckResult', () => {
  it('keeps valid findings and cleans up the rest', () => {
    const r = parseCheckResult({
      findings: [
        { field: 'creative.headline', category: 'spelling', severity: 'error', excerpt: 'Jiu Jitsue', message: 'Misspelled', suggestion: 'Jiu Jitsu' },
        { field: '', category: 'made-up', severity: 'loud', message: 'Image says Tuesday, copy says Thursday', assetNumber: 2, location: 'image 2' },
        { message: '' },
        'nonsense',
      ],
      checklist: { logo: 'pass', city: 'fail', alignment: 'maybe', unknown: 'pass' },
    }, ['logo', 'city', 'alignment'])
    expect(r.findings).toHaveLength(2)
    expect(r.findings[1]).toMatchObject({ field: 'asset', category: 'other', severity: 'warning', assetNumber: 2 })
    expect(r.checklist).toEqual({ logo: 'pass', city: 'fail' })
  })
  it('survives a missing or broken response', () => {
    expect(parseCheckResult(undefined, ['logo'])).toEqual({ findings: [], checklist: {} })
  })
  it('matches the same issue across runs even if reworded', () => {
    const a = findingKey({ field: 'creative.headline', excerpt: 'Jiu Jitsue', category: 'spelling' })
    const b = findingKey({ field: 'creative.headline', excerpt: ' jiu jitsue ', category: 'spelling' })
    expect(a).toBe(b)
  })
})
