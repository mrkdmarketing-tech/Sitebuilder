import { useEffect, useState } from 'react'

/**
 * Shows "The Lab was updated" when a newer version is live, so nobody keeps
 * using an old copy of the app in an open tab. Checks /version.json every
 * 5 minutes and whenever the tab comes back into view.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    let stopped = false
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const { buildId } = (await res.json()) as { buildId?: string }
        if (!stopped && buildId && buildId !== __BUILD_ID__) setStale(true)
      } catch {
        /* offline: try again later */
      }
    }
    check()
    const timer = setInterval(check, 5 * 60_000)
    const onVisible = () => !document.hidden && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!stale) return null
  return (
    <div role="status" className="flex items-center justify-center gap-3 bg-brand px-4 py-2 text-sm font-medium text-on-primary">
      The Lab was updated.
      <button onClick={() => window.location.reload()} className="rounded-md bg-surface px-3 py-1 text-xs font-semibold text-ink">
        Reload
      </button>
    </div>
  )
}
