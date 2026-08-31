/**
 * Time scales.
 *
 * The sky's apparent rotation is driven by SIDEREAL time, not clock time: a
 * star returns to the same spot every 23h56m04s, so the two drift apart by
 * about four minutes a day. Getting this wrong is a slow, seasonal-looking
 * error that is very hard to spot by eye.
 */

import { normalize360 } from './angles.js';

/** Julian Date of the J2000.0 epoch, 2000 January 1 at 12:00 TT. */
export const J2000 = 2451545.0;

/** Julian days in a Julian century. */
export const DAYS_PER_CENTURY = 36525.0;

/** Milliseconds in a day. */
const MS_PER_DAY = 86400000;

/** Julian Date at the Unix epoch, 1970 January 1 at 00:00 UTC. */
const JD_UNIX_EPOCH = 2440587.5;

/**
 * Julian Date from a JS Date.
 *
 * `Date` is already an absolute instant in UTC, so this is exact arithmetic --
 * no calendar handling and no local-timezone trap.
 */
export function julianDate(when: Date): number {
  return when.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** Inverse of {@link julianDate}. */
export function dateFromJulian(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * MS_PER_DAY);
}

/**
 * Greenwich Mean Sidereal Time in degrees.
 *
 * IAU 1982 expression. UT1 and UTC are treated as the same thing here: they
 * never differ by more than 0.9 s, which is 0.004 degrees of sky rotation --
 * roughly a thousandth of the error a phone compass contributes.
 */
export function greenwichMeanSiderealTime(jd: number): number {
  const d = jd - J2000;
  const t = d / DAYS_PER_CENTURY;

  const degrees =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * t * t -
    (t * t * t) / 38710000;

  return normalize360(degrees);
}

/**
 * Local Mean Sidereal Time in degrees, for an east-positive longitude.
 *
 * This is the right ascension currently crossing the observer's meridian, and
 * it is the bridge between "what time is it" and "what is overhead".
 */
export function localSiderealTime(jd: number, longitudeDeg: number): number {
  return normalize360(greenwichMeanSiderealTime(jd) + longitudeDeg);
}

/** Convenience: local sidereal time straight from a Date. */
export function localSiderealTimeAt(when: Date, longitudeDeg: number): number {
  return localSiderealTime(julianDate(when), longitudeDeg);
}

/**
 * Delta-T: Terrestrial Time minus UT, in seconds.
 *
 * Ephemeris theories (the Moon and planets here) are functions of TT, but the
 * only clock available is UTC -- currently about 69 seconds behind. That is
 * negligible for the planets, which barely move in a minute, but the Moon
 * covers about 0.55 arcseconds per second of time, so skipping this costs it
 * roughly half an arcminute.
 *
 * Espenak & Meeus's polynomial, valid 2005-2050. Delta-T is not predictable
 * far ahead -- it depends on the Earth's actual, slightly irregular rotation
 * -- so outside that range the year is clamped to the nearest end rather than
 * extrapolating the polynomial into territory it was never fit to.
 */
export function deltaT(jd: number): number {
  const year = 2000 + (jd - J2000) / 365.25;
  const t = Math.max(2005, Math.min(2050, year)) - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/**
 * Terrestrial Time Julian Date, for feeding to the Moon and planet theories.
 *
 * Sidereal time stays on the plain (UT-based) Julian Date from
 * {@link julianDate} -- it is an Earth-rotation-angle quantity, not an
 * ephemeris one, and applying Delta-T there would be the wrong correction in
 * the wrong place.
 */
export function terrestrialJulianDate(jd: number): number {
  return jd + deltaT(jd) / 86400;
}
