// Per-portal error boundary (refactor item 3).
//
// The worst SafePlate bug to date was a single component throwing during render
// and blanking the entire portal (the food-handler TDZ crash). Wrapping each
// portal in this boundary means a crash in one screen shows a recoverable
// message instead of a white page, and never takes the rest of the app down.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
  onReset?: () => void
}
interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Something went wrong.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for diagnostics without crashing; a real logger can hook in here.
    console.error('[SafePlate] portal error', this.props.label || '', error, info?.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        role="alert"
        style={{
          margin: 24,
          padding: 24,
          border: '1px solid var(--line, #e5e7eb)',
          borderRadius: 12,
          background: '#fff',
          fontFamily: 'inherit',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#b3261e' }}>
          This section ran into a problem
        </h2>
        <p style={{ margin: '0 0 16px', color: '#444', fontSize: 14 }}>
          {this.props.label ? this.props.label + ' could not be displayed. ' : ''}
          The rest of SafePlate is still working. You can try again, or return to the home screen.
        </p>
        <button
          onClick={this.reset}
          style={{
            padding: '9px 16px',
            border: 'none',
            borderRadius: 9,
            background: '#006600',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
