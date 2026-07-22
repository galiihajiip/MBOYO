# MBOYO — Known Scope Boundaries & Technical Limitations

This document explicitly lists known technical limitations, scope boundaries, and post-hackathon roadmap items for the **MBOYO** platform.

---

## 1. Disclosed Boundaries

1. **Ground Photos vs. Satellite Imagery**:
   - The ML computer vision models (EfficientNetV2 / ConvNeXt) are trained specifically on ground-level citizen images of building damage. Satellite imagery analysis requires separate specialized models and is out of scope for ground-triage.
2. **GPS Accuracy Limits**:
   - Device GPS accuracy relies on hardware sensors and satellite visibility. In urban canyon or heavy cloud conditions, GPS accuracy radius may expand up to 50–100 meters. The app provides a manual map pin fallback for fine-tuning.
3. **Background Sync Browser Variance**:
   - Native Background Sync API is fully supported on Chromium-based browsers (Chrome, Edge, Opera, Brave). On Safari/iOS where Background Sync API is restricted by WebKit, sync replay triggers automatically upon app launch or network reconnection listeners.

---

## 2. Future Roadmap (Post-v1.0.0)

- Integration with official National Disaster Management Agency (BNPB) emergency APIs.
- Multi-lingual UI localization (Bahasa Indonesia, English, Regional Languages).
- Edge ONNX inference execution directly inside WebAssembly (WASM) in browser client.
