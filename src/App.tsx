import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import AIChat from './pages/AIChat'
import AITranslator from './pages/AITranslator'

function AppContent() {
  const { pathname } = useLocation()
  const isAIChat = pathname === '/ai'

  return (
    <>
      <Navbar key={pathname} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai" element={<AIChat />} />
        <Route path="/ai-translator" element={<AITranslator />} />
      </Routes>
      {!isAIChat && <Footer />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
