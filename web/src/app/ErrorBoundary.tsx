/**
 * Safety net: if any screen crashes, show a short message with Reload instead
 * of a blank page (added 11 Nov 2026 after a live-update error blanked the app).
 */
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('The Lab hit an error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">The Lab hit an error on this screen. Reloading usually fixes it. If it keeps happening, send a screenshot of this message.</p>
          <p className="mt-3 break-words rounded-lg bg-subtle p-2 font-mono text-xs text-soft">{this.state.error.message}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => window.location.reload()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Reload</button>
            <button onClick={() => { window.location.href = '/today' }} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Go to Today</button>
          </div>
        </div>
      </div>
    )
  }
}
