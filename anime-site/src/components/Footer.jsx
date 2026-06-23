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
        <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginTop: 8, maxWidth: 680 }}>
          QIK Anime не хранит и не распространяет видеоконтент. Все материалы (постеры, описания, метаданные) получены из открытых источников и принадлежат их правообладателям. Сайт является агрегатором общедоступной информации и не несёт ответственности за контент, размещённый на сторонних ресурсах. Если вы правообладатель и хотите удалить материалы — напишите на{' '}
          <a href="mailto:qikanime@gmail.com" style={{ color: 'var(--accent)' }}>qikanime@gmail.com</a>.
        </div>
      </div>
    </footer>
  )
}
