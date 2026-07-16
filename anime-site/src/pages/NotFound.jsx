import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'

export default function NotFound() {
  return (
    <div className="container page">
      <SEO title="Страница не найдена" description="Запрашиваемая страница не существует." />

      <div className="state">
        <h2 style={{ fontSize: 64, background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </h2>
        <p style={{ marginBottom: 22 }}>Такой страницы не существует.</p>
        <Link to="/" className="btn btn-primary">
          На главную
        </Link>
      </div>
    </div>
  )
}
