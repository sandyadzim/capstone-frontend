export function AdminPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <section
        className="mt-6 rounded-xl border bg-card p-5"
        aria-labelledby="coming-soon-title"
      >
        <h2 id="coming-soon-title" className="text-base font-semibold">
          Coming soon
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
          This section is ready for a future update. Live data and management
          actions are not available yet.
        </p>
      </section>
    </div>
  )
}
