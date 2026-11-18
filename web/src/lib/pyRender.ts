/**
 * Renders ads with a style kit's own Python, in a Web Worker (pyRender.worker.ts).
 * One worker per tab; jobs run one after another.
 */
import type { RenderJob } from './pyRender.worker'

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { ok: (v: { name: string; data: Uint8Array }[]) => void; fail: (e: Error) => void }>()
let warm: Promise<void> | null = null

function get(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./pyRender.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; id?: number; images?: { name: string; data: Uint8Array }[]; message?: string }
    if (m.type === 'done' && m.id != null) { waiting.get(m.id)?.ok(m.images ?? []); waiting.delete(m.id) }
    if (m.type === 'error') {
      if (m.id != null) { waiting.get(m.id)?.fail(new Error(m.message)); waiting.delete(m.id) } else warmFail?.(new Error(m.message))
    }
    if (m.type === 'ready') warmOk?.()
  }
  return worker
}
let warmOk: (() => void) | null = null
let warmFail: ((e: Error) => void) | null = null

/** Start loading the engine early (first time ~25 MB). */
export function warmUp(): Promise<void> {
  return (warm ??= new Promise<void>((ok, fail) => { warmOk = ok; warmFail = fail; get().postMessage({ type: 'warm' }) }))
}

export function render(job: Omit<RenderJob, 'id'>): Promise<{ name: string; data: Uint8Array }[]> {
  const id = ++seq
  return new Promise((ok, fail) => {
    waiting.set(id, { ok, fail })
    get().postMessage({ type: 'render', id, ...job })
  })
}
