/**
 * Geometry tests.
 *
 * These are deliberately the kind you can check against physical intuition
 * rather than against another program: Polaris sits at your latitude, an object
 * on your meridian at your declination is straight overhead, and the sky comes
 * back unchanged after a round trip. They catch sign flips and degree/radian
 * mix-ups, which are the bugs that actually happen here.
 */

import { describe, expect, it } from 'vitest';

import { angularSeparation, normalize180, normalize360, angularDelta } from '../src/angles.js';
import {
  equatorialToHorizontal,
  horizontalToEquatorial,
  precessFromJ2000,
  refraction,
  riseTransitSet,
} from '../src/coords.js';
import { greenwichMeanSiderealTime, julianDate, localSiderealTime, J2000 } from '../src/time.js';

// Polaris, J2000.
const POLARIS = { ra: 37.9529, dec: 89.2641 };

describe('angles', () => {
  it('wraps into the expected ranges', () => {
    expect(normalize360(-10)).toBeCloseTo(350, 10);
    expect(normalize360(730)).toBeCloseTo(10, 10);
    expect(normalize180(190)).toBeCloseTo(-170, 10);
    expect(normalize180(-190)).toBeCloseTo(170, 10);
  });

  it('takes the short way round north', () => {
    // The bug this guards: a compass at 359 turning to 1 must move +2, not -358.
    expect(angularDelta(359, 1)).toBeCloseTo(2, 10);
    expect(angularDelta(1, 359)).toBeCloseTo(-2, 10);
  });

  it('measures separation between close and distant points', () => {
    expect(angularSeparation(0, 0, 0, 1)).toBeCloseTo(1, 9);
    expect(angularSeparation(0, 0, 180, 0)).toBeCloseTo(180, 9);
    // Along the equator, one degree of RA is one degree of arc.
    expect(angularSeparation(10, 0, 11, 0)).toBeCloseTo(1, 9);
    // Near the pole it is not: RA lines converge.
    expect(angularSeparation(10, 89, 11, 89)).toBeLessThan(0.02);
  });
});

describe('sidereal time', () => {
  it('matches the defining value at J2000', () => {
    expect(greenwichMeanSiderealTime(J2000)).toBeCloseTo(280.46061837, 6);
  });

  it('puts J2000.0 at the right Julian Date', () => {
    expect(julianDate(new Date('2000-01-01T12:00:00Z'))).toBe(2451545.0);
    expect(julianDate(new Date('1970-01-01T00:00:00Z'))).toBe(2440587.5);
  });

  it('advances about 361 degrees per solar day', () => {
    // The sky gains roughly one extra degree a day on the clock: that four
    // minutes is why the constellations drift through the seasons.
    const day1 = greenwichMeanSiderealTime(J2000);
    const day2 = greenwichMeanSiderealTime(J2000 + 1);
    expect(normalize360(day2 - day1)).toBeCloseTo(0.9856, 3);
  });

  it('shifts with longitude, one hour per 15 degrees', () => {
    const jd = julianDate(new Date('2026-03-01T00:00:00Z'));
    expect(normalize360(localSiderealTime(jd, 15) - localSiderealTime(jd, 0))).toBeCloseTo(15, 9);
  });
});

describe('equatorial to horizontal', () => {
  it('holds Polaris at the observer latitude', () => {
    // Polaris sits 0.74 degrees off the true pole, so its altitude circles
    // within about that much of the latitude. This is the oldest navigation
    // check there is.
    for (const latitude of [10, 35, 51.5, 68]) {
      const jd = julianDate(new Date('2026-02-11T21:00:00Z'));
      const lst = localSiderealTime(jd, 0);
      const { altitude } = equatorialToHorizontal(POLARIS.ra, POLARIS.dec, lst, latitude);
      expect(Math.abs(altitude - latitude)).toBeLessThan(0.8);
    }
  });

  it('puts an object on the meridian at the observer declination overhead', () => {
    const latitude = 28.6;
    const lst = 123.4;
    // Same declination as the observer, and on the meridian: the zenith.
    const { altitude } = equatorialToHorizontal(lst, latitude, lst, latitude);
    expect(altitude).toBeCloseTo(90, 6);
  });

  it('places a meridian crossing due south in the north and due north in the south', () => {
    const lst = 80;
    // North of the object: it transits to the south.
    expect(equatorialToHorizontal(lst, 0, lst, 45).azimuth).toBeCloseTo(180, 6);
    // South of the object: it transits to the north.
    expect(equatorialToHorizontal(lst, 0, lst, -45).azimuth).toBeCloseTo(0, 6);
  });

  it('rises in the east and sets in the west', () => {
    const latitude = 40;
    // An equatorial object six hours (90 degrees) before transit is rising.
    const rising = equatorialToHorizontal(0, 0, -90, latitude);
    const setting = equatorialToHorizontal(0, 0, 90, latitude);
    expect(rising.azimuth).toBeCloseTo(90, 4);
    expect(setting.azimuth).toBeCloseTo(270, 4);
    expect(rising.altitude).toBeCloseTo(0, 6);
  });

  it('round-trips back to the same equatorial position', () => {
    const lst = 217.3;
    const latitude = -33.87;
    for (const ra of [0, 45, 120, 200, 300, 359]) {
      for (const dec of [-80, -20, 0, 15, 70]) {
        const horizontal = equatorialToHorizontal(ra, dec, lst, latitude);
        const back = horizontalToEquatorial(
          horizontal.altitude,
          horizontal.azimuth,
          lst,
          latitude,
        );
        expect(angularSeparation(ra, dec, back.ra, back.dec)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('precession', () => {
  it('leaves J2000 positions untouched at J2000', () => {
    const { ra, dec } = precessFromJ2000(POLARIS.ra, POLARIS.dec, J2000);
    expect(angularSeparation(ra, dec, POLARIS.ra, POLARIS.dec)).toBeLessThan(1e-9);
  });

  it('moves a star about a degree per 72 years', () => {
    const jd2100 = julianDate(new Date('2100-01-01T12:00:00Z'));
    // Betelgeuse, well away from the pole where the shift is cleanest to read.
    const moved = precessFromJ2000(88.7929, 7.4071, jd2100);
    const shift = angularSeparation(88.7929, 7.4071, moved.ra, moved.dec);
    expect(shift).toBeGreaterThan(1.0);
    expect(shift).toBeLessThan(1.6);
  });

  it('carries the pole toward its known drift', () => {
    // In 2025 the north celestial pole is still closing on Polaris.
    const jd = julianDate(new Date('2026-01-01T00:00:00Z'));
    const now = precessFromJ2000(POLARIS.ra, POLARIS.dec, jd);
    expect(now.dec).toBeGreaterThan(POLARIS.dec);
    expect(now.dec).toBeLessThan(89.4);
  });
});

describe('refraction', () => {
  it('lifts the horizon by about half a degree', () => {
    expect(refraction(0)).toBeGreaterThan(0.45);
    expect(refraction(0)).toBeLessThan(0.6);
  });

  it('falls away with altitude and vanishes at the zenith', () => {
    expect(refraction(45)).toBeLessThan(0.02);
    expect(refraction(90)).toBeLessThan(0.001);
    expect(refraction(10)).toBeGreaterThan(refraction(30));
  });
});

describe('rise, transit and set', () => {
  const observer = { latitude: 51.4779, longitude: 0 }; // Greenwich

  it('transits an object when the sidereal clock reaches its right ascension', () => {
    const when = new Date('2026-05-10T00:00:00Z');
    const { transit } = riseTransitSet(180, 20, observer, when);
    expect(transit).not.toBeNull();
    const lstAtTransit = localSiderealTime(julianDate(transit as Date), observer.longitude);
    expect(Math.abs(normalize180(lstAtTransit - 180))).toBeLessThan(0.05);
  });

  it('reports a circumpolar star as never setting', () => {
    const result = riseTransitSet(POLARIS.ra, POLARIS.dec, observer, new Date('2026-05-10T00:00:00Z'));
    expect(result.circumpolar).toBe(true);
    expect(result.rise).toBeNull();
  });

  it('reports a far southern star as never rising from London', () => {
    // The Southern Cross is permanently below the British horizon.
    const result = riseTransitSet(186.6, -63.1, observer, new Date('2026-05-10T00:00:00Z'));
    expect(result.neverRises).toBe(true);
    expect(result.set).toBeNull();
  });

  it('has an object actually on the horizon at the time it says it rises', () => {
    const result = riseTransitSet(150, 10, observer, new Date('2026-05-10T00:00:00Z'));
    expect(result.rise).not.toBeNull();
    const lst = localSiderealTime(julianDate(result.rise as Date), observer.longitude);
    const { altitude } = equatorialToHorizontal(150, 10, lst, observer.latitude);
    expect(Math.abs(altitude - -0.5667)).toBeLessThan(0.05);
  });
});
