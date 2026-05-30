export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong style={{ color: 'var(--text)' }}>QIK Anime</strong> — минималистичный каталог аниме.
        </div>
        <div>
          Данные предоставлены{' '}
          <a href="https://yummyani.me" target="_blank" rel="noreferrer">YummyAnime API</a>
          {' · '}Только для личного использования
        </div>
      </div>
    </footer>
  )
}
