/**
 * Coordinate transforms.
 *
 * This is the heart of the app. A star's catalogue position (right ascension
 * and declination) is fixed; what changes is where the observer is and when.
 * Feed those in and out comes altitude (degrees above the horizon) and azimuth
 * (degrees clockwise from TRUE north) -- which is exactly what the phone's
 * sensors report about where it is pointed.
 *
 * Azimuth convention throughout: 0 = north, 90 = east, 180 = south, 270 = west.
 */

import { normalize360, toDegrees, toRadians } from './angles.js';
import { DAYS_PER_CENTURY, J2000, localSiderealTime } from './time.js';

/** A position on the celestial sphere. */
export interface Equatorial {
  /** Right ascension, degrees. */
  ra: number;
  /** Declination, degrees. */
  dec: number;
}

/** A direction in the observer's sky. */
export interface Horizontal {
  /** Degrees above the horizon; negative is below it. */
  altitude: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
}

/** Where and when the observer is. */
export interface Observer {
  /** Degrees north of the equator. */
  latitude: number;
  /** Degrees east of Greenwich. */
  longitude: number;
  /** Metres above sea level. Only used for rise/set refinement. */
  elevation?: number;
}

/**
 * Equatorial to horizontal.
 *
 * `lst` is the local sidereal time in degrees -- see {@link localSiderealTime}.
 * Hoisting it out of this function matters: it is the same for every object in
 * the frame, and this runs a few thousand times per redraw.
 */
export function equatorialToHorizontal(
  ra: number,
  dec: number,
  lst: number,
  latitude: number,
): Horizontal {
  // Hour angle: how far the object is past the observer's meridian.
  const hourAngle = toRadians(lst - ra);
  const decRad = toRadians(dec);
  const latRad = toRadians(latitude);

  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinH = Math.sin(hourAngle);
  const cosH = Math.cos(hourAngle);

  const sinAlt = sinDec * sinLat + cosDec * cosLat * cosH;

  return {
    altitude: toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt)))),
    // atan2 rather than the single-argument form, so the quadrant is right in
    // all four directions instead of only the southern half of the sky.
    azimuth: normalize360(
      toDegrees(Math.atan2(-cosDec * sinH, sinDec * cosLat - cosDec * sinLat * cosH)),
    ),
  };
}

/**
 * Horizontal back to equatorial.
 *
 * Used to answer "what is the crosshair pointing at" without searching the
 * whole catalogue in screen space.
 */
export function horizontalToEquatorial(
  altitude: number,
  azimuth: number,
  lst: number,
  latitude: number,
): Equatorial {
  const altRad = toRadians(altitude);
  const azRad = toRadians(azimuth);
  const latRad = toRadians(latitude);

  const sinAlt = Math.sin(altRad);
  const cosAlt = Math.cos(altRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  const sinDec = sinAlt * sinLat + cosAlt * cosLat * Math.cos(azRad);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const hourAngle = Math.atan2(
    -cosAlt * Math.sin(azRad),
    sinAlt * cosLat - cosAlt * sinLat * Math.cos(azRad),
  );

  return {
    ra: normalize360(lst - toDegrees(hourAngle)),
    dec: toDegrees(dec),
  };
}

/**
 * Precess a J2000 catalogue position to the mean equinox of date.
 *
 * The Earth's axis wobbles roughly a degree every 72 years, so by 2025 a J2000
 * position is already about 0.35 degrees stale. That is most of a Moon-width --
 * cheap enough to correct that there is no reason not to.
 *
 * IAU 1976 precession angles, applied per Meeus chapter 21.
 */
export function precessFromJ2000(ra: number, dec: number, jd: number): Equatorial {
  const t = (jd - J2000) / DAYS_PER_CENTURY;
  const t2 = t * t;
  const t3 = t2 * t;

  // Arcseconds, converted to degrees.
  const arcsec = 1 / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t2 + 0.017998 * t3) * arcsec;
  const z = (2306.2181 * t + 1.09468 * t2 + 0.018203 * t3) * arcsec;
  const theta = (2004.3109 * t - 0.42665 * t2 - 0.041833 * t3) * arcsec;

  const decRad = toRadians(dec);
  const raZeta = toRadians(ra + zeta);
  const thetaRad = toRadians(theta);

  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);
  const cosRaZeta = Math.cos(raZeta);

  const a = cosDec * Math.sin(raZeta);
  const b = Math.cos(thetaRad) * cosDec * cosRaZeta - Math.sin(thetaRad) * sinDec;
  const c = Math.sin(thetaRad) * cosDec * cosRaZeta + Math.cos(thetaRad) * sinDec;

  return {
    ra: normalize360(toDegrees(Math.atan2(a, b)) + z),
    dec: toDegrees(Math.asin(Math.max(-1, Math.min(1, c)))),
  };
}

/**
 * Atmospheric refraction, in degrees, to ADD to a true altitude.
 *
 * The atmosphere bends light downward, lifting everything slightly higher than
 * it geometrically is -- about half a degree right at the horizon, which is why
 * the Sun is already fully visible at the moment it "rises".
 *
 * Saemundsson's formula. Returns 0 well below the horizon, where it stops
 * meaning anything.
 */
export function refraction(trueAltitude: number): number {
  if (trueAltitude < -2) return 0;
  const arcminutes = 1.02 / Math.tan(toRadians(trueAltitude + 10.3 / (trueAltitude + 5.11)));
  return arcminutes / 60;
}

/** Apply {@link refraction} to a horizontal position. */
export function applyRefraction(position: Horizontal): Horizontal {
  return {
    altitude: position.altitude + refraction(position.altitude),
    azimuth: position.azimuth,
  };
}

/** Astronomical units per Earth radius (149,597,870.7 km / 6378.14 km). */
const EARTH_RADII_PER_AU = 23454.78;

/**
 * Diurnal (topocentric) parallax in altitude, degrees, to SUBTRACT from a
 * geocentric altitude.
 *
 * An observer standing on the surface is displaced from the Earth's centre by
 * up to one Earth radius, which shifts a nearby body's apparent altitude
 * downward -- the opposite direction from refraction, and much smaller except
 * for the Moon (which gets the full 3D correction in moon.ts instead; this is
 * the lighter version, adequate at planetary distances). Venus at closest
 * approach (about 0.28 au) is displaced by up to 31", which is the largest
 * case among the planets.
 *
 * Ignores Earth's flattening and the observer's exact position on the disc,
 * both well under an arcsecond here -- the full correction the Moon needs
 * would be spending real code on an effect ten times smaller than the compass.
 */
export function diurnalParallax(distanceAu: number, altitude: number): number {
  const sinP = Math.cos(toRadians(altitude)) / (distanceAu * EARTH_RADII_PER_AU);
  return toDegrees(Math.asin(Math.max(-1, Math.min(1, sinP))));
}

/** Apply {@link diurnalParallax} to a horizontal position. */
export function applyDiurnalParallax(position: Horizontal, distanceAu: number): Horizontal {
  return {
    altitude: position.altitude - diurnalParallax(distanceAu, position.altitude),
    azimuth: position.azimuth,
  };
}

/** Standard altitude at which a body counts as risen or set. */
export const RISE_SET_ALTITUDE = {
  /** Stars and planets: refraction alone. */
  star: -0.5667,
  /** The Sun's upper limb touching the horizon. */
  sun: -0.8333,
  /** The Moon, allowing for its parallax. */
  moon: 0.125,
} as const;

export interface RiseTransitSet {
  /** When the object crosses the meridian (its highest point), or null if never. */
  transit: Date | null;
  rise: Date | null;
  set: Date | null;
  /** True when the object never sets on this date at this latitude. */
  circumpolar: boolean;
  /** True when the object never rises on this date at this latitude. */
  neverRises: boolean;
}

/**
 * Rise, transit and set times for a fixed position, for the UTC day containing
 * `when`.
 *
 * Treats the position as constant across the day, which is right for stars and
 * close enough for planets. The Moon moves half a degree an hour, so its times
 * from this are good to a few minutes rather than seconds.
 */
export function riseTransitSet(
  ra: number,
  dec: number,
  observer: Observer,
  when: Date,
  standardAltitude: number = RISE_SET_ALTITUDE.star,
): RiseTransitSet {
  const latRad = toRadians(observer.latitude);
  const decRad = toRadians(dec);

  const cosHourAngle =
    (Math.sin(toRadians(standardAltitude)) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad));

  const circumpolar = cosHourAngle < -1;
  const neverRises = cosHourAngle > 1;

  // Midnight UTC of the day in question.
  const dayStart = new Date(
    Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()),
  );

  // Sidereal and solar time run at slightly different rates; converting an
  // interval of sidereal time back to clock time needs this factor.
  const SIDEREAL_TO_SOLAR = 0.9972695663;

  const timeOfLst = (targetLst: number): Date => {
    const lstAtMidnight = localSiderealTime(
      dayStart.getTime() / 86400000 + 2440587.5,
      observer.longitude,
    );
    const degreesToGo = normalize360(targetLst - lstAtMidnight);
    const hours = (degreesToGo / 15) * SIDEREAL_TO_SOLAR;
    return new Date(dayStart.getTime() + hours * 3600000);
  };

  const transit = timeOfLst(ra);

  if (circumpolar || neverRises) {
    return { transit, rise: null, set: null, circumpolar, neverRises };
  }

  const hourAngle = toDegrees(Math.acos(cosHourAngle));
  return {
    transit,
    rise: timeOfLst(ra - hourAngle),
    set: timeOfLst(ra + hourAngle),
    circumpolar: false,
    neverRises: false,
  };
}
