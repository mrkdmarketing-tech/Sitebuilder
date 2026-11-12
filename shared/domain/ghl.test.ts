import { describe, expect, it } from 'vitest'
import { explainGhlError, summariseContact } from './ghl.ts'

const fields = { status: 'Qukwm5t43UFGbdfB3ZAE', clientId: '5mEV9stcKBRerrKWswHI' }

describe('GHL contacts', () => {
  it('reads status, client number and ads manager', () => {
    const raw = { contact: {
      id: 'c1', locationId: 'L', companyName: 'Gracie Barra Renton', firstName: 'A', assignedTo: 'u1',
      customFields: [{ id: 'Qukwm5t43UFGbdfB3ZAE', value: 'Active' }, { id: '5mEV9stcKBRerrKWswHI', value: 168 }],
    } }
    expect(summariseContact(raw, fields)).toEqual({ contactId: 'c1', locationId: 'L', clientId: 168, name: 'Gracie Barra Renton', clientStatus: 'Active', assignedTo: 'u1' })
  })
  it('copes with missing fields and bad input', () => {
    expect(summariseContact({ id: 'c2', firstName: 'Sam', lastName: 'Lee' }, fields)).toMatchObject({ name: 'Sam Lee', clientId: null, clientStatus: null, assignedTo: null })
    expect(summariseContact(null, fields)).toBeNull()
  })
  it('explains refusals', () => {
    expect(explainGhlError(403, '/users/', '')).toContain('View')
    expect(explainGhlError(401, '/x', '')).toContain('GHL_PRIVATE_TOKEN')
  })
})
