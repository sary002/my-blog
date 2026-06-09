import { projects } from '../data/content'

export default function Projects() {
  return (
    <section id="projects" className="section section--gray">
      <div className="section__inner">
        <div className="section__header">
          <h2 className="section__title">我的项目</h2>
          <p className="section__desc">精选作品与实验性项目</p>
        </div>

        <div className="projects__grid">
          {projects.map((project) => (
            <a
              key={project.id}
              href={project.link}
              className="card project-card"
            >
              <div className="project-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M9 3v18M3 9h6" />
                </svg>
              </div>
              <h3 className="card__title">{project.title}</h3>
              <p className="card__desc">{project.description}</p>
              <div className="card__tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="card__link">
                了解更多
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
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
