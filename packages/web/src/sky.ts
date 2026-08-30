/**
 * The sky at one moment, for one observer.
 *
 * This is the slow half of the loop. Recomputing it costs about a millisecond
 * for a thousand stars, and the sky moves a quarter of a degree in that same
 * minute, so it runs on a timer rather than per frame.
 */

import {
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

  compute(when: Date, observer: Position, magnitudeLimit: number): SkyFrame {
    const jd = julianDate(when);
    const lst = localSiderealTime(jd, observer.longitude);

    // Precession moves stars by well under an arcsecond a day. Redoing it once
    // a month is already far more often than it can matter.
    if (Math.abs(jd - this.precessedFor) > 30) {
      this.precessed = precessCatalog(this.data.stars, jd);
      this.precessedFor = jd;
    }

    const starCount = countBrighterThan(this.data.stars, magnitudeLimit);
    toHorizontal(this.precessed, lst, observer.latitude, this.buffer, starCount);

    const declination = magneticDeclination(
      this.data.declination,
      observer.latitude,
      observer.longitude,
      when,
    );

    const objects = this.computeObjects(jd, lst, observer);

    const buffer = this.buffer;
    return {
      when,
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

  private computeObjects(jd: number, lst: number, observer: Position): SkyObject[] {
    const objects: SkyObject[] = [];

    // The Moon first: it is the brightest thing after the Sun and the one worth
    // aiming at to check the overlay is aligned.
    const moon = moonPosition(jd, observer, lst);
    const moonHorizontal = equatorialToHorizontal(moon.ra, moon.dec, lst, observer.latitude);
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

    const sun = sunPosition(this.data.planets, jd);
    // The Sun's catalogue position is J2000; the stars are precessed to date,
    // so this has to be too or the two disagree by a third of a degree.
    const sunOfDate = precessFromJ2000(sun.ra, sun.dec, jd);
    const sunHorizontal = equatorialToHorizontal(
      sunOfDate.ra,
      sunOfDate.dec,
      lst,
      observer.latitude,
    );
    objects.push({
      name: 'Sun',
      kind: 'sun',
      ra: sunOfDate.ra,
      dec: sunOfDate.dec,
      altitude: sunHorizontal.altitude,
      azimuth: sunHorizontal.azimuth,
      magnitude: sun.magnitude,
      angularDiameter: 0.533,
      distance: sun.distance,
      distanceUnit: 'au',
    });

    for (const name of VISIBLE_PLANETS) {
      const planet = planetPosition(this.data.planets, name, jd);
      const ofDate = precessFromJ2000(planet.ra, planet.dec, jd);
      const horizontal = equatorialToHorizontal(ofDate.ra, ofDate.dec, lst, observer.latitude);

      objects.push({
        name,
        kind: 'planet',
        ra: ofDate.ra,
        dec: ofDate.dec,
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
