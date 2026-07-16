import { Link } from 'react-router-dom'

export default function Section({ title, link, linkLabel = 'Все', children }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {link && (
          <Link to={link} className="section-link">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
