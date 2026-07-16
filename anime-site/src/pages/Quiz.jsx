import SEO from '../components/SEO.jsx'
import QuizEmoji from '../components/QuizEmoji.jsx'

export default function Quiz() {
  return (
    <div className="container page">
      <SEO title="Квиз" description="Квиз по аниме: угадай по эмодзи." canonical="https://quickik.ru/quiz" />
      <QuizEmoji />
    </div>
  )
}
