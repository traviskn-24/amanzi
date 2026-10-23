import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Amanzi encountered a rendering error.', error)
  }

  render() {
    if (this.state.hasError) {
      return <main className="account-page-unavailable" role="alert"><h1>Something went wrong</h1><p>Amanzi could not display this page. Reload and try again.</p><button className="account-secondary" onClick={() => window.location.reload()}>Reload Amanzi</button></main>
    }
    return this.props.children
  }
}
