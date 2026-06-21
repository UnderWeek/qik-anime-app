import SEO from '../components/SEO.jsx'

export default function Quiz() {
  return (
    <div className="container page">
      <SEO
        title="Квиз"
        description="Проверь свои знания аниме."
        canonical="https://quickik.ru/quiz"
      />
      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Квиз</h2>
      </div>
      <div className="state">
        <p style={{ color: 'var(--text-faint)' }}>Скоро здесь можно будет пройти квиз по аниме.</p>
      </div>
    </div>
  )
}
