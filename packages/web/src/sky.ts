/**
 * The sky at one moment, for one observer.
 *
 * This is the slow half of the loop. Recomputing it costs about a millisecond
 * for a thousand stars, and the sky moves a quarter of a degree in that same
 * minute, so it runs on a timer rather than per frame.
 */

import {
  applyRefraction,
  apparentTerms,
  applyApparentPlace,
  applyDiurnalParallax,
  combineAngles,
  countBrighterThan,
  createHorizontalBuffer,
  equatorialToHorizontal,
  julianDate,
  localSiderealTime,
  magneticDeclination,
  moonPosition,
  planetPosition,
  precessCatalog,
  precessFromJ2000,
  riseTransitSet,
  RISE_SET_ALTITUDE,
  sunPosition,
  terrestrialJulianDate,
  toHorizontal,
  VISIBLE_PLANETS,
  type HorizontalBuffer,
  type PrecessedCatalog,
  type StarCatalog,
} from '@stargaze/core';

import type { SkyData } from './data.js';
import type { Position } from './sensors.js';
import { starLabel } from './data.js';

export type ObjectKind = 'planet' | 'moon' | 'sun' | 'star';

export interface SkyObject {
  name: string;
  kind: ObjectKind;
  /** Right ascension of date, degrees. Needed for rise/transit/set. */
  ra: number;
  /** Declination of date, degrees. */
  dec: number;
  altitude: number;
  azimuth: number;
  magnitude: number;
  /** Degrees across. Zero for anything that is a point source in practice. */
  angularDiameter: number;
  /** Distance, in the unit named by `distanceUnit`. */
  distance: number;
  distanceUnit: 'au' | 'km';
  illumination?: number;
  phase?: number;
}

export interface SkyFrame {
  when: Date;
  /** Altitude of the Sun, degrees. Negative means night. */
  sunAltitude: number;
  jd: number;
  lst: number;
  observer: Position;
  /** Degrees east; add to a magnetic bearing for a true one. */
  declination: number;
  declinationReliable: boolean;

  catalog: StarCatalog;
  stars: HorizontalBuffer;
  /** How many stars were transformed -- the rest are below the cutoff. */
  starCount: number;

  objects: SkyObject[];

  /** Resolve the index encoding used by the renderer's hit-testing. */
  positionOf(index: number): { altitude: number; azimuth: number } | null;
}

/**
 * Holds the derived state that only changes when the date or the observer does,
 * so a frame update is a transform rather than a rebuild.
 */
export class SkyModel {
  private precessed: PrecessedCatalog;
  private buffer: HorizontalBuffer;
  private precessedFor: number;

  constructor(private readonly data: SkyData) {
    this.precessed = precessCatalog(data.stars, julianDate(new Date()));
    this.precessedFor = this.precessed.jd;
    this.buffer = createHorizontalBuffer(data.stars.count);
  }

  compute(
    when: Date,
    observer: Position,
    magnitudeLimit: number,
    refract: boolean = true,
  ): SkyFrame {
    const jd = julianDate(when);
    const lst = localSiderealTime(jd, observer.longitude);

    // Precession moves stars by well under an arcsecond a day. Redoing it once
    // a month is already far more often than it can matter.
    if (Math.abs(jd - this.precessedFor) > 30) {
      this.precessed = precessCatalog(this.data.stars, jd);
      this.precessedFor = jd;
    }

    const starCount = countBrighterThan(this.data.stars, magnitudeLimit);
    toHorizontal(this.precessed, lst, observer.latitude, this.buffer, starCount, refract);

    const declination = magneticDeclination(
      this.data.declination,
      observer.latitude,
      observer.longitude,
      when,
    );

    const objects = this.computeObjects(jd, lst, observer, refract);

    const buffer = this.buffer;
    return {
      when,
      sunAltitude: objects.find((object) => object.kind === 'sun')?.altitude ?? -90,
      jd,
      lst,
      observer,
      declination: declination.degrees,
      declinationReliable: declination.reliable,
      catalog: this.data.stars,
      stars: buffer,
      starCount,
      objects,
      positionOf(index: number) {
        if (index < 0) {
          const object = objects[-1 - index];
          return object ? { altitude: object.altitude, azimuth: object.azimuth } : null;
        }
        if (index >= starCount) return null;
        return {
          altitude: buffer.altitude[index] as number,
          azimuth: buffer.azimuth[index] as number,
        };
      },
    };
  }

  private computeObjects(
    jd: number,
    lst: number,
    observer: Position,
    refract: boolean,
  ): SkyObject[] {
    const objects: SkyObject[] = [];

    // The Moon and planet theories are functions of Terrestrial Time; the
    // clock only gives UT. Sidereal time (lst) stays on the plain jd -- see
    // terrestrialJulianDate's doc comment.
    const ttJd = terrestrialJulianDate(jd);

    // Nutation and aberration's shared per-instant terms, computed once and
    // reused for the Moon, Sun and every planet below.
    const terms = apparentTerms(ttJd);

    // The Moon first: it is the brightest thing after the Sun and the one worth
    // aiming at to check the overlay is aligned. moonPosition already returns
    // the apparent place (nutation and aberration included) -- see moon.ts.
    const moon = moonPosition(ttJd, observer, lst);
    let moonHorizontal = equatorialToHorizontal(moon.ra, moon.dec, lst, observer.latitude);
    if (refract) moonHorizontal = applyRefraction(moonHorizontal);
    objects.push({
      name: 'Moon',
      kind: 'moon',
      ra: moon.ra,
      dec: moon.dec,
      altitude: moonHorizontal.altitude,
      azimuth: moonHorizontal.azimuth,
      // Brightness swings with phase; a new moon is not magnitude -12.7.
      magnitude: -12.7 + 5 * Math.log10(Math.max(0.02, moon.illumination)) * 0.4,
      angularDiameter: moon.angularDiameter,
      distance: moon.distance,
      distanceUnit: 'km',
      illumination: moon.illumination,
      phase: moon.phase,
    });

    const sun = sunPosition(this.data.planets, ttJd);
    // The Sun's catalogue position is J2000; the stars are precessed to date,
    // so this has to be too or the two disagree by a third of a degree.
    const sunOfDate = precessFromJ2000(sun.ra, sun.dec, jd);
    const sunApparent = applyApparentPlace(sunOfDate.ra, sunOfDate.dec, terms);
    let sunHorizontal = equatorialToHorizontal(
      sunApparent.ra,
      sunApparent.dec,
      lst,
      observer.latitude,
    );
    sunHorizontal = applyDiurnalParallax(sunHorizontal, sun.distance);
    if (refract) sunHorizontal = applyRefraction(sunHorizontal);
    objects.push({
      name: 'Sun',
      kind: 'sun',
      ra: sunApparent.ra,
      dec: sunApparent.dec,
      altitude: sunHorizontal.altitude,
      azimuth: sunHorizontal.azimuth,
      magnitude: sun.magnitude,
      angularDiameter: 0.533,
      distance: sun.distance,
      distanceUnit: 'au',
    });

    for (const name of VISIBLE_PLANETS) {
      const planet = planetPosition(this.data.planets, name, ttJd);
      const ofDate = precessFromJ2000(planet.ra, planet.dec, jd);
      const apparent = applyApparentPlace(ofDate.ra, ofDate.dec, terms);
      let horizontal = equatorialToHorizontal(apparent.ra, apparent.dec, lst, observer.latitude);
      horizontal = applyDiurnalParallax(horizontal, planet.distance);
      if (refract) horizontal = applyRefraction(horizontal);

      objects.push({
        name,
        kind: 'planet',
        ra: apparent.ra,
        dec: apparent.dec,
        altitude: horizontal.altitude,
        azimuth: horizontal.azimuth,
        magnitude: planet.magnitude,
        angularDiameter: 0,
        distance: planet.distance,
        distanceUnit: 'au',
      });
    }

    return objects;
  }
}

export interface TonightEntry {
  label: string;
  detail: string;
  magnitude: number;
  altitude: number;
  azimuth: number;
  /** The renderer's index encoding, so tapping a row can select it. */
  index: number;
  kind: ObjectKind;
}

/**
 * What is visible right now, brightest first.
 *
 * The Sun is excluded when it is up: "what can I see tonight" has an obvious
 * answer during the day and it is not a list.
 */
export function tonight(frame: SkyFrame, data: SkyData, limit = 30): TonightEntry[] {
  const entries: TonightEntry[] = [];

  frame.objects.forEach((object, index) => {
    if (object.altitude <= 0) return;
    if (object.kind === 'sun') return;

    entries.push({
      label: object.name,
      detail:
        object.kind === 'moon'
          ? `${Math.round((object.illumination ?? 0) * 100)}% lit`
          : 'Planet',
      magnitude: object.magnitude,
      altitude: object.altitude,
      azimuth: object.azimuth,
      index: -1 - index,
      kind: object.kind,
    });
  });

  // Named stars only: a list of 400 catalogue numbers helps nobody.
  for (let i = 0; i < frame.starCount; i += 1) {
    if (!(frame.stars.visible[i] as number)) continue;

    const hip = frame.catalog.hip[i] as number;
    const name = data.names.get(hip);
    if (!name?.proper) continue;

    entries.push({
      label: name.proper,
      detail: name.constellation ? `Star · ${name.constellation}` : 'Star',
      magnitude: frame.catalog.mag[i] as number,
      altitude: frame.stars.altitude[i] as number,
      azimuth: frame.stars.azimuth[i] as number,
      index: i,
      kind: 'star',
    });
  }

  entries.sort((a, b) => a.magnitude - b.magnitude);
  return entries.slice(0, limit);
}

/**
 * A line explaining what the list is showing.
 *
 * Everything in it is genuinely above the horizon, but in daylight almost none
 * of it can be seen. Saying so is more honest than filtering the list and
 * leaving the user to wonder where everything went.
 */
export function skyCaption(frame: SkyFrame, count: number): string {
  const visible = `${count} above the horizon`;
  if (frame.sunAltitude > 0) return `${visible} · daylight, so almost none are visible`;
  if (frame.sunAltitude > -6) return `${visible} · twilight, only the brightest will show`;
  if (frame.sunAltitude > -18) return `${visible} · the sky is not fully dark yet`;
  return `${visible} · dark sky`;
}

export interface ObjectDetail {
  title: string;
  subtitle: string;
  chips: string[];
  stats: [string, string][];
  footer: string;
}

/** Everything the info card shows about whatever is selected. */
export function describe(index: number, frame: SkyFrame, data: SkyData): ObjectDetail | null {
  const degrees = (value: number): string => `${value.toFixed(1)}°`;
  const clock = (date: Date | null): string =>
    date
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      : '—';

  if (index < 0) {
    const object = frame.objects[-1 - index];
    if (!object) return null;

    const events = riseTransitSet(
      object.ra,
      object.dec,
      frame.observer,
      frame.when,
      object.kind === 'moon'
        ? RISE_SET_ALTITUDE.moon
        : object.kind === 'sun'
          ? RISE_SET_ALTITUDE.sun
          : RISE_SET_ALTITUDE.star,
    );

    return {
      title: object.name,
      subtitle:
        object.kind === 'moon'
          ? `${Math.round((object.illumination ?? 0) * 100)}% illuminated`
          : object.kind === 'sun'
            ? 'The Sun'
            : 'Planet',
      chips: [
        object.kind === 'moon' ? 'Satellite' : object.kind === 'sun' ? 'Star' : 'Planet',
        object.altitude > 0 ? 'Above horizon' : 'Below horizon',
      ],
      stats: [
        ['Magnitude', object.magnitude.toFixed(1)],
        ['Altitude', degrees(object.altitude)],
        ['Azimuth', degrees(object.azimuth)],
        [
          'Distance',
          object.distanceUnit === 'km'
            ? `${Math.round(object.distance).toLocaleString()} km`
            : `${object.distance.toFixed(2)} au`,
        ],
        [
          'Apparent size',
          object.angularDiameter > 0 ? `${(object.angularDiameter * 60).toFixed(1)}'` : '—',
        ],
        ['Sets', events.circumpolar ? 'never' : clock(events.set)],
      ],
      footer:
        object.kind === 'moon'
          ? 'The easiest target for checking the overlay is lined up.'
          : 'Position computed on this device from orbital elements.',
    };
  }

  if (index >= frame.starCount) return null;

  const hip = frame.catalog.hip[index] as number;
  const name = data.names.get(hip);
  const magnitude = frame.catalog.mag[index] as number;
  const altitude = frame.stars.altitude[index] as number;
  const azimuth = frame.stars.azimuth[index] as number;

  const events = riseTransitSet(
    frame.catalog.ra[index] as number,
    frame.catalog.dec[index] as number,
    frame.observer,
    frame.when,
  );

  const chips: string[] = [];
  if (name?.bayer && name.constellation) chips.push(`${name.bayer} ${name.constellation}`);
  if (events.circumpolar) chips.push('Never sets');
  else if (events.neverRises) chips.push('Never rises here');

  return {
    title: starLabel(hip, data.names),
    subtitle: name?.constellation ? constellationName(name.constellation, data) : `HIP ${hip}`,
    chips,
    stats: [
      ['Magnitude', magnitude.toFixed(2)],
      ['Altitude', degrees(altitude)],
      ['Azimuth', degrees(azimuth)],
      ['Distance', name?.lightYears ? `${Math.round(name.lightYears)} ly` : '—'],
      ['Rises', events.circumpolar ? 'always up' : clock(events.rise)],
      ['Sets', events.circumpolar ? 'never' : clock(events.set)],
    ],
    footer: `HIP ${hip} · position precessed to today`,
  };
}

function constellationName(abbr: string, data: SkyData): string {
  const found = data.figures.byName.find((c) => c.abbr === abbr);
  if (!found) return abbr;
  return found.common ? `${found.name} · the ${found.common}` : found.name;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

/**
 * Find objects by name.
 *
 * Returns the same shape as {@link tonight} so both lists share one renderer
 * and one selection path.
 *
 * Three kinds of thing match:
 *
 *   - the Moon, the Sun and the five planets, by name
 *   - stars with a proper name, or a Bayer/Flamsteed designation
 *   - constellations, which resolve to their brightest visible member, because
 *     "where is Orion" is answered by pointing at Betelgeuse, not at a centroid
 *     in empty sky
 *
 * Below-the-horizon matches are kept and marked. Hiding them answers "where is
 * Jupiter" with silence, when the useful answer is "under your feet right now".
 */
export function search(
  query: string,
  frame: SkyFrame,
  data: SkyData,
  limit = 24,
): TonightEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];

  interface Scored {
    entry: TonightEntry;
    score: number;
  }
  const found: Scored[] = [];

  // Prefix matches beat substring matches, and short names beat long ones, so
  // "mar" finds Mars before Markab.
  const rank = (haystack: string): number => {
    const hay = haystack.toLowerCase();
    if (hay === needle) return 0;
    if (hay.startsWith(needle)) return 1 + hay.length / 100;
    if (hay.includes(needle)) return 3 + hay.length / 100;
    return Number.POSITIVE_INFINITY;
  };

  const horizonNote = (altitude: number, base: string): string =>
    altitude > 0 ? base : `${base} · below the horizon`;

  frame.objects.forEach((object, index) => {
    const score = rank(object.name);
    if (!Number.isFinite(score)) return;
    found.push({
      score,
      entry: {
        label: object.name,
        detail: horizonNote(
          object.altitude,
          object.kind === 'moon' ? 'Moon' : object.kind === 'sun' ? 'Sun' : 'Planet',
        ),
        magnitude: object.magnitude,
        altitude: object.altitude,
        azimuth: object.azimuth,
        index: -1 - index,
        kind: object.kind,
      },
    });
  });

  for (let i = 0; i < frame.starCount; i += 1) {
    const hip = frame.catalog.hip[i] as number;
    const name = data.names.get(hip);
    if (!name) continue;

    const candidates = [
      name.proper,
      name.bayer && name.constellation ? `${name.bayer} ${name.constellation}` : undefined,
      name.flamsteed && name.constellation ? `${name.flamsteed} ${name.constellation}` : undefined,
    ].filter((value): value is string => Boolean(value));

    let best = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) best = Math.min(best, rank(candidate));
    if (!Number.isFinite(best)) continue;

    found.push({
      score: best,
      entry: {
        label: starLabel(hip, data.names),
        detail: horizonNote(
          frame.stars.altitude[i] as number,
          name.constellation ? `Star · ${name.constellation}` : 'Star',
        ),
        magnitude: frame.catalog.mag[i] as number,
        altitude: frame.stars.altitude[i] as number,
        azimuth: frame.stars.azimuth[i] as number,
        index: i,
        kind: 'star',
      },
    });
  }

  // Constellations resolve to their brightest member.
  for (const constellation of data.figures.byName) {
    const score = Math.min(
      rank(constellation.name),
      constellation.common ? rank(constellation.common) : Number.POSITIVE_INFINITY,
      rank(constellation.abbr),
    );
    if (!Number.isFinite(score)) continue;

    let brightest = -1;
    for (let s = constellation.start; s < constellation.end; s += 1) {
      for (const vertex of [
        data.figures.segments[s * 2] as number,
        data.figures.segments[s * 2 + 1] as number,
      ]) {
        if (vertex >= frame.starCount) continue;
        if (brightest === -1 || (frame.catalog.mag[vertex] as number) < (frame.catalog.mag[brightest] as number)) {
          brightest = vertex;
        }
      }
    }
    if (brightest === -1) continue;

    found.push({
      // Slightly behind an equally-good star match: someone typing a star name
      // wants the star.
      score: score + 0.5,
      entry: {
        label: constellation.name,
        detail: horizonNote(
          frame.stars.altitude[brightest] as number,
          constellation.common ? `Constellation · the ${constellation.common}` : 'Constellation',
        ),
        magnitude: frame.catalog.mag[brightest] as number,
        altitude: frame.stars.altitude[brightest] as number,
        azimuth: frame.stars.azimuth[brightest] as number,
        index: brightest,
        kind: 'star',
      },
    });
  }

  found.sort((a, b) => a.score - b.score || a.entry.magnitude - b.entry.magnitude);

  // One entry per object: a star can match on both its proper name and its
  // Bayer designation.
  const seen = new Set<number>();
  const results: TonightEntry[] = [];
  for (const { entry } of found) {
    if (seen.has(entry.index)) continue;
    seen.add(entry.index);
    results.push(entry);
    if (results.length >= limit) break;
  }

  return results;
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

/** Objects bright enough to aim at unambiguously, for compass calibration. */
export function calibrationTargets(frame: SkyFrame, data: SkyData, limit = 8): TonightEntry[] {
  return tonight(frame, data, 60)
    .filter((entry) => entry.altitude > 12 && entry.altitude < 78 && entry.magnitude < 2)
    .slice(0, limit);
}

export interface CalibrationResult {
  /** Degrees to add to the sensor heading. */
  offset: number;
  /** The heading the sensors reported. */
  reported: number;
  /** The heading the object is actually at. */
  actual: number;
}

/**
 * Work out the compass error from one sighting.
 *
 * The user aims the crosshair at an object they can see and confirms. Whatever
 * the sensors claim the heading is, the object's true azimuth is known exactly,
 * so the difference is the magnetometer's error -- local iron, a phone case, a
 * miscalibrated sensor, all of it at once.
 *
 * Only azimuth is corrected. Altitude comes from the accelerometer measuring
 * gravity, which is accurate and cannot be thrown off by a nearby speaker.
 */
export function calibrate(reportedAzimuth: number, target: TonightEntry): CalibrationResult {
  const difference = ((target.azimuth - reportedAzimuth + 540) % 360) - 180;
  return { offset: difference, reported: reportedAzimuth, actual: target.azimuth };
}

export interface CombinedCalibration {
  /** Degrees to add to the sensor heading -- the circular mean of the kept sightings. */
  offset: number;
  /** How many sightings went into the average. */
  count: number;
  /** How many were thrown out as outliers, more than 90 degrees from the rest. */
  discarded: number;
}

/**
 * Combine several single-sighting offsets into one, more robust than trusting
 * any single sighting to noise -- a hand not quite steady, a target picked
 * just as a cloud passed over it. See {@link combineAngles} for the maths;
 * this just renames its fields to the calibration domain.
 */
export function combineCalibrations(offsets: number[]): CombinedCalibration {
  const combined = combineAngles(offsets);
  return { offset: combined.mean, count: combined.count, discarded: combined.discarded };
}
