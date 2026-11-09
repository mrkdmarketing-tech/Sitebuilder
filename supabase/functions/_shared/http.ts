// Small helpers for HTTP-triggered functions.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Scheduled jobs are called by pg_cron with this shared secret (docs/background-jobs.md). */
export function isAuthorisedCron(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')
  return !!expected && req.headers.get('x-cron-secret') === expected
}
