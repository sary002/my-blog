import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Projects from './components/Projects'
import Articles from './components/Articles'
import Contact from './components/Contact'
import Footer from './components/Footer'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Projects />
        <Articles />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default App
