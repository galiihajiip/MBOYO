# MBOYO — Anticipated Judge Q&A & Technical Defense Answers

This document lists anticipated questions from hackathon judges, technical evaluators, and disaster management domain experts, along with authoritative answers.

---

## ❓ Category A: Architecture & Offline Invariants

### Q1: "Bagaimana MBOYO menjamin data laporan tidak hilang saat sinyal mati total?"
> **Answer**:  
> MBOYO menerapkan arsitektur *Offline-First* menggunakan **Dexie IndexedDB** (`mboyo-offline`). Saat laporan dibuat tanpa koneksi, foto Blob, metadata GPS, dan data formulir disimpan secara lokal dalam penyimpanan bertahan (*durable storage*). 
> Begitu perangkat mendeteksi jaringan internet (menggunakan Service Worker Background Sync API atau fallback event-listener), sistem akan melakukan penyinkronkan ulang (*replay queue*) secara otomatis dan bersifat **idempotent** menggunakan `client_report_id` acak berformat UUIDv4 sehingga tidak akan terjadi pengiriman ganda meskipun terjadi kendala jaringan saat pengiriman.

---

## ❓ Category B: Computer Vision & Responsible AI

### Q2: "Apakah AI di MBOYO langsung mengambil keputusan penanganan bencana secara otomatis?"
> **Answer**:  
> **Tidak.** MBOYO memegang teguh prinsip *Human-in-the-Loop*. Model AI lokal kami (EfficientNetV2/ConvNeXt) hanya berfungsi sebagai *triage* dan penyaring prioritas awal (*automated prioritization*). 
> Setiap hasil prediksi menyertakan tingkat kalibrasi probabilitas dan visualisasi **Grad-CAM**. Semua laporan berstatus *needs_manual_review* atau *abstained* wajib diverifikasi secara manual oleh peran **Verifier** manusia sebelum diteruskan ke Command Center Komando.

### Q3: "Mengapa menggunakan Model CV Lokal (FastAPI/ONNX) dan bukan menyuruh LLM cloud seperti Gemini memproses semua foto?"
> **Answer**:  
> Ada 3 alasan teknis utama:
> 1. **Kemandirian & Latensi**: Saat tanggap bencana, ketergantungan pada API cloud eksternal sangat berisiko jika terjadi kegagalan jaringan atau pembatasan kuota (*rate limiting*). Model ONNX lokal kami dapat mengeksekusi inferensi dalam <200ms di CPU standar.
> 2. **Kepatuhan Privasi Data**: Foto warga dan lokasi sensitif tidak boleh dikirim secara sembarangan ke server pihak ketiga tanpa persetujuan.
> 3. **Peran Gemini di MBOYO**: Gemini diintegrasikan secara *opt-in* hanya sebagai penasihat eksternal (*external advisory*) sekunder untuk Verifikator manusia, dan **tidak pernah** memiliki otoritas mengubah status resmi laporan.

---

## ❓ Category C: Security, RBAC & Data Sovereignty

### Q4: "Bagaimana cara mencegah laporan palsu (*spam*) atau foto yang diunggah ulang (*duplicate upload*)?"
> **Answer**:  
> MBOYO memiliki 3 lapis perlindungan:
> 1. **Perceptual Hashing & SHA-256**: Setiap foto yang diunggah dihitung nilai hash perseptualnya untuk mendeteksi kesamaan visual dan mendeteksi foto duplikat di database.
> 2. **PostGIS Geofencing & Location Trust**: Koordinat GPS divalidasi terhadap batas wilayah bencana (*disaster event boundary*), akurasi bawaan sensor HP, serta deteksi kejanggalan lokasi.
> 3. **Audit Lineage**: Seluruh tindakan pengguna terikat pada peran RBAC Supabase RLS (*Row Level Security*) yang tidak dapat dimutasi.
