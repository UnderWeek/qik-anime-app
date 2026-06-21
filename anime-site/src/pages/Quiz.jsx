import { useState } from 'react'
import SEO from '../components/SEO.jsx'
import QuizFrames from '../components/QuizFrames.jsx'

const QUIZZES = [
  { key: 'frames', label: 'Угадай по кадру', desc: 'Случайный скриншот из аниме — нужно угадать название.' },
  { key: 'opening', label: 'Угадай по опенингу', desc: 'Фрагмент опенинга — какое аниме?' },
  { key: 'character', label: 'Угадай персонажа', desc: 'Изображение персонажа — из какого он аниме?' },
]

export default function Quiz() {
  const [tab, setTab] = useState('frames')

  return (
    <div className="container page">
      <SEO title="Квизы" description="Квизы по аниме: угадай по кадру, опенингу, персонажу." canonical="https://quickik.ru/quiz" />

      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Квизы</h2>
      </div>

      <div className="day-tabs" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {QUIZZES.map((q) => (
          <button
            key={q.key}
            className={`chip ${tab === q.key ? 'active' : ''}`}
            onClick={() => setTab(q.key)}
          >
            {q.label}
          </button>
        ))}
      </div>

      {tab === 'frames' && <QuizFrames />}

      {tab === 'opening' && (
        <div className="state">
          <p style={{ color: 'var(--text-faint)' }}>Скоро здесь можно будет угадывать аниме по опенингу.</p>
        </div>
      )}

      {tab === 'character' && (
        <div className="state">
          <p style={{ color: 'var(--text-faint)' }}>Скоро здесь можно будет угадывать персонажей.</p>
        </div>
      )}
    </div>
  )
}
