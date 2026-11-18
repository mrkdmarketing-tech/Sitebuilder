/**
 * Style kit files for Ad Studio (docs/ad-studio.md), from the private
 * style_kit_files table (migration 3400). Files are cached in the browser by
 * their sha256, so each is downloaded once.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface KitFile { path: string; kind: 'code' | 'font' | 'config' | 'person' | 'thumb' | 'example'; size: number; sha256: string }

export interface StyleKitApi {
  /** Files a style has (no bytes). Empty in sample mode. */
  list(style: string): Promise<KitFile[]>
  /** File bytes by path ("EC/code/ec_ad.py"). */
  get(files: KitFile[]): Promise<Map<string, Uint8Array>>
}

const CACHE = 'mrkd-style-kit-v1'
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

async function cached(sha: string): Promise<Uint8Array | null> {
  try {
    const hit = await (await caches.open(CACHE)).match(`/kit/${sha}`)
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null
  } catch {
    return null
  }
}
async function remember(sha: string, data: Uint8Array) {
  try {
    await (await caches.open(CACHE)).put(`/kit/${sha}`, new Response(new Blob([data as BlobPart])))
  } catch {
    /* private window or storage blocked: fine, just not cached */
  }
}

export function createStyleKit(db: SupabaseClient): StyleKitApi {
  return {
    async list(style) {
      const { data, error } = await db.rpc('style_kit_list', { p_style: style })
      if (error) throw new Error(error.message)
      return (data ?? []) as KitFile[]
    },
    async get(files) {
      const out = new Map<string, Uint8Array>()
      const missing: KitFile[] = []
      for (const f of files) {
        const hit = await cached(f.sha256)
        if (hit) out.set(f.path, hit)
        else missing.push(f)
      }
      // A few files per request: people photos are ~1 MB each.
      for (let i = 0; i < missing.length; i += 4) {
        const batch = missing.slice(i, i + 4)
        const { data, error } = await db.rpc('style_kit_get', { p_paths: batch.map((f) => f.path) })
        if (error) throw new Error(error.message)
        for (const row of (data ?? []) as { path: string; b64: string }[]) {
          const bytes = fromB64(row.b64)
          out.set(row.path, bytes)
          const f = batch.find((x) => x.path === row.path)
          if (f) await remember(f.sha256, bytes)
        }
      }
      return out
    },
  }
}

/** Sample mode: no kit (the people and fonts aren't public). */
export const noStyleKit: StyleKitApi = {
  async list() { return [] },
  async get() { return new Map() },
}
