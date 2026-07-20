import "server-only";
import sharp from "sharp";

/**
 * Average hash (aHash): downscale to 8x8 grayscale, compare each pixel to
 * the mean, emit one bit per pixel — a 64-bit hash encoded as 16 hex
 * characters, matching report_evidence.perceptual_hash's column shape
 * (BLOCK 08 schema comment: "e.g. pHash/aHash, 64-bit hex"). aHash is
 * deliberately simple (not DCT-based pHash) — it is fast, dependency-free
 * beyond sharp (already required for decode/thumbnail), and sufficient for
 * this block's purpose: a coarse near-duplicate *signal* surfaced to the
 * Verifier, not a forensic-grade similarity score. Two images with a small
 * Hamming distance between their hashes are visually similar; this module
 * only computes the hash, not the comparison/threshold (that is the ML
 * worker's job per model_predictions.duplicate_candidate_report_id, out of
 * this block's synchronous upload path).
 */
export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;

  let bits = "";
  for (const value of data) {
    bits += value >= mean ? "1" : "0";
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}
