import { describe, expect, it } from 'vitest'
import {
  chatTranscript, lastContact, onBoard, parseProspectAnswer, pipelineTotals, prospectJevRequest, stageFromGhl, stageOf,
  type ProspectRow,
} from './prospects.ts'

const row = (p: Partial<ProspectRow>): ProspectRow => ({
  contactId: 'c', name: 'A', company: null, source: 'ghl', channel: null, industry: null, aiIndustry: null,
  temperature: null, aiTemperature: null, aiKind: 'prospect', value: null, stage: null, nextStep: null, nextDate: null,
  notes: null, hidden: false, lastMessageAt: null, lastFrom: null, lastPreview: null, messageCount: 0,
  ghlPipeline: null, ghlStage: null, ghlValue: null, updatedAt: null, updatedBy: null, ...p,
})

describe('prospects', () => {
  it('builds the chat Jev reads without contact details, oldest first', () => {
    const t = chatTranscript([
      { direction: 'outbound', body: 'Call me on +1 (555) 123-4567 or a@b.com', type: 'TYPE_SMS', at: '2026-11-02T10:00:00Z' },
      { direction: 'inbound', body: 'Hi, how much for ads? https://x.com/me', type: 'TYPE_FACEBOOK', at: '2026-11-01T10:00:00Z' },
      { direction: 'inbound', body: null, type: 'TYPE_CALL', at: '2026-11-03T10:00:00Z' },
    ])
    expect(t).toBe('Prospect (2026-11-01): Hi, how much for ads? [link]\nMRKD (2026-11-02): Call me on [phone] or [email]')
    expect(chatTranscript([{ direction: 'inbound', body: 'x'.repeat(50), type: null, at: '2026-11-01' }, { direction: 'inbound', body: 'last', type: null, at: '2026-11-02' }], 30))
      .toBe('Prospect (2026-11-02): last')
  })
  it('asks Jev three choice questions', () => {
    const r = prospectJevRequest('Prospect: hi', '2026-11-19')
    expect(Object.keys(r.questions)).toEqual(['kind', 'industry', 'temperature'])
    expect(r.state).toContain('Today is 2026-11-19')
    expect(Object.keys(r.questions.temperature.criteria)).toEqual(['hot', 'warm', 'cold'])
  })
  it('reads Jev answers, never guessing', () => {
    expect(parseProspectAnswer({ kind: { choice: 'prospect', confidence: 0.8 }, industry: { choice: 'steel' }, temperature: { choice: 'boiling' } }))
      .toEqual({ kind: 'prospect', industry: 'steel', temperature: null, confidence: { kind: 0.8 } })
    expect(parseProspectAnswer(null).kind).toBeNull()
  })
  it('maps GHL stages', () => {
    expect(stageFromGhl('Call Booked')).toBe('call1_booked')
    expect(stageFromGhl('Call Held')).toBe('call1_done')
    expect(stageFromGhl('Proposal Sent')).toBe('proposal_sent')
    expect(stageFromGhl('Verbal Yes')).toBe('won')
    expect(stageFromGhl('Not Interested')).toBe('lost')
    expect(stageFromGhl('Nurture - Not Now')).toBe('new')
    expect(stageFromGhl(null)).toBe('new')
    expect(stageOf(row({ stage: 'call2', ghlStage: 'Won' }))).toBe('call2')
  })
  it('totals the pipeline', () => {
    const t = pipelineTotals([
      row({ value: 1000, aiTemperature: 'hot' }),
      row({ value: 500, aiTemperature: 'hot', temperature: 'warm' }),
      row({ value: 700 }),
      row({ value: 900, stage: 'won' }),
      row({ value: 300, stage: 'lost' }),
    ])
    expect(t.open).toBe(3)
    expect(t.openValue).toBe(2200)
    expect(t.byTemperature.hot).toEqual({ count: 1, value: 1000 })
    expect(t.byTemperature.warm).toEqual({ count: 1, value: 500 })
    expect(t.byTemperature.unknown).toEqual({ count: 1, value: 700 })
    expect(t.won).toEqual({ count: 1, value: 900 })
  })
  it('board and last contact', () => {
    expect(onBoard(row({ aiKind: 'candidate' }))).toBe(false)
    expect(onBoard(row({ aiKind: null }))).toBe(false)
    expect(onBoard(row({ aiKind: 'client', stage: 'new' }))).toBe(true)
    expect(onBoard(row({ aiKind: 'consumer', source: 'manual' }))).toBe(true)
    expect(onBoard(row({ hidden: true }))).toBe(false)
    const now = new Date('2026-11-19T12:00:00Z')
    expect(lastContact(row({ lastMessageAt: '2026-11-17T12:00:00Z', lastFrom: 'them' }), now)).toBe('They wrote 2 days ago')
    expect(lastContact(row({ lastMessageAt: '2026-10-29T12:00:00Z', lastFrom: 'us' }), now)).toBe('MRKD wrote 3 weeks ago, no reply')
  })
})
