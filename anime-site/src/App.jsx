import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import AuthModal from './components/AuthModal.jsx'
import Toast from './components/Toast.jsx'
import Home from './pages/Home.jsx'
import Catalog from './pages/Catalog.jsx'
import AnimeDetail from './pages/AnimeDetail.jsx'
import Watch from './pages/Watch.jsx'
import Schedule from './pages/Schedule.jsx'
import SearchPage from './pages/SearchPage.jsx'
import Library from './pages/Library.jsx'
import Profile from './pages/Profile.jsx'
import Friends from './pages/Friends.jsx'
import Rooms from './pages/Rooms.jsx'
import RoomWatch from './pages/RoomWatch.jsx'
import NotFound from './pages/NotFound.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
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
          <Route path="/friends" element={<Friends />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomWatch />} />
          <Route path="/u/:id" element={<Profile />} />
          <Route path="/anime/:url" element={<AnimeDetail />} />
          <Route path="/anime/:url/watch" element={<Watch />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <AuthModal />
      <Toast />
    </>
  )
}
