import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const homeNavItems = [
  { label: '首页', href: '#hero' },
  { label: '项目', href: '#projects' },
  { label: '文章', href: '#articles' },
  { label: '联系', href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const handleNavClick = () => setMenuOpen(false)

  return (
    <header className={`navbar ${scrolled || !isHome ? 'navbar--scrolled' : ''}`}>
      <nav className="navbar__inner">
        <Link to="/" className="navbar__logo" onClick={handleNavClick}>
          Blog
        </Link>

        <ul className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}>
          {isHome ? (
            homeNavItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={handleNavClick}>
                  {item.label}
                </a>
              </li>
            ))
          ) : (
            <li>
              <Link to="/" onClick={handleNavClick}>
                首页
              </Link>
            </li>
          )}
          <li>
            <Link
              to="/ai"
              className={location.pathname === '/ai' ? 'navbar__link--active' : ''}
              onClick={handleNavClick}
            >
              AI 助手
            </Link>
          </li>
          <li>
            <Link
              to="/ai-translator"
              className={
                location.pathname === '/ai-translator' ? 'navbar__link--active' : ''
              }
              onClick={handleNavClick}
            >
              AI 翻译官
            </Link>
          </li>
        </ul>

        <button
          type="button"
          className={`navbar__toggle ${menuOpen ? 'navbar__toggle--open' : ''}`}
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </nav>
    </header>
  )
}
