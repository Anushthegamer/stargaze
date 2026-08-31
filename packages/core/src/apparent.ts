/**
 * Apparent place: nutation and annual aberration.
 *
 * Precession moves the whole reference frame to the equinox of date (see
 * {@link precessFromJ2000} in coords.ts). Two smaller effects sit on top of
 * that and are not frame rotations: nutation is the Earth's axis wobbling on
 * a period tied to the Moon's orbit (up to about 17"), and aberration is the
 * finite speed of light combined with Earth's own orbital motion bending
 * every direction by up to about 20.5". Both are cheap enough that there is
 * no reason to leave them out.
 *
 * Low-precision versions: nutation uses only its largest term (Meeus ch. 22),
 * and aberration uses the reduced formula (Meeus ch. 23) that ignores the
 * small correction for Earth's orbital eccentricity. Both are accurate to a
 * fraction of an arcsecond -- comfortably inside what they are correcting,
 * and inside every other error in this app by a wide margin.
 */

import { normalize360, toRadians } from './angles.js';
import type { Equatorial } from './coords.js';
import { DAYS_PER_CENTURY, J2000 } from './time.js';
import { meanObliquity } from './planets.js';

/** Constant of aberration, arcseconds (IAU). */
const ABERRATION_CONSTANT_ARCSEC = 20.49552;
const ARCSEC_TO_DEG = 1 / 3600;

/**
 * Shared per-instant quantities, meant to be computed once per frame and
 * reused for every object -- the same hoisting {@link toHorizontal} does for
 * the trigonometry that does not depend on the individual star.
 */
export interface ApparentTerms {
  /** Nutation in longitude, degrees. */
  deltaPsi: number;
  /** Nutation in obliquity, degrees. */
  deltaEpsilon: number;
  /** Mean obliquity of date, degrees. */
  epsilon: number;
  /** Sun's apparent ecliptic longitude, degrees -- aberration acts along it. */
  sunLongitude: number;
}

/** Everything {@link applyApparentPlace} needs, for a given (TT) Julian Date. */
export function apparentTerms(jd: number): ApparentTerms {
  const t = (jd - J2000) / DAYS_PER_CENTURY;

  // Longitude of the ascending node of the Moon's mean orbit -- the argument
  // nutation's principal term, and the small correction to solar longitude
  // below, are both driven by.
  const omega = normalize360(125.04452 - 1934.136261 * t);
  const omegaRad = toRadians(omega);

  const deltaPsi = -17.2 * Math.sin(omegaRad) * ARCSEC_TO_DEG;
  const deltaEpsilon = 9.2 * Math.cos(omegaRad) * ARCSEC_TO_DEG;

  // Low-precision solar longitude (Meeus ch. 25): mean longitude plus the
  // equation of center, corrected the same small amount for nutation and
  // aberration that the Sun's own position needs.
  const l0 = normalize360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = normalize360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const mRad = toRadians(m);
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
    0.000289 * Math.sin(3 * mRad);
  const trueLongitude = l0 + center;
  const sunLongitude = normalize360(trueLongitude - 0.00569 - 0.00478 * Math.sin(omegaRad));

  return { deltaPsi, deltaEpsilon, epsilon: meanObliquity(jd), sunLongitude };
}

/**
 * Shift a mean-equinox-of-date position to its apparent place: nutation then
 * annual aberration. The order does not matter at this precision -- both are
 * additive corrections a few to a few tens of arcseconds in size, not a
 * composed rotation.
 */
export function applyApparentPlace(ra: number, dec: number, terms: ApparentTerms): Equatorial {
  const raRad = toRadians(ra);
  const decRad = toRadians(dec);
  const epsRad = toRadians(terms.epsilon);
  const lambdaRad = toRadians(terms.sunLongitude);

  const sinRa = Math.sin(raRad);
  const cosRa = Math.cos(raRad);
  const tanDec = Math.tan(decRad);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinEps = Math.sin(epsRad);
  const cosEps = Math.cos(epsRad);
  const tanEps = Math.tan(epsRad);
  const sinLambda = Math.sin(lambdaRad);
  const cosLambda = Math.cos(lambdaRad);

  // Nutation (Meeus eq. 23.1).
  const nutationRa =
    (cosEps + sinEps * sinRa * tanDec) * terms.deltaPsi - cosRa * tanDec * terms.deltaEpsilon;
  const nutationDec = sinEps * cosRa * terms.deltaPsi + sinRa * terms.deltaEpsilon;

  // Annual aberration (Meeus eq. 23.2, reduced form).
  const kappa = ABERRATION_CONSTANT_ARCSEC * ARCSEC_TO_DEG;
  const aberrationRa = (-kappa * (cosRa * cosLambda * cosEps + sinRa * sinLambda)) / cosDec;
  const aberrationDec =
    -kappa *
    (cosLambda * cosEps * (tanEps * cosDec - sinRa * sinDec) + cosRa * sinDec * sinLambda);

  return {
    ra: normalize360(ra + nutationRa + aberrationRa),
    dec: dec + nutationDec + aberrationDec,
  };
}
