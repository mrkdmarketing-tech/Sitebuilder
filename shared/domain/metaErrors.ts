/**
 * Meta's refusals in plain English (docs/setup/meta.md#checked-11-nov-2026-why-turn-off-failed).
 * Used by meta-action (Turn off) and run-rules (checking in advance whether
 * Turn off will work, so Today can say so instead of showing a button that fails).
 */
export type MetaError = {
  message?: string; code?: number; error_subcode?: number
  error_user_title?: string; error_user_msg?: string; fbtrace_id?: string
}

export type TurnOffBlock = 'page' | 'account' | 'unwritable' | 'other'

export interface MetaRefusal {
  kind: TurnOffBlock
  /** One line for the row on Today. */
  short: string
  /** The full explanation shown after a failed Turn off. */
  message: string
}

/** Everything Meta said, for the log. */
export const metaErrorDetail = (e: MetaError) =>
  [e.error_user_title, e.error_user_msg, e.message, `code ${e.code ?? '?'}/${e.error_subcode ?? '-'}`, e.fbtrace_id && `trace ${e.fbtrace_id}`]
    .filter(Boolean).join(' | ')

export function explainMetaError(e: MetaError): MetaRefusal {
  // Lead ads: Meta re-checks the whole ad on any change; if The Lab can't see the client's Page,
  // it can't see the instant form and says the form is missing (code 100 / 3390001).
  if (e.error_subcode === 3390001 || /lead form/i.test(e.error_user_title ?? '')) {
    return {
      kind: 'page',
      short: "The Lab can't see this client's Facebook Page",
      message: "Meta won't let The Lab change this lead ad: The Lab can't see this client's Facebook Page, so Meta thinks the instant form is missing. Turn it off in Ads Manager for now. To fix it for good, give MRKDPlatformTools access to the client's Page (Business settings, System users, Assign assets, Pages).",
    }
  }
  if (e.error_subcode === 2490592) {
    return {
      kind: 'unwritable',
      short: "Meta says this ad account can't be changed",
      message: "Meta says this ad account can't be changed right now (often it's disabled or has a payment problem). Check the account in Ads Manager.",
    }
  }
  if ([10, 200, 294].includes(e.code ?? 0) || /permission/i.test(e.message ?? '')) {
    return {
      kind: 'account',
      short: 'This ad account is view-only for The Lab',
      message: 'This ad account only lets The Lab view, not change ads. In Business settings, give MRKDPlatformTools "Manage campaigns" on this account. Until then, turn it off in Ads Manager.',
    }
  }
  const said = e.error_user_msg ?? e.message ?? 'unknown error'
  return { kind: 'other', short: `Meta refused: ${said}`, message: `Meta refused: ${said}${e.error_user_title ? ` (${e.error_user_title})` : ''}. Turn it off in Ads Manager.` }
}
