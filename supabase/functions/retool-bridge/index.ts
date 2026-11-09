/**
 * retool-bridge — copies data that is still maintained in Retool into Supabase,
 * READ-ONLY, every 15 minutes (plan.md §5 "Running alongside Retool",
 * docs/retool-bridge.md).
 *
 * STATUS: skeleton. Table list and mappings are defined; needs the Retool
 * Database connection string (secret RETOOL_DB_URL, entered by Jordan/Trent in
 * Supabase — never in chat or in the repo).
 *
 * Order matters (foreign keys): employees → clients → everything else.
 */
import postgres from 'npm:postgres@3'
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'

/** Each entry: the SELECT run against Retool, and the Supabase table it fills. */
export const BRIDGE: { target: string; key: string; sql: string }[] = [
  {
    target: 'employees',
    key: 'id',
    sql: `select id, coalesce(first_name,'') first_name, coalesce(last_name,'') last_name, email,
            coalesce(is_ad_manager,false) is_ad_manager, slack_id, coalesce(active,true) active
          from employees`,
  },
  {
    // The ads manager is the GHL contact's native "assignedTo" field, the same
    // thing Retool's Meta Ads Insights reads (current-system.md §5).
    target: 'clients',
    key: 'id',
    sql: `select c.id, c.business_name, c.contact_person_name, c.active_status,
            gc.metadata->>'assignedTo' as ad_manager_id,
            c.contact_id as ghl_contact_id, c.location_id as ghl_location_id,
            gc.metadata as ghl_contact_metadata
          from clients c left join ghl_contacts gc on gc.id = c.contact_id`,
  },
  { target: 'client_onboarding', key: 'client_id', sql: `select *, id as retool_id from campaign_onboarding_info where client_id is not null` },
  { target: 'campaign_specifics', key: 'id', sql: `select * from campaign_specifics` },
  { target: 'sheet_leads', key: 'id', sql: `select * from leads` },
  { target: 'website_campaign_requests', key: 'id', sql: `select * from website_campaign_requests` },
  // NOTE: ad_manager_id is set to null when the GHL user isn't in employees (FK).
  // TODO(phase 0): ghl_custom_fields from ghl_locations.custom_fields_metadata (agency location),
  // and decode lead_sheet_url / website / city into clients.profile.
]

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const url = Deno.env.get('RETOOL_DB_URL')
  if (!url) return json({ error: 'RETOOL_DB_URL not set' }, 500)

  const retool = postgres(url, { ssl: 'require', max: 1 })
  const db = serviceClient()
  try {
    const result = await logRun(db, 'retool_bridge', async () => {
      let rows = 0
      for (const t of BRIDGE) {
        const data = await retool.unsafe(t.sql) // read-only SELECTs defined above
        // TODO(phase 0): map columns per table (drop ones we don't keep), upsert in
        // batches of 500, delete rows that disappeared, update retool_bridge_state.
        rows += data.length
      }
      return { rows }
    })
    return json(result)
  } finally {
    await retool.end()
  }
})
