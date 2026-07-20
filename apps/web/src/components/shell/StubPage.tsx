export interface StubPageProps {
  title: string;
  description: string;
}

/** Placeholder content for a nav destination not yet implemented — avoids each stub page reinventing the same layout. */
export function StubPage({ title, description }: StubPageProps) {
  return (
    <div>
      <h1 className="font-sans text-2xl font-bold text-on-surface">{title}</h1>
      <p className="mt-2 max-w-2xl font-sans text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}
