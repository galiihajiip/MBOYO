# MBOYO — Live Presentation Script & Demo Guide

> **Tagline:** *"Laporan Tetap Jalan. Respons Lebih Tepat."*  
> **Event:** VETERAN KUKUS × Hackathon Bank Indonesia 2026 Capstone  
> **Total Duration:** 7 Minutes (5 Mins Live Demo + 2 Mins Q&A Defense)

---

## ⏱️ Timeline & Demo Flow Map

```text
[ 0:00 - 1:00 ] Introduction & The Problem (Public Landing Page)
[ 1:00 - 2:30 ] Offline Citizen Flow (Reporter Wizard + Disconnected Mode)
[ 2:30 - 3:30 ] Automatic Sync & Computer Vision Triage (FastAPI ML API)
[ 3:30 - 4:45 ] Human Verification & Command Coordination (Verifier & Coordinator)
[ 4:45 - 5:30 ] Audit Lineage & Governance (Auditor Portal)
[ 5:30 - 7:00 ] Q&A & Technical Defense
```

---

## 🎭 Step-by-Step Presenter Script

### Act 1: The Problem & Public Front (0:00 – 1:00)
**Presenter**:
> *"Selamat pagi/siang Dewan Juri yang terhormat. Ketika bencana alam melanda, masalah terbesar pertama adalah putusnya jaringan komunikasi dan maraknya disinformasi. Laporan warga seringkali gagal terkirim, atau menumpuk tanpa verifikasi.*
> 
> *Memperkenalkan **MBOYO** — platform koordinasi tanggap bencana berbasis Offline-First PWA, Computer Vision lokal, dan Verifikasi Terstruktur."*
*(Show Landing Page `/` — Highlight offline promise & core features)*

### Act 2: Offline Citizen Report Creation (1:00 – 2:30)
**Presenter**:
> *"Mari kita simulasikan skenario nyata. Seorang warga berada di lokasi terdampak bencana tanpa sinyal internet."*
*(Open DevTools -> Network -> Toggle **Offline**)*
> *"Warga membuka aplikasi MBOYO PWA, memilih jenis bencana, mengambil foto kerusakan bangunan, dan sistem mencatat koordinat GPS beserta tingkat akurasi lokasi."*
*(Click **Kirim Laporan**)*
> *"Perhatikan status: **'Laporan Tersimpan Offline dalam Perangkat'**. Bahkan jika halaman di-refresh atau HP dimatikan, data tersimpan utuh di IndexedDB (`mboyo-offline`)."*

### Act 3: Connectivity Restoration & ML Triage (2:30 – 3:30)
**Presenter**:
> *"Begitu HP mendapatkan kembali koneksi internet..."*
*(Toggle DevTools Network back to **Online**)*
> *"Service Worker MBOYO secara otomatis dan tanpa intervensi pengguna menyinkronkan laporan ke server secara terenkripsi dan idempotent (bebas duplikasi).*
> 
> *Seketika laporan diterima, Python Background Worker mengirimkan gambar ke **FastAPI ML API** yang menjalankan model Computer Vision lokal (EfficientNetV2/ConvNeXt) untuk mengklasifikasikan tingkat kerusakan (`destroyed`, `major_damage`, `minor_damage`, `no_damage`) serta menghitung nilai ECE calibration dan heatmaps Grad-CAM."*

### Act 4: Human Verification & Command Center (3:30 – 4:45)
**Presenter**:
> *"Namun, MBOYO tidak pernah menyerahkan keputusan keselamatan warga 100% pada AI secara mentah-mentah. AI bertindak sebagai triage awal.*
> 
> *Sekarang kita beralih ke peran **Verifier** di `/verifier`."*
*(Show Verifier Detail page — Point out Grad-CAM heatmap, duplicate warning, and calibration score)*
> *"Petugas Verifikator meninjau bukti foto, tingkat kepercayaan model, dan menyetujui (`Confirm`) atau mengoreksi (`Override`) hasil analisis.*
> 
> *Setelah diverifikasi, data langsung muncul di **Command Center Komando** (`/command/peta`). Koordinator dapat melihat klaster kerusakan PostGIS dan langsung menetapkan Tugas Respons (`Response Task`) kepada tim lapangan."*

### Act 5: Auditability & Governance (4:45 – 5:30)
**Presenter**:
> *"Terakhir, untuk transparansi dan akuntabilitas penuh, peran **Auditor** di `/audit` dapat menelusuri silsilah data (*data lineage*) dari detik pertama foto diambil di HP warga, prediksi versi model ML, keputusan verifikator, hingga penugasan respons lapangan.*
> 
> *MBOYO: Laporan Tetap Jalan, Respons Lebih Tepat. Terima kasih."*
