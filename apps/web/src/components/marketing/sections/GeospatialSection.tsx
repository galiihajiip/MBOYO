/**
 * "Geospatial coordination" section — describes the Coordinator's map-based
 * workflow (Peta Krisis) using an original SVG map-pin illustration, no
 * external map tile/photo dependency.
 */
export function GeospatialSection() {
  return (
    <section id="koordinasi-geospasial" className="bg-surface-container-low py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <MapIllustration />

          <div>
            <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
              Koordinasi Respons Berbasis Lokasi
            </h2>
            <p className="mt-4 font-sans text-sm leading-6 text-on-surface-variant">
              Insiden yang terverifikasi tampil pada peta krisis Koordinator secara langsung,
              dikelompokkan berdasarkan kedekatan lokasi menggunakan PostGIS. Koordinator dapat
              menetapkan prioritas, mengelompokkan insiden terkait, dan menugaskan tim respons —
              semua dari satu command center.
            </p>
            <p className="mt-4 font-sans text-sm leading-6 text-on-surface-variant">
              Jika peta tidak dapat dimuat, tampilan daftar tetap tersedia sebagai cadangan — peta
              adalah peningkatan pengalaman, bukan satu-satunya jalan untuk melihat insiden.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapIllustration() {
  const pins = [
    { x: 60, y: 50, color: "var(--color-brand-critical-red)" },
    { x: 140, y: 90, color: "var(--color-brand-priority-orange)" },
    { x: 100, y: 140, color: "var(--color-brand-caution-amber)" },
    { x: 200, y: 60, color: "var(--color-brand-safe-green)" },
  ];

  return (
    <svg
      viewBox="0 0 260 200"
      role="img"
      aria-label="Ilustrasi peta krisis dengan beberapa titik insiden berwarna sesuai tingkat keparahan"
      className="w-full max-w-md rounded-xl border border-brand-border bg-surface-container-lowest p-4"
    >
      <rect x="0" y="0" width="260" height="200" rx="12" fill="var(--color-surface-container)" />
      <path
        d="M20 160 Q80 120 140 150 T240 130"
        stroke="var(--color-outline-variant)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M40 40 Q100 70 160 40 T220 90"
        stroke="var(--color-outline-variant)"
        strokeWidth="2"
        fill="none"
      />
      {pins.map((pin, i) => (
        <g key={i}>
          <circle cx={pin.x} cy={pin.y} r="14" fill={pin.color} opacity="0.2" />
          <circle cx={pin.x} cy={pin.y} r="6" fill={pin.color} />
        </g>
      ))}
    </svg>
  );
}
