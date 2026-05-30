import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  SearchIcon,
  MenuIcon,
  CloseIcon,
  BookmarkIcon,
  LogoutIcon,
  UserIcon,
  ChevronDown,
  UsersIcon,
  SunIcon,
  MoonIcon,
} from './icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import Avatar from './Avatar.jsx'
import NotificationBell from './NotificationBell.jsx'

const links = [
  { to: '/', label: 'Главная', end: true },
  { to: '/catalog', label: 'Каталог' },
  { to: '/schedule', label: 'Расписание' },
]

export default function Header() {
  const [q, setQ] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, openAuth, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const menuRef = useRef(null)

  function submit(e) {
    e.preventDefault()
    const term = q.trim()
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => setMenu(false), [location.pathname])

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="logo" aria-label="QIK Anime — на главную">
          <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#b8a6f0" />
                <stop offset="1" stopColor="#a6e3d0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="16" fill="#181820" />
            <path d="M44 20 A16 16 0 1 0 44 44" fill="none" stroke="url(#lg)" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M38 38 L48 50" stroke="url(#lg)" strokeWidth="5.5" strokeLinecap="round" />
          </svg>
          QIK<span className="logo-badge">Anime</span>
        </NavLink>

        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
          {user && (
            <>
              <NavLink to="/library" className={({ isActive }) => (isActive ? 'active' : '')}>
                Закладки
              </NavLink>
              <NavLink to="/friends" className={({ isActive }) => (isActive ? 'active' : '')}>
                Друзья
              </NavLink>
            </>
          )}
        </nav>

        <form className="header-search" onSubmit={submit}>
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск аниме…"
            aria-label="Поиск аниме"
          />
        </form>

        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label="Переключить тему"
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>

        <NotificationBell />

        {user ? (
          <div className="account-wrap" ref={menuRef}>
            <button className="account-btn" onClick={() => setMenu((m) => !m)}>
              <Avatar user={user} />
              <span className="name">{user.username}</span>
              <ChevronDown width={15} height={15} />
            </button>
            {menu && (
              <div className="account-menu">
                <div className="who">
                  <b>{user.username}</b>
                  <span>{user.email}</span>
                </div>
                <Link to={`/u/${user.id}`}>
                  <UserIcon width={16} height={16} /> Мой профиль
                </Link>
                <Link to="/library">
                  <BookmarkIcon width={16} height={16} /> Мои закладки
                </Link>
                <Link to="/friends">
                  <UsersIcon width={16} height={16} /> Друзья
                </Link>
                <button onClick={logout}>
                  <LogoutIcon width={16} height={16} /> Выйти
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => openAuth('login')}>
            <UserIcon width={16} height={16} /> Войти
          </button>
        )}

        <button className="burger" onClick={() => setDrawer(true)} aria-label="Меню">
          <MenuIcon width={20} height={20} />
        </button>
      </div>

      {drawer && (
        <div className="drawer" onClick={() => setDrawer(false)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <button className="burger" style={{ alignSelf: 'flex-end', marginBottom: 8 }} onClick={() => setDrawer(false)} aria-label="Закрыть">
              <CloseIcon width={20} height={20} />
            </button>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setDrawer(false)}
                className={location.pathname === l.to ? 'active' : ''}
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to={`/u/${user.id}`} onClick={() => setDrawer(false)}>
                  Мой профиль
                </NavLink>
                <NavLink to="/library" onClick={() => setDrawer(false)} className={location.pathname === '/library' ? 'active' : ''}>
                  Закладки
                </NavLink>
                <NavLink to="/friends" onClick={() => setDrawer(false)} className={location.pathname === '/friends' ? 'active' : ''}>
                  Друзья
                </NavLink>
                <button onClick={() => { logout(); setDrawer(false) }} style={{ textAlign: 'left' }}>
                  Выйти
                </button>
              </>
            ) : (
              <button onClick={() => { openAuth('login'); setDrawer(false) }} style={{ textAlign: 'left' }}>
                Войти
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
