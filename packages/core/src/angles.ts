/**
 * Angle helpers.
 *
 * Every public function in this package takes and returns DEGREES. Radians
 * exist only inside function bodies. Mixing the two is the single most common
 * bug in positional astronomy code, so the convention is absolute.
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const toRadians = (degrees: number): number => degrees * DEG;
export const toDegrees = (radians: number): number => radians * RAD;

/** Wrap to [0, 360). */
export function normalize360(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Wrap to [-180, 180). */
export function normalize180(degrees: number): number {
  return normalize360(degrees + 180) - 180;
}

/**
 * Shortest signed angular distance from `from` to `to`, in [-180, 180).
 *
 * Used everywhere a heading is smoothed or compared: without it, a compass
 * crossing north jumps 359 degrees instead of moving one.
 */
export function angularDelta(from: number, to: number): number {
  return normalize180(to - from);
}

/** Great-circle separation between two points on the celestial sphere. */
export function angularSeparation(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const d1 = toRadians(dec1);
  const d2 = toRadians(dec2);
  const dRa = toRadians(ra2 - ra1);

  // Vincenty form: well conditioned for both small and large separations,
  // unlike the plain cosine formula which loses precision when objects are
  // close together -- which is exactly when this gets called (hit-testing).
  const sinD1 = Math.sin(d1);
  const cosD1 = Math.cos(d1);
  const sinD2 = Math.sin(d2);
  const cosD2 = Math.cos(d2);
  const sinDRa = Math.sin(dRa);
  const cosDRa = Math.cos(dRa);

  const numerator = Math.hypot(
    cosD2 * sinDRa,
    cosD1 * sinD2 - sinD1 * cosD2 * cosDRa,
  );
  const denominator = sinD1 * sinD2 + cosD1 * cosD2 * cosDRa;

  return toDegrees(Math.atan2(numerator, denominator));
}

export interface CombinedAngles {
  /** The circular mean of the kept values, degrees. */
  mean: number;
  /** How many values went into the mean. */
  count: number;
  /** How many were thrown out as outliers, more than 90 degrees from the rest. */
  discarded: number;
}

/**
 * Combine several measurements of the same angle into one, more robust than
 * trusting any single measurement to noise.
 *
 * Circular mean, because a plain average breaks at the 0/360 wrap -- averaging
 * 359 and 1 has to give 0, not 180. A value more than 90 degrees from the
 * rough mean is dropped rather than averaged in: that much disagreement means
 * it measured something else entirely, not that the true value is that
 * uncertain, and letting it in would corrupt an otherwise-good result.
 */
export function combineAngles(degrees: number[]): CombinedAngles {
  if (degrees.length === 0) return { mean: 0, count: 0, discarded: 0 };

  const rough = circularMean(degrees);
  const kept = degrees.filter((d) => Math.abs(angularDelta(rough, d)) <= 90);
  const mean = kept.length > 0 ? circularMean(kept) : rough;

  return { mean, count: kept.length, discarded: degrees.length - kept.length };
}

function circularMean(degrees: number[]): number {
  let sinSum = 0;
  let cosSum = 0;
  for (const d of degrees) {
    const rad = toRadians(d);
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  // atan2's principal value is already (-180, 180], which is exactly the
  // range a compass offset or a heading delta lives in -- no separate wrap.
  return toDegrees(Math.atan2(sinSum, cosSum));
}
