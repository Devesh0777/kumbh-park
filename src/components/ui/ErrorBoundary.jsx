import { Component } from 'react'
import Button from '@/components/ui/Button'

/**
 * Catches render-time throws anywhere below it.
 *
 * Without this, one bad record — a booking with a status the UI does not know,
 * a spot missing a coordinate — unmounts the whole React tree and the user is
 * left staring at a blank white page with no way back. This turns that into a
 * readable message and a working retry.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui] render error caught by ErrorBoundary:', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.4 3.9L2 18.2A2 2 0 0 0 3.7 21.2h16.6a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.2 0z" />
            <path d="M12 9.5v4" />
            <path d="M12 17.2h.01" />
          </svg>
        </div>

        <div>
          <p className="text-[15px] font-semibold">This screen ran into a problem</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">
            Something on the page could not be drawn. Reloading usually clears it.
          </p>
          {import.meta.env.DEV && (
            <pre className="mx-auto mt-3 max-w-md overflow-x-auto rounded-[12px] bg-surface-sunken p-3 text-left text-[11px] text-muted">
              {String(error?.message ?? error)}
            </pre>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={this.reset}>Try again</Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
