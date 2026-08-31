/**
 * The Moon.
 *
 * Meeus chapter 47 (an abridged ELP-2000/82), which is accurate to about 10
 * arcseconds in longitude -- comfortably inside the Moon's own half-degree
 * width, which is the bar that matters when you are drawing a marker on it.
 *
 * The Moon also needs a correction nothing else here does. It is close enough
 * that standing in Delhi rather than at the centre of the Earth moves it by up
 * to a degree -- twice its own width. Geocentric coordinates would put the
 * label visibly off the real Moon, so {@link moonPosition} applies topocentric
 * parallax using the observer's actual location.
 */

import { normalize360, toDegrees, toRadians } from './angles.js';
import { apparentTerms, applyApparentPlace } from './apparent.js';
import { DAYS_PER_CENTURY, J2000 } from './time.js';
import { meanObliquity } from './planets.js';
import type { Equatorial, Observer } from './coords.js';

/**
 * Periodic terms for longitude and distance (Meeus table 47.A).
 * Packed as [D, M, M', F, sin coefficient (1e-6 deg), cos coefficient (1e-3 km)].
 */
const TERMS_LR = [
  0, 0, 1, 0, 6288774, -20905355,
  2, 0, -1, 0, 1274027, -3699111,
  2, 0, 0, 0, 658314, -2955968,
  0, 0, 2, 0, 213618, -569925,
  0, 1, 0, 0, -185116, 48888,
  0, 0, 0, 2, -114332, -3149,
  2, 0, -2, 0, 58793, 246158,
  2, -1, -1, 0, 57066, -152138,
  2, 0, 1, 0, 53322, -170733,
  2, -1, 0, 0, 45758, -204586,
  0, 1, -1, 0, -40923, -129620,
  1, 0, 0, 0, -34720, 108743,
  0, 1, 1, 0, -30383, 104755,
  2, 0, 0, -2, 15327, 10321,
  0, 0, 1, 2, -12528, 0,
  0, 0, 1, -2, 10980, 79661,
  4, 0, -1, 0, 10675, -34782,
  0, 0, 3, 0, 10034, -23210,
  4, 0, -2, 0, 8548, -21636,
  2, 1, -1, 0, -7888, 24208,
  2, 1, 0, 0, -6766, 30824,
  1, 0, -1, 0, -5163, -8379,
  1, 1, 0, 0, 4987, -16675,
  2, -1, 1, 0, 4036, -12831,
  2, 0, 2, 0, 3994, -10445,
  4, 0, 0, 0, 3861, -11650,
  2, 0, -3, 0, 3665, 14403,
  0, 1, -2, 0, -2689, -7003,
  2, 0, -1, 2, -2602, 0,
  2, -1, -2, 0, 2390, 10056,
  1, 0, 1, 0, -2348, 6322,
  2, -2, 0, 0, 2236, -9884,
  0, 1, 2, 0, -2120, 5751,
  0, 2, 0, 0, -2069, 0,
  2, -2, -1, 0, 2048, -4950,
  2, 0, 1, -2, -1773, 4130,
  2, 0, 0, 2, -1595, 0,
  4, -1, -1, 0, 1215, -3958,
  0, 0, 2, 2, -1110, 0,
  3, 0, -1, 0, -892, 3258,
  2, 1, 1, 0, -810, 2616,
  4, -1, -2, 0, 759, -1897,
  0, 2, -1, 0, -713, -2117,
  2, 2, -1, 0, -700, 2354,
  2, 1, -2, 0, 691, 0,
  2, -1, 0, -2, 596, 0,
  4, 0, 1, 0, 549, -1423,
  0, 0, 4, 0, 537, -1117,
  4, -1, 0, 0, 520, -1571,
  1, 0, -2, 0, -487, -1739,
  2, 1, 0, -2, -399, 0,
  0, 0, 2, -2, -381, -4421,
  1, 1, 1, 0, 351, 0,
  3, 0, -2, 0, -340, 0,
  4, 0, -3, 0, 330, 0,
  2, -1, 2, 0, 327, 0,
  0, 2, 1, 0, -323, 1165,
  1, 1, -1, 0, 299, 0,
  2, 0, 3, 0, 294, 0,
  2, 0, -1, -2, 0, 8752,
];

/**
 * Periodic terms for latitude (Meeus table 47.B).
 * Packed as [D, M, M', F, sin coefficient (1e-6 deg)].
 */
const TERMS_B = [
  0, 0, 0, 1, 5128122,
  0, 0, 1, 1, 280602,
  0, 0, 1, -1, 277693,
  2, 0, 0, -1, 173237,
  2, 0, -1, 1, 55413,
  2, 0, -1, -1, 46271,
  2, 0, 0, 1, 32573,
  0, 0, 2, 1, 17198,
  2, 0, 1, -1, 9266,
  0, 0, 2, -1, 8822,
  2, -1, 0, -1, 8216,
  2, 0, -2, -1, 4324,
  2, 0, 1, 1, 4200,
  2, 1, 0, -1, -3359,
  2, -1, -1, 1, 2463,
  2, -1, 0, 1, 2211,
  2, -1, -1, -1, 2065,
  0, 1, -1, -1, -1870,
  4, 0, -1, -1, 1828,
  0, 1, 0, 1, -1794,
  0, 0, 0, 3, -1749,
  0, 1, -1, 1, -1565,
  1, 0, 0, 1, -1491,
  0, 1, 1, 1, -1475,
  0, 1, 1, -1, -1410,
  0, 1, 0, -1, -1344,
  1, 0, 0, -1, -1335,
  0, 0, 3, 1, 1107,
  4, 0, 0, -1, 1021,
  4, 0, -1, 1, 833,
  0, 0, 1, -3, 777,
  4, 0, -2, 1, 671,
  2, 0, 0, -3, 607,
  2, 0, 2, -1, 596,
  2, -1, 1, -1, 491,
  2, 0, -2, 1, -451,
  0, 0, 3, -1, 439,
  2, 0, 2, 1, 422,
  2, 0, -3, -1, 421,
  2, 1, -1, 1, -366,
  2, 1, 0, 1, -351,
  4, 0, 0, 1, 331,
  2, -1, 1, 1, 315,
  2, -2, 0, -1, 302,
  0, 0, 1, 3, -283,
  2, 1, 1, -1, -229,
  1, 1, 0, -1, 223,
  1, 1, 0, 1, 223,
  0, 1, -2, -1, -220,
  2, 1, -1, -1, -220,
  1, 0, 1, 1, -185,
  2, -1, -2, -1, 181,
  0, 1, 2, 1, -177,
  4, 0, -2, -1, 176,
  4, -1, -1, -1, 166,
  1, 0, 1, -1, -164,
  4, 0, 1, -1, 132,
  1, 0, -1, -1, -119,
  4, -1, 0, -1, 115,
  2, -2, 0, 1, 107,
];

/** Earth's equatorial radius, km. */
const EARTH_RADIUS_KM = 6378.14;

/** WGS84 polar/equatorial axis ratio. */
const FLATTENING_RATIO = 0.99664719;

export interface MoonPosition extends Equatorial {
  /** Distance from the observer, km. */
  distance: number;
  /** Apparent angular diameter, degrees. */
  angularDiameter: number;
  /** Illuminated fraction of the disc, 0 to 1. */
  illumination: number;
  /**
   * Position in the cycle, 0 to 1: 0 is new, 0.25 first quarter, 0.5 full,
   * 0.75 last quarter.
   */
  phase: number;
  /** Ecliptic longitude, degrees. */
  longitude: number;
  /** Ecliptic latitude, degrees. */
  latitude: number;
}

interface Fundamentals {
  lPrime: number;
  d: number;
  m: number;
  mPrime: number;
  f: number;
  e: number;
  a1: number;
  a2: number;
  a3: number;
}

function fundamentals(t: number): Fundamentals {
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;

  return {
    // Mean longitude of the Moon.
    lPrime: 218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000,
    // Mean elongation of the Moon from the Sun.
    d: 297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000,
    // Mean anomaly of the Sun.
    m: 357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000,
    // Mean anomaly of the Moon.
    mPrime: 134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000,
    // Argument of latitude.
    f: 93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000,
    // Corrects terms involving the Sun for the slow change in Earth's orbit.
    e: 1 - 0.002516 * t - 0.0000074 * t2,
    a1: 119.75 + 131.849 * t,
    a2: 53.09 + 479264.29 * t,
    a3: 313.45 + 481266.484 * t,
  };
}

/** Geocentric ecliptic longitude, latitude (degrees) and distance (km). */
export function moonEcliptic(jd: number): {
  longitude: number;
  latitude: number;
  distance: number;
} {
  const t = (jd - J2000) / DAYS_PER_CENTURY;
  const arg = fundamentals(t);

  let sumL = 0;
  let sumR = 0;
  let sumB = 0;

  for (let index = 0; index < TERMS_LR.length; index += 6) {
    const d = TERMS_LR[index] as number;
    const m = TERMS_LR[index + 1] as number;
    const mPrime = TERMS_LR[index + 2] as number;
    const f = TERMS_LR[index + 3] as number;
    const sinCoeff = TERMS_LR[index + 4] as number;
    const cosCoeff = TERMS_LR[index + 5] as number;

    // Terms involving the Sun's anomaly are damped by E, twice for |M| = 2.
    const eccentricity = m === 0 ? 1 : Math.abs(m) === 1 ? arg.e : arg.e * arg.e;
    const angle = toRadians(
      d * arg.d + m * arg.m + mPrime * arg.mPrime + f * arg.f,
    );

    sumL += sinCoeff * eccentricity * Math.sin(angle);
    sumR += cosCoeff * eccentricity * Math.cos(angle);
  }

  for (let index = 0; index < TERMS_B.length; index += 5) {
    const d = TERMS_B[index] as number;
    const m = TERMS_B[index + 1] as number;
    const mPrime = TERMS_B[index + 2] as number;
    const f = TERMS_B[index + 3] as number;
    const sinCoeff = TERMS_B[index + 4] as number;

    const eccentricity = m === 0 ? 1 : Math.abs(m) === 1 ? arg.e : arg.e * arg.e;
    const angle = toRadians(
      d * arg.d + m * arg.m + mPrime * arg.mPrime + f * arg.f,
    );

    sumB += sinCoeff * eccentricity * Math.sin(angle);
  }

  // Additive corrections from Venus, Jupiter and the flattening of the Earth.
  const a1 = toRadians(arg.a1);
  const a2 = toRadians(arg.a2);
  const a3 = toRadians(arg.a3);
  const lPrimeRad = toRadians(arg.lPrime);
  const fRad = toRadians(arg.f);
  const mPrimeRad = toRadians(arg.mPrime);

  sumL += 3958 * Math.sin(a1) + 1962 * Math.sin(lPrimeRad - fRad) + 318 * Math.sin(a2);
  sumB +=
    -2235 * Math.sin(lPrimeRad) +
    382 * Math.sin(a3) +
    175 * Math.sin(a1 - fRad) +
    175 * Math.sin(a1 + fRad) +
    127 * Math.sin(lPrimeRad - mPrimeRad) -
    115 * Math.sin(lPrimeRad + mPrimeRad);

  return {
    longitude: normalize360(arg.lPrime + sumL / 1000000),
    latitude: sumB / 1000000,
    distance: 385000.56 + sumR / 1000,
  };
}

/**
 * Apparent position of the Moon for an observer on the Earth's surface.
 *
 * Pass an observer and `jd` to get topocentric coordinates. Omit the observer
 * for geocentric ones, which is what almanacs quote but not what you see.
 */
export function moonPosition(
  jd: number,
  observer?: Observer,
  /** Sidereal time in degrees; required for the topocentric correction. */
  lst?: number,
): MoonPosition {
  const { longitude, latitude, distance } = moonEcliptic(jd);

  const eps = toRadians(meanObliquity(jd));
  const lambda = toRadians(longitude);
  const beta = toRadians(latitude);

  const sinBeta = Math.sin(beta);
  const cosBeta = Math.cos(beta);
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);

  let ra = normalize360(
    toDegrees(
      Math.atan2(sinLambda * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), cosLambda),
    ),
  );
  let dec = toDegrees(
    Math.asin(sinBeta * Math.cos(eps) + cosBeta * Math.sin(eps) * sinLambda),
  );

  // Nutation and aberration take the mean place of date to the apparent
  // place -- the same correction the Sun and planets get in the web client's
  // rendering path, applied here instead because this is where it can be
  // checked against Horizons' own apparent coordinates (see ephemeris.test.ts).
  const apparent = applyApparentPlace(ra, dec, apparentTerms(jd));
  ra = apparent.ra;
  dec = apparent.dec;

  let observerDistance = distance;

  if (observer && lst !== undefined) {
    const corrected = toTopocentric(ra, dec, distance, observer, lst);
    ra = corrected.ra;
    dec = corrected.dec;
    observerDistance = corrected.distance;
  }

  // Phase: the Moon's elongation from the Sun is what the terminator follows.
  const t = (jd - J2000) / DAYS_PER_CENTURY;
  const arg = fundamentals(t);
  const elongation = normalize360(arg.d);
  const phaseAngle = 180 - elongation;
  const illumination = (1 + Math.cos(toRadians(phaseAngle))) / 2;

  return {
    ra,
    dec,
    distance: observerDistance,
    angularDiameter: 2 * toDegrees(Math.asin(1737.4 / observerDistance)),
    illumination,
    phase: elongation / 360,
    longitude,
    latitude,
  };
}

/**
 * Shift a geocentric position to where an observer on the surface actually
 * sees it. Meeus chapter 40.
 */
function toTopocentric(
  ra: number,
  dec: number,
  distanceKm: number,
  observer: Observer,
  lst: number,
): { ra: number; dec: number; distance: number } {
  const latRad = toRadians(observer.latitude);
  const elevationKm = (observer.elevation ?? 0) / 1000;

  // Observer's distance from the Earth's centre, split into the components
  // parallel and perpendicular to the polar axis.
  const u = Math.atan(FLATTENING_RATIO * Math.tan(latRad));
  const rhoSinPhi =
    FLATTENING_RATIO * Math.sin(u) + (elevationKm / EARTH_RADIUS_KM) * Math.sin(latRad);
  const rhoCosPhi = Math.cos(u) + (elevationKm / EARTH_RADIUS_KM) * Math.cos(latRad);

  const sinParallax = EARTH_RADIUS_KM / distanceKm;
  const hourAngle = toRadians(lst - ra);
  const decRad = toRadians(dec);

  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);

  const denominator = cosDec - rhoCosPhi * sinParallax * Math.cos(hourAngle);
  const deltaRa = Math.atan2(-rhoCosPhi * sinParallax * Math.sin(hourAngle), denominator);
  const decPrime = Math.atan2(
    (sinDec - rhoSinPhi * sinParallax) * Math.cos(deltaRa),
    denominator,
  );

  // Cosine rule for the observer-to-Moon leg of the triangle.
  const distance = Math.sqrt(
    distanceKm * distanceKm +
      EARTH_RADIUS_KM * EARTH_RADIUS_KM -
      2 *
        distanceKm *
        EARTH_RADIUS_KM *
        (rhoSinPhi * sinDec + rhoCosPhi * cosDec * Math.cos(hourAngle)),
  );

  return {
    ra: normalize360(ra + toDegrees(deltaRa)),
    dec: toDegrees(decPrime),
    distance,
  };
}

/** Human-readable phase name for the illuminated fraction and cycle position. */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.02 || p > 0.98) return 'New moon';
  if (p < 0.23) return 'Waxing crescent';
  if (p < 0.27) return 'First quarter';
  if (p < 0.48) return 'Waxing gibbous';
  if (p < 0.52) return 'Full moon';
  if (p < 0.73) return 'Waning gibbous';
  if (p < 0.77) return 'Last quarter';
  return 'Waning crescent';
}
