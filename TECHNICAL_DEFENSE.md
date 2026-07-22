# MBOYO — Technical Architecture Defense Document

This document provides a deep technical defense of the engineering decisions, data invariants, security boundaries, and machine learning methodologies underpinning the **MBOYO** platform.

---

## 1. Architectural Principles

1. **BFF Trust Boundary**: The browser client NEVER executes raw database mutations with elevated privileges or accesses private storage buckets directly. The Next.js BFF validates sessions, enforces RBAC, and generates short-lived (15-minute) signed URLs for private evidence access.
2. **Offline-First Persistence**: IndexedDB is treated as the primary write store during offline conditions, with background sync acting as an idempotent transport layer.
3. **Determinism in Demo Mode**: When `DEMO_MODE=true` is set, the application injects pre-seeded, realistic Indonesian disaster events (coordinates around West Java / Jakarta) and deterministic ML predictions to guarantee zero presentation failure during live judge evaluation.

---

## 2. Machine Learning Pipeline & Honesty Guarantee

```text
[ Citizen Photo ] ──► [ Quality Check ] ──► [ ONNX Model Inference ] ──► [ Probability Calibration ]
                            │                             │                        │
                            ▼ (Fail)                      ▼ (High Entropy)         ▼ (Pass)
                   [ Abstain Path ]             [ Manual Review Queue ]   [ Verifier Triage ]
```

- **Model Architectures Benchmarked**: EfficientNetV2-S, ConvNeXt-Tiny, MobileNetV3-Large.
- **Abstention Policy**: Predictions with max probability < 0.65 or high normalized entropy are automatically tagged with `abstained: true` and routed to manual human review.
- **Grad-CAM Non-Causal Disclaimer**: Heatmaps visualize feature activation regions to assist human verifiers, but are explicitly marked as non-causal visual aids.

---

## 3. Data Sovereignty & Audit Lineage

- **Immutability of Audit Log**: The `audit_events` table enforces an append-only invariant via PostgreSQL triggers and RLS policies. Deletions and updates on audit records are rejected at the database engine level.
- **Auditor Role Integrity**: The Auditor role (`auditor@mboyo.demo`) has `SELECT`-only permissions across views and model registries. No mutation endpoints accept Auditor tokens.
