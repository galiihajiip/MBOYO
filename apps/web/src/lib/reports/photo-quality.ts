import type { QualityWarning } from "./types";

/**
 * Lightweight, purely client-side heuristic quality check — NOT a model
 * score (that comes later from apps/ml-api's real quality_score per
 * docs/product/DOMAIN_MODEL.md model_prediction.quality_score). This only
 * gives the Reporter immediate, honest feedback at capture time (e.g. "may
 * be blurry," per docs/product/RISK_REGISTER.md risk #4 in-app guidance),
 * never blocking submission — per docs/product/MVP_SCOPE.md, a low-quality
 * submission must still be allowed.
 */
export async function assessPhotoQuality(blob: Blob): Promise<QualityWarning> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;

  if (bitmap.width < 480 || bitmap.height < 480) {
    return "resolusi_rendah";
  }

  const canvas = new OffscreenCanvas(64, 64);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);

  let totalLuminance = 0;
  let edgeEnergy = 0;
  const luminances: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    luminances.push(luminance);
    totalLuminance += luminance;
  }

  const avgLuminance = totalLuminance / luminances.length;

  // Simple neighbor-difference "edge energy" proxy for sharpness — a very
  // low value suggests a flat/blurry image. This is a coarse heuristic, not
  // a calibrated blur-detection algorithm.
  for (let i = 1; i < luminances.length; i++) {
    edgeEnergy += Math.abs((luminances[i] ?? 0) - (luminances[i - 1] ?? 0));
  }
  const avgEdgeEnergy = edgeEnergy / luminances.length;

  if (avgLuminance < 40) return "terlalu_gelap";
  if (avgEdgeEnergy < 2) return "kemungkinan_buram";
  return null;
}

export const QUALITY_WARNING_MESSAGE: Record<NonNullable<QualityWarning>, string> = {
  terlalu_gelap: "Foto tampak terlalu gelap. Coba ambil ulang di tempat yang lebih terang jika memungkinkan.",
  kemungkinan_buram: "Foto kemungkinan buram. Coba ambil ulang dengan tangan yang lebih stabil jika memungkinkan.",
  resolusi_rendah: "Resolusi foto rendah. Foto tetap dapat dikirim, namun detail mungkin kurang jelas.",
};
