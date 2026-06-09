export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero__content">
        <p className="hero__eyebrow">你好，我是</p>
        <h1 className="hero__title">
          一名热爱创造的
          <br />
          AI开发者
        </h1>
        <p className="hero__subtitle">
          专注于构建简洁、优雅且高性能的AI应用。
          <br />
          在这里记录我的项目、思考与成长。
        </p>
        <div className="hero__actions">
          <a href="#projects" className="btn btn--primary">
            查看项目
          </a>
          <a href="#articles" className="btn btn--secondary">
            阅读文章
          </a>
        </div>
      </div>
    </section>
  )
}
