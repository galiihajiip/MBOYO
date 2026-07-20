"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  ConfidenceMeter,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  MetricCard,
  NotificationCard,
  OnlineStatus,
  ProbabilityBars,
  RadioCard,
  RoleBadge,
  Select,
  Sheet,
  SeverityBadge,
  StatusBadge,
  SyncStatus,
  Textarea,
  Timeline,
  ToastProvider,
  useToast,
  brandColors,
  severityLabels,
  priorityLabels,
  roleLabels,
  reportStatusLabelsInternal,
  taskStatusLabels,
  type SeverityClass,
} from "@mboyo/ui";

const severityOrder = Object.keys(severityLabels) as SeverityClass[];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-brand-border pb-10">
      <h2 className="font-sans text-2xl font-bold text-on-surface">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SwatchRow() {
  const swatches = Object.entries(brandColors);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {swatches.map(([name, hex]) => (
        <div key={name} className="flex flex-col gap-2">
          <div
            className="h-16 w-full rounded-md border border-brand-border"
            style={{ backgroundColor: hex }}
          />
          <span className="font-sans text-xs font-semibold text-on-surface">{name}</span>
          <span className="font-mono text-xs text-on-surface-variant">{hex}</span>
        </div>
      ))}
    </div>
  );
}

interface DemoRow {
  id: string;
  report: string;
  severity: SeverityClass;
  status: keyof typeof reportStatusLabelsInternal;
}

const demoRows: DemoRow[] = [
  { id: "REP-2026-0001", report: "Jembatan Ciliwung", severity: "major_damage", status: "needs_manual_review" },
  { id: "REP-2026-0002", report: "Balai Warga RW 04", severity: "destroyed", status: "verified" },
  { id: "REP-2026-0003", report: "Jalan Kebon Jeruk", severity: "minor_damage", status: "analysis_completed" },
];

function ToastDemo() {
  const { show } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        show({
          title: "Laporan tersinkronisasi",
          description: "3 laporan berhasil dikirim ke server.",
          tone: "success",
        })
      }
    >
      Tampilkan Toast
    </Button>
  );
}

export function DesignSystemShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [radioValue, setRadioValue] = useState("minor_damage");

  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-sans text-4xl font-bold text-on-surface max-sm:text-2xl">
            Design System MBOYO
          </h1>
          <p className="font-sans text-base text-on-surface-variant">
            Referensi visual token dan komponen — lihat docs/design/DESIGN_SYSTEM_SPEC.md dan
            docs/product/CONTENT_GUIDE.md untuk spesifikasi lengkap.
          </p>
        </header>

        <Section title="Warna Merek">
          <SwatchRow />
        </Section>

        <Section title="Tombol (Button)">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Kirim Laporan</Button>
            <Button variant="secondary">Tambah Media</Button>
            <Button variant="success">Verifikasi</Button>
            <Button variant="warning">Eskalasi</Button>
            <Button variant="critical">Hapus</Button>
            <Button variant="ghost">Batal</Button>
            <Button variant="primary" disabled>
              Nonaktif
            </Button>
            <Button variant="primary" size="icon" aria-label="Tambah">
              +
            </Button>
          </div>
        </Section>

        <Section title="Formulir (Input, Textarea, Select, Checkbox, RadioCard)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Nama pelapor" aria-label="Nama pelapor" />
            <Select
              aria-label="Pilih tingkat keparahan"
              placeholder="Pilih tingkat keparahan"
              options={severityOrder.map((s) => ({ value: s, label: severityLabels[s] }))}
            />
          </div>
          <Textarea placeholder="Deskripsi kejadian..." aria-label="Deskripsi kejadian" />
          <label className="flex min-h-11 items-center gap-2">
            <Checkbox aria-label="Setujui persyaratan" />
            <span className="font-sans text-sm text-on-surface">Saya menyetujui persyaratan</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["minor_damage", "major_damage"] as SeverityClass[]).map((s) => (
              <RadioCard
                key={s}
                id={`severity-${s}`}
                name="severity-demo"
                value={s}
                checked={radioValue === s}
                onChange={() => setRadioValue(s)}
                label={severityLabels[s]}
                description="Contoh kartu radio untuk formulir laporan."
              />
            ))}
          </div>
        </Section>

        <Section title="Overlay (Dialog, Drawer, Sheet, Toast)">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>Buka Dialog</Button>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Konfirmasi Verifikasi"
              description="Tindakan ini akan mengubah status laporan menjadi terverifikasi."
            >
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button variant="success" onClick={() => setDialogOpen(false)}>
                  Konfirmasi
                </Button>
              </div>
            </Dialog>

            <Button onClick={() => setDrawerOpen(true)}>Buka Drawer</Button>
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Filter Peta">
              <p className="font-sans text-sm text-on-surface-variant">Contoh isi drawer filter.</p>
            </Drawer>

            <Button onClick={() => setSheetOpen(true)}>Buka Sheet</Button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Detail Titik">
              <p className="font-sans text-sm text-on-surface-variant">Contoh isi bottom sheet mobile.</p>
            </Sheet>

            <ToastDemo />
          </div>
        </Section>

        <Section title="Lencana (Badge, SeverityBadge, StatusBadge, RoleBadge)">
          <div className="flex flex-wrap gap-2">
            {severityOrder.map((s) => (
              <SeverityBadge key={s} severity={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(taskStatusLabels) as (keyof typeof taskStatusLabels)[]).map((s) => (
              <StatusBadge key={s} label={taskStatusLabels[s]} tone="info" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(roleLabels) as (keyof typeof roleLabels)[]).map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Netral</Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="success">Sukses</Badge>
            <Badge tone="warning">Peringatan</Badge>
            <Badge tone="critical">Kritis</Badge>
          </div>
        </Section>

        <Section title="Metrik dan Tabel Data">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Total Laporan" value={128} trend={{ direction: "up", label: "+12 hari ini" }} />
            <MetricCard label="Menunggu Verifikasi" value={7} trend={{ direction: "flat", label: "Stabil" }} />
            <MetricCard label="Latensi Sinkronisasi (p95)" value="820ms" />
          </div>
          <DataTable<DemoRow>
            columns={[
              { key: "id", header: "ID Laporan", render: (r) => <span className="font-mono">{r.id}</span> },
              { key: "report", header: "Laporan", render: (r) => r.report },
              {
                key: "severity",
                header: "Tingkat Keparahan",
                render: (r) => <SeverityBadge severity={r.severity} />,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge label={reportStatusLabelsInternal[r.status]} tone="info" />
                ),
              },
            ]}
            rows={demoRows}
            getRowKey={(r) => r.id}
          />
        </Section>

        <Section title="Status dan Umpan Balik (Empty, Error, Loading)">
          <div className="grid gap-4 sm:grid-cols-3">
            <EmptyState title="Antrean kosong" description="Semua laporan telah diverifikasi." />
            <ErrorState
              title="Gagal memuat data"
              description="Periksa koneksi Anda dan coba lagi."
              action={<Button variant="critical">Coba Lagi</Button>}
            />
            <div className="flex flex-col gap-2 rounded-lg border border-brand-border p-4">
              <LoadingSkeleton lines={3} />
            </div>
          </div>
        </Section>

        <Section title="Konektivitas dan Sinkronisasi">
          <div className="flex flex-wrap gap-3">
            <OnlineStatus online={true} />
            <OnlineStatus online={false} />
            <SyncStatus state="synced" />
            <SyncStatus state="syncing" pendingCount={2} />
            <SyncStatus state="queued" pendingCount={3} />
            <SyncStatus state="failed" pendingCount={1} />
          </div>
        </Section>

        <Section title="Kepercayaan Model (ConfidenceMeter, ProbabilityBars)">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <ConfidenceMeter label="Keyakinan Lokasi" value={0.86} />
              <ConfidenceMeter label="Skor Kualitas Foto" value={0.52} />
              <ConfidenceMeter label="Keyakinan Rendah" value={0.18} />
            </div>
            <ProbabilityBars
              probabilities={{
                unknown: 0.02,
                no_damage: 0.05,
                minor_damage: 0.18,
                major_damage: 0.55,
                destroyed: 0.2,
              }}
            />
          </div>
        </Section>

        <Section title="Linimasa dan Notifikasi">
          <Timeline
            events={[
              {
                id: "1",
                title: "Laporan dibuat",
                timestamp: "2026-07-16 08:12",
                actor: "Pelapor: Siti A.",
              },
              {
                id: "2",
                title: "Analisis selesai",
                timestamp: "2026-07-16 08:14",
                actor: "Sistem",
                description: "Model versi v0.3.1 — belum lolos ambang evaluasi.",
              },
              {
                id: "3",
                title: "Laporan terverifikasi",
                timestamp: "2026-07-16 08:40",
                actor: "Verifikator: Budi R.",
              },
            ]}
          />
          <div className="flex flex-col gap-1 rounded-lg border border-brand-border p-2">
            <NotificationCard
              title="Laporan baru menunggu verifikasi"
              description="REP-2026-0004 memerlukan tinjauan."
              timestamp="08:41"
            />
            <NotificationCard
              title="Tugas respons selesai"
              description="Tugas #TSK-0012 telah ditandai selesai."
              timestamp="Kemarin"
              read
            />
          </div>
        </Section>

        <Section title="Tipografi">
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[36px] font-bold leading-[44px] tracking-[-0.02em] max-sm:text-2xl">
              Headline XL — Plus Jakarta Sans
            </p>
            <p className="font-sans text-lg leading-7">Body LG — Plus Jakarta Sans</p>
            <p className="font-sans text-base leading-6">Body MD — Plus Jakarta Sans</p>
            <p className="font-mono text-lg font-semibold leading-6">Data LG — IBM Plex Mono #REP-2026-0001</p>
            <p className="font-mono text-sm font-medium leading-5">Data MD — -6.200000, 106.816666</p>
          </div>
        </Section>

        <Section title="Prioritas">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(priorityLabels) as (keyof typeof priorityLabels)[]).map((p) => (
              <Badge
                key={p}
                tone={
                  p === "critical"
                    ? "critical"
                    : p === "high"
                      ? "priority"
                      : p === "medium"
                        ? "warning"
                        : p === "low"
                          ? "success"
                          : "neutral"
                }
              >
                {priorityLabels[p]}
              </Badge>
            ))}
          </div>
        </Section>
      </main>
    </ToastProvider>
  );
}
