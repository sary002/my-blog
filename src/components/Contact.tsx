import { contactLinks } from '../data/content'

export default function Contact() {
  return (
    <section id="contact" className="section section--gray">
      <div className="section__inner">
        <div className="section__header">
          <h2 className="section__title">联系方式</h2>
          <p className="section__desc">欢迎交流与合作</p>
        </div>

        <div className="contact__grid">
          {contactLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="contact-card"
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              <span className="contact-card__label">{link.label}</span>
              <span className="contact-card__value">{link.value}</span>
            </a>
          ))}
        </div>

        <p className="contact__note">
          期待收到你的来信，无论是技术讨论还是合作邀请。
        </p>
      </div>
    </section>
  )
}
