const STACK_LAYERS = [
  { layer: "Aplikasi & Antarmuka", items: ["Next.js App Router (PWA)", "Dexie/IndexedDB", "Workbox Background Sync"] },
  { layer: "Data & Platform", items: ["Supabase Auth", "Postgres + PostGIS", "Storage privat", "Realtime"] },
  { layer: "Kecerdasan Buatan", items: ["FastAPI", "ONNX Runtime", "Model registry & evaluasi terukur"] },
];

/** "Teknologi" section — high-level stack per docs/architecture/SYSTEM_ARCHITECTURE.md, without implementation-level detail. */
export function TechnologySection() {
  return (
    <section id="teknologi" className="bg-surface-container-low py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">Teknologi</h2>
          <p className="mt-2 font-sans text-sm text-on-surface-variant">
            Arsitektur yang dirancang untuk keandalan di lapangan, bukan hanya demo di kantor.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STACK_LAYERS.map((layer) => (
            <div key={layer.layer} className="rounded-lg border border-brand-border bg-surface-container-lowest p-6">
              <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-on-surface-variant">
                {layer.layer}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {layer.items.map((item) => (
                  <li key={item} className="font-mono text-sm text-on-surface">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
