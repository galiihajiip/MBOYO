# MBOYO — Contingency & Plan B Protocol

This document outlines fallback protocols to maintain presentation continuity during live live demo failures or infrastructure degradation.

---

## 🚨 Contingency Matrix

| Failure Mode | Symptom | Immediate Fallback (Plan B) | Action Time |
| :--- | :--- | :--- | :---: |
| **Network Outage during Demo** | Wi-Fi drops completely on stage | Rely 100% on PWA offline local mode & Workbox offline app shell | < 5s |
| **Vector Map Tile Load Failure** | MapLibre tiles fail to render | Switch to `DataTable` accessible list fallback view via UI toggle | < 3s |
| **FastAPI ML API Container Crash** | ML API unreachable | Application automatically uses deterministic demo fallback predictions | < 2s |
| **Supabase Local Service Interruption** | Auth or Postgres drops | Switch to Mock Client State mode (labeled as DEMO FALLBACK) | < 5s |
| **Camera Permission Denied** | Web camera API blocked by browser | Use pre-loaded disaster photo library gallery selector | < 2s |

---

## 🎬 Presenter Spoken Recovery Lines

- **If Map Fails to Render**:
  > *"Sistem MBOYO didesain dengan prinsip aksesibilitas tinggi. Jika terjadi gangguan penyedia peta raster/vektor, pengguna dan koordinator dapat beralih ke Mode Aksesibel Tampilan Tabel Data tanpa kehilangan fungsi analisis sama sekali."*

- **If ML Service Delays**:
  > *"Ketika terjadi kelebihan beban pada modul AI, sistem secara otomatis memasukkan laporan ke Antrean Verifikasi Manual Manusia tanpa memblokir pembuatan laporan warga."*
