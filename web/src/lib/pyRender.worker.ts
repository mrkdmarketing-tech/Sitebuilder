/// <reference lib="webworker" />
/**
 * Runs a style kit's Python (Pillow, numpy, scipy) with Pyodide, off the main
 * thread (docs/ad-studio.md). Pyodide loads once per tab from the CDN
 * (about 25 MB the first time, then cached by the browser).
 */
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'

type Py = {
  FS: { mkdirTree(p: string): void; writeFile(p: string, d: Uint8Array | string): void; readFile(p: string): Uint8Array; readdir(p: string): string[]; analyzePath(p: string): { exists: boolean } }
  loadPackage(names: string[]): Promise<void>
  runPython(code: string): unknown
  globals: { set(k: string, v: unknown): void }
}

let ready: Promise<Py> | null = null
const boot = () => (ready ??= (async () => {
  const mod = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`) as { loadPyodide(o: { indexURL: string }): Promise<Py> }
  const py = await mod.loadPyodide({ indexURL: PYODIDE })
  await py.loadPackage(['numpy', 'scipy', 'pillow'])
  return py
})())

export interface RenderJob {
  id: number
  /** Kit files: path inside the style's folder (e.g. "code/ec_ad.py") -> bytes. */
  files: Record<string, Uint8Array>
  /** Folder to run in, the script, and its arguments (the kit's own command line). */
  cwd: string
  script: string
  args: string[]
  /** Folder whose new .png files are returned. */
  outDir: string
}

self.onmessage = async (e: MessageEvent<{ type: 'warm' } | ({ type: 'render' } & RenderJob)>) => {
  const msg = e.data
  try {
    if (msg.type === 'warm') { await boot(); (self as unknown as Worker).postMessage({ type: 'ready' }); return }
    const py = await boot()
    const root = `/kit${msg.id}`
    for (const [path, data] of Object.entries(msg.files)) {
      const full = `${root}/${path}`
      py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/')))
      py.FS.writeFile(full, data)
    }
    const out = `${root}/${msg.outDir}`
    py.FS.mkdirTree(out)
    py.globals.set('_cwd', `${root}/${msg.cwd}`)
    py.globals.set('_argv', [msg.script, ...msg.args.map((a) => a.replace('{out}', out))])
    py.runPython(`
import sys, os, runpy
os.chdir(_cwd)
if _cwd not in sys.path: sys.path.insert(0, _cwd)
sys.argv = list(_argv)
try:
    runpy.run_path(sys.argv[0], run_name='__main__')
except SystemExit as e:
    if e.code not in (None, 0): raise RuntimeError(str(e.code))
`)
    const images = py.FS.readdir(out).filter((f) => f.endsWith('.png')).sort()
      .map((name) => ({ name, data: py.FS.readFile(`${out}/${name}`) }))
    ;(self as unknown as Worker).postMessage({ type: 'done', id: msg.id, images })
  } catch (err) {
    const text = String((err as Error)?.message ?? err)
    // Python errors end with the useful line (e.g. the kit's own "STOP: ..." message).
    const last = text.trim().split('\n').filter(Boolean).pop() ?? text
    ;(self as unknown as Worker).postMessage({ type: 'error', id: (msg as { id?: number }).id, message: last.replace(/^RuntimeError: /, '') })
  }
}
