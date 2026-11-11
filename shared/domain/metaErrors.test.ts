import { describe, expect, it } from 'vitest'
import { explainMetaError, metaErrorDetail } from './metaErrors.ts'

describe('Meta refusals', () => {
  it('explains the ones seen on 11 Nov 2026', () => {
    expect(explainMetaError({ code: 100, error_subcode: 3390001, error_user_title: 'Missing Lead Form' }).kind).toBe('page')
    expect(explainMetaError({ code: 200, error_subcode: 2490591, message: 'Permissions error' }).kind).toBe('account')
    expect(explainMetaError({ code: 200, error_subcode: 2490592, error_user_title: 'Ad account not writable' }).kind).toBe('unwritable')
    expect(explainMetaError({ code: 1, message: 'Something else' })).toMatchObject({ kind: 'other', short: 'Meta refused: Something else' })
  })
  it('keeps everything for the log', () => {
    expect(metaErrorDetail({ message: 'Invalid parameter', code: 100, error_subcode: 3390001, error_user_title: 'Missing Lead Form', fbtrace_id: 'x' }))
      .toBe('Missing Lead Form | Invalid parameter | code 100/3390001 | trace x')
  })
})
