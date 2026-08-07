export function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <span className="section-card__icon"><Icon size={20} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="section-card__content">{children}</div>
    </section>
  )
}
