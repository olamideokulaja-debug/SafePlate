import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '40px', fontFamily: 'Lora, Georgia, serif', textAlign: 'center', color: '#642C90' }}>
          <div>
            <img src="/rhsc-mark.png" alt="RHSC" style={{ height: 56, margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 8px' }}>Realms could not finish loading.</h2>
            <p style={{ color: '#7A6A93', maxWidth: 420 }}>Please refresh the page. If this keeps happening, check that the Supabase environment variables in Vercel are correct, then redeploy.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
