import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { CloseIcon } from './icons.jsx'

export default function AuthModal() {
  const { authModal, openAuth, closeAuth, login, register, showToast } = useAuth()
  const mode = authModal // 'login' | 'register' | null
  const [form, setForm] = useState({ login: '', email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError('')
    setForm({ login: '', email: '', username: '', password: '' })
  }, [mode])

  // close on Escape
  useEffect(() => {
    if (!mode) return
    const onKey = (e) => e.key === 'Escape' && closeAuth()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, closeAuth])

  if (!mode) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const u = await login(form.login.trim(), form.password)
        showToast(`С возвращением, ${u.username}!`)
      } else {
        const u = await register({
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
        })
        showToast(`Добро пожаловать, ${u.username}!`)
      }
      closeAuth()
    } catch (err) {
      setError(err.message || 'Что-то пошло не так')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={closeAuth}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closeAuth} aria-label="Закрыть">
          <CloseIcon width={18} height={18} />
        </button>

        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <p className="sub">
          {mode === 'login'
            ? 'Войдите, чтобы сохранять закладки, ставить оценки и комментировать.'
            : 'Создайте аккаунт QIK Anime — это быстро.'}
        </p>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'login' ? (
            <div className="field">
              <label>Email или никнейм</label>
              <input
                value={form.login}
                onChange={set('login')}
                autoFocus
                autoComplete="username"
                placeholder="otaku или mail@example.com"
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoFocus
                  autoComplete="email"
                  placeholder="mail@example.com"
                />
              </div>
              <div className="field">
                <label>Никнейм</label>
                <input
                  value={form.username}
                  onChange={set('username')}
                  autoComplete="username"
                  placeholder="otaku"
                />
              </div>
            </>
          )}

          <div className="field">
            <label>Пароль</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="modal-switch">
          {mode === 'login' ? (
            <>
              Нет аккаунта?
              <button onClick={() => openAuth('register')}>Зарегистрироваться</button>
            </>
          ) : (
            <>
              Уже есть аккаунт?
              <button onClick={() => openAuth('login')}>Войти</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
