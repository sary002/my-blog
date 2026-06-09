export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <p>© {year} My Blog. 用心构建，持续成长。</p>
    </footer>
  )
}
