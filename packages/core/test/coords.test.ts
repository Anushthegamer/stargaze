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
  applyDiurnalParallax,
  diurnalParallax,
  equatorialToHorizontal,
  horizontalToEquatorial,
  precessFromJ2000,
  refraction,
  riseTransitSet,
} from '../src/coords.js';
import {
  deltaT,
  greenwichMeanSiderealTime,
  julianDate,
  localSiderealTime,
  terrestrialJulianDate,
  J2000,
} from '../src/time.js';
import { moonPosition } from '../src/moon.js';
import { apparentTerms, applyApparentPlace } from '../src/apparent.js';

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

describe('Delta-T', () => {
  it('sits in the range published for the current era', () => {
    // IERS bulletins put TT-UT around 69 seconds through the mid-2020s.
    const jd = julianDate(new Date('2025-06-01T00:00:00Z'));
    expect(deltaT(jd)).toBeGreaterThan(60);
    expect(deltaT(jd)).toBeLessThan(90);
  });

  it('advances the Julian Date by a fraction of a day, not a whole one', () => {
    const jd = julianDate(new Date('2026-01-01T00:00:00Z'));
    const tt = terrestrialJulianDate(jd);
    expect(tt).toBeGreaterThan(jd);
    expect(tt - jd).toBeLessThan(1 / 1000); // well under a day; it's ~70 seconds
  });

  it('holds the polynomial steady outside its fitted range rather than extrapolating', () => {
    const early = julianDate(new Date('1990-01-01T00:00:00Z'));
    const stillEarly = julianDate(new Date('1995-01-01T00:00:00Z'));
    // Both clamp to the 2005 endpoint, so they read the same.
    expect(deltaT(early)).toBeCloseTo(deltaT(stillEarly), 6);

    const late = julianDate(new Date('2090-01-01T00:00:00Z'));
    const laterStill = julianDate(new Date('2099-01-01T00:00:00Z'));
    expect(deltaT(late)).toBeCloseTo(deltaT(laterStill), 6);
  });

  it('measurably moves the Moon, in the direction time moving forward implies', () => {
    // The Moon runs about 0.55"/s of time; 69s of Delta-T should shift it by
    // roughly 30-45 arcseconds -- not zero, and not degrees.
    const jd = julianDate(new Date('2026-01-08T19:45:00Z'));
    const withoutDeltaT = moonPosition(jd);
    const withDeltaT = moonPosition(terrestrialJulianDate(jd));

    const shiftDeg = Math.hypot(
      (withDeltaT.ra - withoutDeltaT.ra) * Math.cos((withDeltaT.dec * Math.PI) / 180),
      withDeltaT.dec - withoutDeltaT.dec,
    );
    const shiftArcsec = shiftDeg * 3600;
    expect(shiftArcsec).toBeGreaterThan(15);
    expect(shiftArcsec).toBeLessThan(60);
  });
});

describe('nutation and aberration', () => {
  it('keeps nutation within its published bound', () => {
    // The principal term alone is at most 17.2" in longitude, 9.2" in
    // obliquity -- checked across a span longer than the ~18.6-year period
    // the argument (Omega) cycles on, so every phase gets sampled.
    for (let year = 2015; year <= 2035; year += 1) {
      const jd = julianDate(new Date(`${year}-01-01T00:00:00Z`));
      const terms = apparentTerms(jd);
      expect(Math.abs(terms.deltaPsi) * 3600).toBeLessThanOrEqual(17.2 + 1e-6);
      expect(Math.abs(terms.deltaEpsilon) * 3600).toBeLessThanOrEqual(9.2 + 1e-6);
    }
  });

  it('reaches close to its published bound somewhere in an 18.6-year cycle', () => {
    // Confirms the term is actually oscillating rather than pinned near zero.
    let maxPsi = 0;
    for (let months = 0; months < 18.6 * 12; months += 1) {
      const jd = julianDate(new Date(2020, months, 1));
      maxPsi = Math.max(maxPsi, Math.abs(apparentTerms(jd).deltaPsi) * 3600);
    }
    expect(maxPsi).toBeGreaterThan(15);
  });

  it('keeps the combined nutation+aberration shift within a safe ceiling, away from the poles', () => {
    // Worst case if nutation (17.2" + 9.2") and aberration (20.5") somehow all
    // pointed the same way would be under 47". A real unit or sign bug (radians
    // read as degrees, a dropped cosine) blows past this by orders of
    // magnitude, which is what this actually guards against -- it is not
    // trying to pin down the exact geometric maximum.
    const jd = julianDate(new Date('2026-03-20T00:00:00Z')); // near the equinox
    const terms = apparentTerms(jd);

    for (const ra of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const dec of [-60, -30, 0, 30, 60]) {
        const shifted = applyApparentPlace(ra, dec, terms);
        const shiftArcsec = angularSeparation(ra, dec, shifted.ra, shifted.dec) * 3600;
        expect(shiftArcsec).toBeLessThan(47);
        expect(shiftArcsec).toBeGreaterThan(0.01); // it did something
      }
    }
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

describe('diurnal parallax', () => {
  it('matches Venus at closest approach, the largest planetary case', () => {
    // About 0.28 au at inferior conjunction; the published figure for this
    // case is around 30".
    const arcsec = diurnalParallax(0.28, 0) * 3600;
    expect(arcsec).toBeGreaterThan(28);
    expect(arcsec).toBeLessThan(33);
  });

  it('is negligible at planetary distances beyond Venus, and at the zenith', () => {
    // Jupiter, even at its closest (~4.2 au), is a couple of arcseconds --
    // real, but an order of magnitude under Venus's worst case.
    expect(diurnalParallax(4.2, 0) * 3600).toBeLessThan(2.5);
    // Straight overhead, the observer's displacement from the Earth's centre
    // does not change the direction at all.
    expect(diurnalParallax(0.28, 90)).toBeCloseTo(0, 6);
  });

  it('always lowers the altitude, never raises it', () => {
    for (const alt of [-5, 0, 20, 45, 89]) {
      const shifted = applyDiurnalParallax({ altitude: alt, azimuth: 123 }, 0.5);
      expect(shifted.altitude).toBeLessThanOrEqual(alt);
      expect(shifted.azimuth).toBe(123);
    }
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
