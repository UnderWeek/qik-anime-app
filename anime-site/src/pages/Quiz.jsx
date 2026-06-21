import { useState } from 'react'
import SEO from '../components/SEO.jsx'
import QuizFrames from '../components/QuizFrames.jsx'
import QuizEmoji from '../components/QuizEmoji.jsx'

const QUIZZES = [
  { key: 'emoji', label: 'Эмодзи', desc: 'Угадай аниме по эмодзи-описанию сюжета.' },
  { key: 'frames', label: 'По кадру', desc: 'Случайный скриншот из аниме — нужно угадать название.' },
  { key: 'opening', label: 'По опенингу', desc: 'Фрагмент опенинга — какое аниме?' },
  { key: 'character', label: 'Персонажи', desc: 'Изображение персонажа — из какого он аниме?' },
]

export default function Quiz() {
  const [tab, setTab] = useState('emoji')

  return (
    <div className="container page">
      <SEO title="Квизы" description="Квизы по аниме: эмодзи, по кадру, опенингу, персонажу." canonical="https://quickik.ru/quiz" />

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

      {tab === 'emoji' && <QuizEmoji />}
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
