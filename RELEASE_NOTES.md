# MBOYO — Release Notes (v1.0.0-capstone)

> **Release Version:** `v1.0.0-capstone`  
> **Release Date:** 2026-07-22  
> **Target:** PIDI Digdaya × Hackathon Bank Indonesia 2026 Capstone Presentation

---

## 🌟 Highlights & Key Features

We are proud to release **MBOYO v1.0.0-capstone** (*"Laporan Tetap Jalan. Respons Lebih Tepat."*), an offline-first disaster reporting, computer vision damage triage, geospatial command, and human verification platform.

### Core Capabilities

1. **Offline-First Resilience**: Citizens in blackout disaster zones can capture damage photos and GPS coordinates without cellular network connectivity. Reports are stored durably in browser IndexedDB and automatically synchronized when connectivity returns.
2. **Local Machine Learning Triage**: EfficientNetV2 and ConvNeXt computer vision models classify damage severity (`destroyed`, `major_damage`, `minor_damage`, `no_damage`) with probability calibration and Grad-CAM visual heatmaps.
3. **Human-in-the-Loop Validation**: Automated AI predictions are never authoritative on their own. Dedicated Verifiers review quality warnings, duplicate perceptual hashes, and model calibration before confirming incident reports.
4. **Geospatial Crisis Command**: Response Coordinators access a MapLibre vector map with PostGIS spatial clustering, priority assignment, and real-time response task dispatching.
5. **Auditable Governance**: Read-only Auditors can trace complete end-to-end data lineage from citizen upload to model inference, verifier approval, task assignment, and compliance export.
