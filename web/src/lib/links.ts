import type { Level } from '@shared/domain/types.ts'

/** Deep link into Meta Ads Manager for an entity (same as clicking a row in Retool). */
export function adsManagerUrl(level: Level, accountId: string, id: string): string {
  const base = 'https://adsmanager.facebook.com/adsmanager/manage'
  switch (level) {
    case 'account':
      return `${base}/campaigns?act=${accountId}`
    case 'campaign':
      return `${base}/campaigns?act=${accountId}&selected_campaign_ids=${id}`
    case 'adset':
      return `${base}/adsets?act=${accountId}&selected_adset_ids=${id}`
    case 'ad':
      return `${base}/ads?act=${accountId}&selected_ad_ids=${id}`
  }
}
