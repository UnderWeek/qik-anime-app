import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { SearchIcon, BookmarkIcon, LogoutIcon, UserIcon, ChevronDown, UsersIcon, SunIcon, MoonIcon, HomeIcon, GridIcon, CalendarIcon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/catalog', label: 'Catalog' },
  { to: '/schedule', label: 'Schedule' },
];

export default function Header() {
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuth, logout } = useAuth();
  const { theme, toggle } = useTheme();
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

  const mobileLinks = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/catalog', label: 'Catalog', icon: GridIcon },
    { to: '/schedule', label: 'Schedule', icon: CalendarIcon },
    { to: '/library', label: 'Library', icon: BookmarkIcon },
  ];

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
                <NavLink to='/library' className={({ isActive }) => (isActive ? 'active' : '')}>Library</NavLink>
                <NavLink to='/friends' className={({ isActive }) => (isActive ? 'active' : '')}>Friends</NavLink>
              </>
            )}
          </nav>
          <form className='header-search' onSubmit={submit}>
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search...' aria-label='Search' />
          </form>
          <button className='theme-toggle' onClick={toggle} aria-label='Toggle Theme' title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
          </button>
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
                    <Link to={`/u/${user.id}`}><UserIcon width={16} height={16} />My Profile</Link>
                    <Link to='/library'><BookmarkIcon width={16} height={16} />My Library</Link>
                    <Link to='/friends'><UsersIcon width={16} height={16} />Friends</Link>
                    <button onClick={() => { logout(); setMenu(false); }}><LogoutIcon width={16} height={16} />Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <button className='btn btn-primary' style={{ flexShrink: 0 }} onClick={() => openAuth('login')}><UserIcon width={16} height={16} />Login</button>
            )}
          </div>
        </div>
      </header>

      <nav className='mobile-bottom-nav' aria-label='Mobile Navigation'>
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
            <span>Profile</span>
          </Link>
        ) : (
          <button className='mobile-bottom-item' onClick={() => openAuth('login')}>
            <UserIcon width={19} height={19} />
            <span>Login</span>
          </button>
        )}
      </nav>
    </>
  );
}
