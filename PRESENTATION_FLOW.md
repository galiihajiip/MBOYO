# MBOYO — Presentation Flow & Pitch Outline

This document outlines the presentation slide map and key talking points for pitching **MBOYO** to hackathon judges and domain experts.

---

## 📽️ Slide Map

| Slide # | Title | Key Message / Visual | Time |
| :---: | :--- | :--- | :---: |
| **1** | Title & Tagline | *MBOYO — Laporan Tetap Jalan. Respons Lebih Tepat.* | 0:30 |
| **2** | The Disaster Reality | Network blackout, citizen report loss, unverified noise | 0:45 |
| **3** | The Solution Architecture | Offline-First PWA + Local CV Triage + Human Verification | 1:00 |
| **4** | Offline Invariant | Zero data loss via Dexie IndexedDB + Background Sync | 1:00 |
| **5** | Responsible AI | Calibrated EfficientNetV2 + Grad-CAM (Local CV Primary) | 1:15 |
| **6** | Command Center & PostGIS | Real-time crisis map, clustering, & response task dispatch | 1:15 |
| **7** | Governance & Audit Trail | End-to-end immutable audit lineage for government compliance | 0:45 |
| **8** | Conclusion & Q&A | Impact metrics, Top 80 readiness, & Technical Defense | 0:30 |

---

## 🎯 Key Differentiators to Emphasize

1. **Not Just a Wrapper**: Built from the ground up with local computer vision models (ONNX Runtime CPU) and local PostgreSQL/PostGIS. Does not rely on external cloud AI APIs for primary classification.
2. **Honest ML Philosophy**: Model accuracy is measured on touched vs. untouched test sets, complete with expected calibration error (ECE) and abstention logic (`needs_manual_review`).
3. **Strict RBAC Separation**: Reporters, Verifiers, Coordinators, Administrators, and Auditors have zero unauthorized role overlap. Auditors are strictly read-only.
