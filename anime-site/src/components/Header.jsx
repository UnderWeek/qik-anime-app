import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { SearchIcon, BookmarkIcon, LogoutIcon, UserIcon, ChevronDown, UsersIcon, GridIcon, CalendarIcon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';

const links = [
  { to: '/catalog', label: 'Каталог' },
  { to: '/schedule', label: 'Расписание' },
  { to: '/rooms', label: 'Комнаты' },
];

const TAB_DEFS = {
  catalog: { to: '/catalog', label: 'Каталог', icon: GridIcon },
  schedule: { to: '/schedule', label: 'Расписание', icon: CalendarIcon },
  rooms: { to: '/rooms', label: 'Комнаты', icon: UsersIcon },
  library: { to: '/library', label: 'Закладки', icon: BookmarkIcon },
  friends: { to: '/friends', label: 'Друзья', icon: UsersIcon, auth: true },
  chats: { to: '/chats', label: 'Чаты', icon: UsersIcon, auth: true },
};

const DEFAULT_MOBILE_ORDER = ['catalog', 'rooms', 'library', 'friends'];

function readMobileOrder() {
  try {
    const raw = localStorage.getItem('qik_mobile_tabs');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr.filter((k) => TAB_DEFS[k]);
    }
  } catch { /* ignore */ }
  return [...DEFAULT_MOBILE_ORDER];
}

export default function Header() {
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [mobileOrder, setMobileOrder] = useState(readMobileOrder);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuth, logout } = useAuth();
  const menuRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${term}`);
  }

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => setMenu(false), [location.pathname]);

  // Re-read mobile order when settings may have changed (pathname change)
  useEffect(() => {
    setMobileOrder(readMobileOrder());
  }, [location.pathname]);

  const mobileLinks = mobileOrder
    .map((key) => TAB_DEFS[key])
    .filter(Boolean)
    .filter((l) => !l.auth || user);

  const profileActive = location.pathname.startsWith('/u/');

  return (
    <>
      <header className='header'>
        <div className='header-inner'>
          <NavLink to='/' className='logo' aria-label='QIK Anime'>
            <img src='/logo.png' className='logo-mark' alt='QIK Anime Logo' aria-hidden='true' />
          </NavLink>
          <nav className='nav'>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
            {user && (
              <>
                <NavLink to='/library' className={({ isActive }) => (isActive ? 'active' : '')}>Закладки</NavLink>
                <NavLink to='/friends' className={({ isActive }) => (isActive ? 'active' : '')}>Друзья</NavLink>
                <NavLink to='/chats' className={({ isActive }) => (isActive ? 'active' : '')}>Чаты</NavLink>
              </>
            )}
          </nav>
          <form className='header-search' onSubmit={submit}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Поиск...' aria-label='Поиск' />
          </form>
          <div className='header-notif'>
            <NotificationBell />
          </div>
          <div className='header-account'>
            {user ? (
              <div className='account-wrap' ref={menuRef}>
                <button className='account-btn' onClick={() => setMenu((m) => !m)}><Avatar user={user} /><span className='name'>{user.username}</span><ChevronDown width={15} height={15} /></button>
                {menu && (
                  <div className='account-menu'>
                    <div className='who'><b>{user.username}</b><span>{user.email}</span></div>
                    <Link to={`/u/${user.id}`}><UserIcon width={16} height={16} />Профиль</Link>
                    <Link to='/library'><BookmarkIcon width={16} height={16} />Закладки</Link>
                    <Link to='/schedule'><CalendarIcon width={16} height={16} />Расписание</Link>
                    <Link to='/friends'><UsersIcon width={16} height={16} />Друзья</Link>
                    <Link to='/chats'><UsersIcon width={16} height={16} />Чаты</Link>
                    <Link to='/rooms'><UsersIcon width={16} height={16} />Комнаты</Link>
                    <Link to='/settings'><span style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚙</span>Настройки</Link>
                    <button onClick={() => { logout(); setMenu(false); }}><LogoutIcon width={16} height={16} />Выйти</button>
                  </div>
                )}
              </div>
            ) : (
              <button className='btn btn-primary' style={{ flexShrink: 0 }} onClick={() => openAuth('login')}><UserIcon width={16} height={16} />Войти</button>
            )}
          </div>
        </div>
      </header>

      <nav className='mobile-bottom-nav' aria-label='Мобильная навигация'>
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `mobile-bottom-item${isActive ? ' active' : ''}`}>
              <Icon width={19} height={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {user ? (
          <Link to={`/u/${user.id}`} className={`mobile-bottom-item${profileActive ? ' active' : ''}`}>
            <UserIcon width={19} height={19} />
            <span>Профиль</span>
          </Link>
        ) : (
          <button className='mobile-bottom-item' onClick={() => openAuth('login')}>
            <UserIcon width={19} height={19} />
            <span>Войти</span>
          </button>
        )}
      </nav>
    </>
  );
}
