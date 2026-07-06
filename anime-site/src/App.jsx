import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header.jsx'
import AuthModal from './components/AuthModal.jsx'
import Toast from './components/Toast.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Catalog from './pages/Catalog.jsx'
import AnimeDetail from './pages/AnimeDetail.jsx'
import Watch from './pages/Watch.jsx'
import Schedule from './pages/Schedule.jsx'
import SearchPage from './pages/SearchPage.jsx'
import Library from './pages/Library.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import Friends from './pages/Friends.jsx'
import Ratings from './pages/Ratings.jsx'
import NotFound from './pages/NotFound.jsx'

// Lazy: hls.js + socket.io only loaded when navigating to rooms/chats
const Chats = lazy(() => import('./pages/Chats.jsx'))
const Rooms = lazy(() => import('./pages/Rooms.jsx'))
const RoomWatch = lazy(() => import('./pages/RoomWatch.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const Quiz = lazy(() => import('./pages/Quiz.jsx'))
const Issues = lazy(() => import('./pages/Issues.jsx'))

function LazyFallback() {
  return <div className="container page"><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка…</div></div>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    // On POP (back/forward), let the page handle its own scroll restoration.
    // On PUSH/REPLACE (new navigation), scroll to top.
    if (navType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, navType])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/chats" element={<Suspense fallback={<LazyFallback />}><Chats /></Suspense>} />
          <Route path="/rooms" element={<Suspense fallback={<LazyFallback />}><Rooms /></Suspense>} />
          <Route path="/rooms/:id" element={<Suspense fallback={<LazyFallback />}><RoomWatch /></Suspense>} />
          <Route path="/u/:id" element={<Profile />} />
          <Route path="/anime/:url" element={<AnimeDetail />} />
          <Route path="/anime/:url/watch" element={<Watch />} />
          <Route path="/admin" element={<Suspense fallback={<LazyFallback />}><Admin /></Suspense>} />
          <Route path="/quiz" element={<Suspense fallback={<LazyFallback />}><Quiz /></Suspense>} />
          <Route path="/issues" element={<Suspense fallback={<LazyFallback />}><Issues /></Suspense>} />
          <Route path="/ratings" element={<Ratings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <AuthModal />
      <Toast />
      <Footer />
    </>
  )
}
