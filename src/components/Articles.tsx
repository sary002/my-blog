import { articles } from '../data/content'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function Articles() {
  return (
    <section id="articles" className="section">
      <div className="section__inner">
        <div className="section__header">
          <h2 className="section__title">我的文章</h2>
          <p className="section__desc">技术笔记与思考随笔</p>
        </div>

        <div className="articles__list">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.link}
              className="article-item"
            >
              <div className="article-item__meta">
                <time dateTime={article.date}>{formatDate(article.date)}</time>
                <span className="article-item__dot" aria-hidden="true" />
                <span>{article.readTime}</span>
              </div>
              <h3 className="article-item__title">{article.title}</h3>
              <p className="article-item__excerpt">{article.excerpt}</p>
              <span className="article-item__arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
