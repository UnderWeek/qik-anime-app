import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { SearchIcon, BookmarkIcon, LogoutIcon, UserIcon, ChevronDown, UsersIcon, GridIcon, CalendarIcon, MessageIcon, RoomIcon, CloseIcon, StarIcon, SettingsIcon, ShieldIcon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { backend, uploadUrl } from '../api/backend.js';
import { api, poster, fixUrl } from '../api/client.js';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';
import GlassNav from './GlassNav.jsx';

const links = [
  { to: '/catalog', label: 'Каталог' },
  { to: '/schedule', label: 'Расписание' },
];

const TAB_DEFS = {
  catalog: { to: '/catalog', label: 'Каталог', icon: GridIcon },
  schedule: { to: '/schedule', label: 'Расписание', icon: CalendarIcon },
  rooms: { to: '/rooms', label: 'Комнаты', icon: RoomIcon, master: true },
  library: { to: '/library', label: 'Закладки', icon: BookmarkIcon },
  friends: { to: '/friends', label: 'Друзья', icon: UsersIcon, auth: true },
  ratings: { to: '/ratings', label: 'Рейтинги', icon: StarIcon },
  quiz: { to: '/quiz', label: 'Квиз', icon: StarIcon },
  settings: { to: '/settings', label: 'Настройки', icon: SettingsIcon },
  profile: { to: '/u/me', label: 'Профиль', icon: UserIcon, profile: true },
};

const DEFAULT_MOBILE_ORDER = ['catalog', 'library', 'friends', 'profile'];

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
  const [history, setHistory] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuth, logout } = useAuth();
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    if (term && user) {
      backend.saveSearch(term).catch(() => {});
    }
    setShowDropdown(false);
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  const loadHistory = useCallback(() => {
    if (!user) return;
    backend.searchHistory().then(setHistory).catch(() => {});
  }, [user]);

  // Debounced search suggestions
  useEffect(() => {
    const term = q.trim();
    if (!term || term.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.search(term, { limit: 5 }).then((res) => {
        setSuggestions(Array.isArray(res) ? res.slice(0, 5) : []);
        setSuggestionsLoading(false);
      }).catch(() => {
        setSuggestions([]);
        setSuggestionsLoading(false);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function removeHistoryItem(id, e) {
    e.stopPropagation();
    backend.deleteSearch(id).then(() => {
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }).catch(() => {});
  }

  function clearHistory(e) {
    e.stopPropagation();
    backend.clearSearchHistory().then(() => setHistory([])).catch(() => {});
  }

  function onSearchFocus() {
    loadHistory();
    setShowDropdown(true);
  }

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
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
    .filter((l) => l.profile || (!l.auth && !l.master) || (l.auth && user) || (l.master && (user?.isMaster || user?.isAdmin)));

  const profileActive = location.pathname.startsWith('/u/');
  const [liquidGlass, setLiquidGlass] = useState(() => localStorage.getItem('qik_liquid_glass') === 'true');
  const [iconOnly, setIconOnly] = useState(() => localStorage.getItem('qik_nav_icon_only') === 'true');
  useEffect(() => {
    setLiquidGlass(localStorage.getItem('qik_liquid_glass') === 'true');
    setIconOnly(localStorage.getItem('qik_nav_icon_only') === 'true');
  }, [location.pathname]);

  // Build glass nav items (public tabs + profile/login)
  const glassItems = (() => {
    const items = mobileLinks.map((item) => {
      const Icon = item.icon
      if (item.profile) {
        if (user) return { key: 'profile', label: 'Профиль', icon: Icon, to: `/u/${user.id}` }
        return { key: 'profile', label: 'Войти', icon: Icon, to: null } // login triggers openAuth
      }
      return { key: item.to, label: item.label, icon: Icon, to: item.to }
    }).filter(Boolean)
    return items.map((item) => ({
      ...item,
      onClick: item.to ? () => navigate(item.to) : () => openAuth('login'),
    }))
  })()

  // Determine active key for glass nav
  const activeKey = (() => {
    const path = location.pathname
    if (profileActive && user) return 'profile'
    for (const g of glassItems) {
      if (g.to && (path === g.to || path.startsWith(g.to + '/'))) return g.key
    }
    return null
  })()

  return (
    <>
      <header className='header'>
        <div className='header-inner'>
          <NavLink to='/' className='logo' aria-label='QIK Anime'>
            <img src='/logonew.png' className='logo-mark' alt='QIK Anime Logo' aria-hidden='true' />
          </NavLink>
          <nav className='nav'>
            {links.filter(l => !l.master || user?.isMaster || user?.isAdmin).map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
                {l.badge && <span style={{
                  fontSize: 9, fontWeight: 700, background: 'var(--accent-grad)', color: '#fff',
                  padding: '1px 5px', borderRadius: 5, marginLeft: 5, verticalAlign: '2px',
                  letterSpacing: '0.04em',
                }}>{l.badge}</span>}
              </NavLink>
            ))}
            {user && (
              <NavLink to='/library' className={({ isActive }) => (isActive ? 'active' : '')}>Закладки</NavLink>
            )}
          </nav>
          <form className='header-search' ref={searchRef} onSubmit={submit}>
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={onSearchFocus}
              placeholder='Поиск...'
              aria-label='Поиск'
              autoComplete='off'
            />
            {q && (
              <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Очистить">
                <CloseIcon width={14} height={14} />
              </button>
            )}
            {showDropdown && (
              <div className={`search-dropdown${q.trim().length >= 2 ? ' search-dropdown--wide' : ''}`}>
                {q.trim().length >= 2 ? (
                  suggestionsLoading ? (
                    <div className="search-dropdown-empty">Поиск...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="search-dropdown-empty">Ничего не найдено</div>
                  ) : (
                    <div className="search-suggestions-grid">
                      {suggestions.slice(0, 3).map((a) => (
                        <button
                          key={a.anime_id || a.anime_url}
                          type="button"
                          className="search-suggestion-card"
                          onClick={() => { setShowDropdown(false); navigate(`/anime/${a.anime_url || a.anime_id}`); }}
                        >
                          <img className="search-suggestion-poster" src={fixUrl(poster(a, 'medium'))} alt="" loading="lazy" />
                          <span className="search-suggestion-title">{a.title || a.anime_title}</span>
                          <span className="search-suggestion-meta">{typeof a.type === 'object' ? (a.type?.shortname || a.type?.name || '') : (a.type || '')}{a.year ? ` • ${a.year}` : ''}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="search-suggestion-card search-suggestion-more"
                        onClick={() => { setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}
                      >
                        <span className="search-suggestion-more-icon" />
                        <span className="search-suggestion-title">Больше результатов</span>
                      </button>
                    </div>
                  )
                ) : user ? (
                  history.length === 0 ? (
                    <div className="search-dropdown-empty">Нет недавних запросов</div>
                  ) : (
                    <>
                      <div className="search-dropdown-head">
                        <span>Недавние запросы</span>
                        <button type="button" className="search-dropdown-clear" onClick={clearHistory}>Очистить</button>
                      </div>
                      {history.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className="search-dropdown-item"
                          onClick={() => { setQ(h.query); setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(h.query)}`); }}
                        >
                          <SearchIcon width={14} height={14} />
                          <span className="search-dropdown-text">{h.query}</span>
                          <span
                            className="search-dropdown-remove"
                            onClick={(e) => removeHistoryItem(h.id, e)}
                            title="Удалить"
                          >
                            <CloseIcon width={11} height={11} />
                          </span>
                        </button>
                      ))}
                    </>
                  )
                ) : (
                  <div className="search-dropdown-empty">Введите запрос для поиска</div>
                )}
              </div>
            )}
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
                    <div className={`who${user.bannerUrl ? ' who--banner' : ''}`} style={user.bannerUrl ? { backgroundImage: `url(${uploadUrl(user.bannerUrl)})` } : undefined}><b>{user.username}</b><span>{user.email}</span></div>
                    <Link to={`/u/${user.id}`}><UserIcon width={16} height={16} />Профиль</Link>
                    <Link to='/library'><BookmarkIcon width={16} height={16} />Закладки</Link>
                    <Link to='/ratings'><StarIcon width={16} height={16} />Рейтинги</Link>
                    <Link to='/schedule'><CalendarIcon width={16} height={16} />Расписание</Link>
                    <Link to='/friends'><UsersIcon width={16} height={16} />Друзья</Link>
                    {(user?.isMaster || user?.isAdmin) && (
                      <Link to='/rooms'><RoomIcon width={16} height={16} />Комнаты</Link>
                    )}
                    {user.isAdmin && (
                      <Link to='/admin'><ShieldIcon width={16} height={16} />Админка</Link>
                    )}
                    <Link to='/settings'><SettingsIcon width={16} height={16} />Настройки</Link>
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

      {liquidGlass ? (
        <GlassNav
          items={glassItems}
          activeKey={activeKey}
          iconOnly={iconOnly}
        />
      ) : (
        <nav className={`mobile-bottom-nav${iconOnly ? ' icon-only' : ''}`} aria-label='Мобильная навигация'>
          {mobileLinks.map((item) => {
            const Icon = item.icon;
            if (item.profile) {
              if (user) {
                return (
                  <Link key="profile" to={`/u/${user.id}`} className={`mobile-bottom-item${profileActive ? ' active' : ''}`}>
                    <Icon width={19} height={19} />
                    <span>Профиль</span>
                  </Link>
                );
              }
              return (
                <button key="profile" className="mobile-bottom-item" onClick={() => openAuth('login')}>
                  <Icon width={19} height={19} />
                  <span>Войти</span>
                </button>
              );
            }
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `mobile-bottom-item${isActive ? ' active' : ''}`}>
                <Icon width={19} height={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </>
  );
}
