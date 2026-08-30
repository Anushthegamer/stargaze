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

/** Interpolate between two angles the short way round. */
export function lerpAngle(from: number, to: number, t: number): number {
  return normalize360(from + angularDelta(from, to) * t);
}
