import { Component, type ReactNode } from 'react'

// Ловит ошибки отрисовки, чтобы вместо белого экрана была понятная подсказка.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    const en = localStorage.getItem('ep:lang') === 'en'
    return (
      <div className="empty" style={{ maxWidth: 520, margin: '10vh auto' }}>
        <div className="emoji">🧭</div>
        <h2>{en ? 'Something went wrong' : 'Что-то пошло не так'}</h2>
        <p className="muted small">{String(this.state.error.message)}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {en ? 'Reload the page' : 'Обновить страницу'}
        </button>
      </div>
    )
  }
}
