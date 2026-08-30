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

/** Julian centuries elapsed since J2000.0. */
export function julianCenturies(jd: number): number {
  return (jd - J2000) / DAYS_PER_CENTURY;
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
