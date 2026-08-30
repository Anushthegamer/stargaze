/**
 * The chrome.
 *
 * Built by hand rather than with a framework: the whole UI is one HUD, two
 * sheets and a card, and it never re-renders from state -- the sky canvas is
 * the only thing redrawing at 60fps, and it is not part of the DOM.
 */

import { normalize360, type CameraBasis } from '@stargaze/core';

import type { ObjectDetail, SkyFrame, TonightEntry } from './sky.js';
import type { PermissionState } from './sensors.js';

const svg = (paths: string, size = 22): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  tonight: svg(
    '<path d="M19.6 14.3A7.7 7.7 0 0 1 9.7 4.4a7.7 7.7 0 1 0 9.9 9.9Z"></path><path d="M17.4 3.2l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6Z"></path>',
  ),
  settings: svg(
    '<line x1="3" y1="8" x2="21" y2="8"></line><line x1="3" y1="16" x2="21" y2="16"></line><circle cx="9" cy="8" r="2.6"></circle><circle cx="16" cy="16" r="2.6"></circle>',
  ),
  compass: svg(
    '<circle cx="12" cy="12" r="8.5"></circle><path d="M15.3 8.7 13.6 13.6 8.7 15.3 10.4 10.4Z"></path>',
    20,
  ),
  camera: svg(
    '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"></path><circle cx="12" cy="13" r="3.6"></circle>',
    20,
  ),
  pin: svg(
    '<path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z"></path><circle cx="12" cy="10" r="2.5"></circle>',
    20,
  ),
  close: svg('<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>', 18),
  arrow: svg('<path d="M12 5 L12 19 M12 5 L8.4 9 M12 5 L15.6 9"></path>', 22),
};

export interface Shell {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  gate: HTMLElement;
  enableButton: HTMLButtonElement;
  skipButton: HTMLButtonElement;

  modeButton: HTMLButtonElement;
  tonightButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;

  cardClose: HTMLButtonElement;

  magInput: HTMLInputElement;
  magValue: HTMLElement;
  fovInput: HTMLInputElement;
  fovValue: HTMLElement;
  timeInput: HTMLInputElement;
  timeValue: HTMLElement;
  linesToggle: HTMLButtonElement;
  labelsToggle: HTMLButtonElement;
  horizonToggle: HTMLButtonElement;
  offsetMinus: HTMLButtonElement;
  offsetPlus: HTMLButtonElement;
  offsetValue: HTMLElement;
  locationForm: HTMLFormElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  useGpsButton: HTMLButtonElement;

  setStatus(text: string): void;
  setPermission(which: 'camera' | 'location' | 'motion', state: PermissionState): void;
  gateWarning(text: string): void;
  fatal(title: string, detail: string): void;
  toast(text: string, ms?: number): void;
  updateHud(basis: CameraBasis, frame: SkyFrame, mode: string): void;
  openCard(detail: ObjectDetail): void;
  closeCard(): void;
  openSettings(): void;
  openTonight(entries: TonightEntry[], onPick: (entry: TonightEntry) => void): void;
  closeSheets(): void;
}

const CARDINAL_LABELS: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
};

export function buildShell(root: HTMLElement): Shell {
  root.innerHTML = `
    <video id="camera" playsinline muted autoplay style="display:none"></video>
    <canvas id="sky"></canvas>

    <div class="hud">
      <div class="compass glass">
        <svg id="compass-svg" viewBox="0 0 366 60" preserveAspectRatio="none" width="100%" height="60"></svg>
      </div>
      <div class="readouts">
        <div class="pill glass"><span class="cap">Alt</span><span class="mono" id="alt">—</span></div>
        <div class="pill glass"><span class="cap">Az</span><span class="mono" id="az">—</span></div>
        <div class="pill glass" id="decl-pill"><span class="cap">Dec</span><span class="mono" id="decl">—</span></div>
      </div>
      <div class="spacer"></div>
      <div class="navbar glass">
        <button class="navbtn" id="btn-tonight" type="button">${icons.tonight}<span>Tonight</span></button>
        <button class="navbtn" id="btn-mode" type="button" aria-pressed="false">${icons.compass}<span>Drag</span></button>
        <button class="navbtn" id="btn-settings" type="button">${icons.settings}<span>Settings</span></button>
      </div>
    </div>

    <div class="toast glass" id="toast"></div>

    <div class="card glass" id="card">
      <div class="card-head">
        <div style="display:flex;flex-direction:column;gap:7px;min-width:0">
          <h1 id="card-title">—</h1>
          <div id="card-sub" class="help" style="font-size:12.5px"></div>
          <div id="card-chips" style="display:flex;gap:7px;flex-wrap:wrap"></div>
        </div>
        <button class="iconbtn" id="card-close" type="button" aria-label="Close">${icons.close}</button>
      </div>
      <div class="rule"></div>
      <div class="stats" id="card-stats"></div>
      <div style="display:flex;align-items:center;gap:9px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.09)">
        <span style="color:var(--accent);display:flex">${icons.compass}</span>
        <span class="help" id="card-footer" style="font-size:12.5px"></span>
      </div>
    </div>

    <div class="sheet glass" id="sheet-tonight">
      <div class="grabber"></div>
      <h2>Tonight</h2>
      <div class="help" id="tonight-sub" style="margin-top:6px"></div>
      <div class="sheet-body"><div class="list" id="tonight-list"></div></div>
    </div>

    <div class="sheet glass" id="sheet-settings">
      <div class="grabber"></div>
      <h2>Settings</h2>
      <div class="sheet-body">
        <span class="cap">Catalogue</span>
        <div class="field">
          <div class="field-head"><b>Magnitude cutoff</b><span id="mag-value">4.5</span></div>
          <input type="range" id="mag" min="1" max="4.5" step="0.1" />
          <span class="help">Lower this in a town. 4.5 is about what a phone manages under a dark sky.</span>
        </div>
        <div class="row"><b style="font-size:14.5px;font-weight:500">Constellation lines</b>
          <button class="switch" id="t-lines" type="button" aria-pressed="true"></button></div>
        <div class="row"><b style="font-size:14.5px;font-weight:500">Planet labels</b>
          <button class="switch" id="t-labels" type="button" aria-pressed="true"></button></div>
        <div class="row"><b style="font-size:14.5px;font-weight:500">Horizon</b>
          <button class="switch" id="t-horizon" type="button" aria-pressed="true"></button></div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)">
          <span class="cap">Alignment</span>
          <div class="field">
            <div class="field-head"><b>Camera field of view</b><span id="fov-value">66°</span></div>
            <input type="range" id="fov" min="20" max="100" step="1" />
            <span class="help">Widen or narrow until the overlay sits on the real stars.</span>
          </div>
          <div class="row">
            <div style="display:flex;flex-direction:column;gap:4px">
              <b style="font-size:14.5px;font-weight:500">True-north offset</b>
              <span class="help" id="decl-help">Magnetic declination applied automatically.</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex:0 0 auto">
              <button class="iconbtn" id="off-minus" type="button" style="border:1px solid var(--hair);font-size:19px">−</button>
              <span class="mono" id="off-value" style="min-width:62px;text-align:center;font-size:14px;color:var(--accent)">0.0°</span>
              <button class="iconbtn" id="off-plus" type="button" style="border:1px solid var(--hair);font-size:19px">+</button>
            </div>
          </div>
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)">
          <span class="cap">Observer</span>
          <form id="loc-form" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
            <div style="display:flex;gap:10px">
              <label style="flex:1;display:flex;flex-direction:column;gap:6px">
                <span class="cap">Latitude</span>
                <input class="mono" id="lat" type="number" step="0.0001" inputmode="decimal"
                  style="width:100%;height:44px;padding:0 12px;border:1px solid var(--hair);border-radius:12px;background:rgba(255,255,255,0.04);color:var(--ink);font-size:14px" />
              </label>
              <label style="flex:1;display:flex;flex-direction:column;gap:6px">
                <span class="cap">Longitude</span>
                <input class="mono" id="lon" type="number" step="0.0001" inputmode="decimal"
                  style="width:100%;height:44px;padding:0 12px;border:1px solid var(--hair);border-radius:12px;background:rgba(255,255,255,0.04);color:var(--ink);font-size:14px" />
              </label>
            </div>
            <button class="secondary" type="submit" style="margin-top:0">Use these coordinates</button>
          </form>
          <button class="secondary" id="use-gps" type="button">Use my location</button>
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)">
          <span class="cap">Time travel</span>
          <div class="field">
            <div class="field-head"><b>Offset from now</b><span id="time-value">now</span></div>
            <input type="range" id="time" min="-12" max="12" step="1" value="0" />
            <span class="help">Wind the sky forward to see what rises later.</span>
          </div>
        </div>
      </div>
    </div>

    <div class="gate" id="gate">
      <div class="wordmark">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 13.9 9.1 21 11 13.9 12.9 12 20 10.1 12.9 3 11 10.1 9.1Z" fill="var(--accent)"></path></svg>
        <span>StarGaze</span>
      </div>
      <h1>Three sensors,<br>no guesswork.</h1>
      <p class="lede">StarGaze doesn't photograph the sky — it calculates it. Where you are, what time it is, and which way you're pointing is everything it needs.</p>
      <div class="perms glass">
        <div class="perm">
          <span class="perm-icon">${icons.pin}</span>
          <span class="perm-text"><b>Location</b><span>Your latitude decides which half of the sky is above you.</span></span>
          <span class="status" id="p-location">Required</span>
        </div>
        <div class="perm">
          <span class="perm-icon">${icons.camera}</span>
          <span class="perm-text"><b>Camera</b><span>Puts the real sky behind the overlay so you can match them up.</span></span>
          <span class="status" id="p-camera">Optional</span>
        </div>
        <div class="perm">
          <span class="perm-icon">${icons.compass}</span>
          <span class="perm-text"><b>Motion &amp; compass</b><span>Tells the app which direction and angle you're aiming at.</span></span>
          <span class="status" id="p-motion">Optional</span>
        </div>
      </div>
      <div class="help" id="gate-warning" style="margin-top:16px;color:#ff9d85;display:none"></div>
      <div class="spacer" style="flex-grow:1;min-height:24px"></div>
      <button class="primary" id="btn-enable" type="button">Enable &amp; start</button>
      <button class="secondary" id="btn-skip" type="button">Skip — just show me the sky</button>
      <p class="footnote" id="status">Every position is computed on your device.<br>Nothing about where you are is sent anywhere.</p>
    </div>
  `;

  const pick = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;

  const canvas = pick<HTMLCanvasElement>('sky');
  const toastEl = pick('toast');
  const card = pick('card');
  const sheetTonight = pick('sheet-tonight');
  const sheetSettings = pick('sheet-settings');
  const compassSvg = pick<SVGSVGElement & HTMLElement>('compass-svg');

  let toastTimer = 0;

  const closeSheets = (): void => {
    sheetTonight.dataset.open = 'false';
    sheetSettings.dataset.open = 'false';
  };

  // Tapping the sky dismisses whatever is open.
  canvas.addEventListener('pointerdown', closeSheets);

  const shell: Shell = {
    canvas,
    video: pick<HTMLVideoElement>('camera'),
    gate: pick('gate'),
    enableButton: pick<HTMLButtonElement>('btn-enable'),
    skipButton: pick<HTMLButtonElement>('btn-skip'),

    modeButton: pick<HTMLButtonElement>('btn-mode'),
    tonightButton: pick<HTMLButtonElement>('btn-tonight'),
    settingsButton: pick<HTMLButtonElement>('btn-settings'),
    cardClose: pick<HTMLButtonElement>('card-close'),

    magInput: pick<HTMLInputElement>('mag'),
    magValue: pick('mag-value'),
    fovInput: pick<HTMLInputElement>('fov'),
    fovValue: pick('fov-value'),
    timeInput: pick<HTMLInputElement>('time'),
    timeValue: pick('time-value'),
    linesToggle: pick<HTMLButtonElement>('t-lines'),
    labelsToggle: pick<HTMLButtonElement>('t-labels'),
    horizonToggle: pick<HTMLButtonElement>('t-horizon'),
    offsetMinus: pick<HTMLButtonElement>('off-minus'),
    offsetPlus: pick<HTMLButtonElement>('off-plus'),
    offsetValue: pick('off-value'),
    locationForm: pick<HTMLFormElement>('loc-form'),
    latInput: pick<HTMLInputElement>('lat'),
    lonInput: pick<HTMLInputElement>('lon'),
    useGpsButton: pick<HTMLButtonElement>('use-gps'),

    setStatus(text) {
      pick('status').textContent = text;
    },

    setPermission(which, state) {
      const el = pick(`p-${which}`);
      const label =
        state === 'granted'
          ? 'Granted'
          : state === 'denied'
            ? 'Denied'
            : state === 'unsupported'
              ? 'Unavailable'
              : 'Required';
      el.textContent = label;
      el.dataset.state = state;
    },

    gateWarning(text) {
      const el = pick('gate-warning');
      el.textContent = text;
      el.style.display = 'block';
    },

    fatal(title, detail) {
      pick('gate').innerHTML = `
        <div style="margin:auto;text-align:center;max-width:320px">
          <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
          <p class="help" style="font-size:13px;line-height:1.5">${detail}</p>
          <p class="help" style="font-size:12px;margin-top:20px">Run <code>npm run data</code> to generate the catalogue.</p>
        </div>`;
    },

    toast(text, ms = 3200) {
      toastEl.textContent = text;
      toastEl.dataset.open = 'true';
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toastEl.dataset.open = 'false';
      }, ms);
    },

    updateHud(basis, frame, mode) {
      pick('alt').textContent = `${basis.altitude.toFixed(1)}°`;
      pick('az').textContent = `${basis.azimuth.toFixed(1)}°`;

      const declPill = pick('decl-pill');
      if (frame.declinationReliable) {
        pick('decl').textContent = `${frame.declination > 0 ? '+' : ''}${frame.declination.toFixed(1)}°`;
        declPill.classList.remove('warn');
      } else {
        // Say so rather than showing a zero that looks like a measurement.
        pick('decl').textContent = 'n/a';
        declPill.classList.add('warn');
      }

      drawCompass(compassSvg, basis.azimuth, mode);
    },

    openCard(detail) {
      pick('card-title').textContent = detail.title;
      pick('card-sub').textContent = detail.subtitle;
      pick('card-chips').innerHTML = detail.chips
        .map((chip) => `<span class="chip">${chip}</span>`)
        .join('');
      pick('card-stats').innerHTML = detail.stats
        .map(([label, value]) => `<div class="stat"><span class="cap">${label}</span><b>${value}</b></div>`)
        .join('');
      pick('card-footer').textContent = detail.footer;
      card.dataset.open = 'true';
      closeSheets();
    },

    closeCard() {
      card.dataset.open = 'false';
    },

    openSettings() {
      card.dataset.open = 'false';
      sheetTonight.dataset.open = 'false';
      sheetSettings.dataset.open = 'true';
    },

    openTonight(entries, onPick) {
      card.dataset.open = 'false';
      sheetSettings.dataset.open = 'false';

      pick('tonight-sub').textContent = `${entries.length} visible now`;
      const list = pick('tonight-list');

      if (entries.length === 0) {
        list.innerHTML = `<p class="empty">Nothing above the horizon.<br>Try the time slider in settings.</p>`;
      } else {
        list.innerHTML = entries
          .map(
            (entry, i) => `
          <button class="item" type="button" data-i="${i}">
            <span class="item-name">
              <b>${entry.label}</b>
              <span>${entry.detail}</span>
            </span>
            <span class="item-num">
              <b>${entry.magnitude > 0 ? '+' : ''}${entry.magnitude.toFixed(1)}</b>
              <span>alt ${entry.altitude.toFixed(0)}°</span>
            </span>
            <span class="arrow"><span class="arrow-glyph" style="transform:rotate(${entry.azimuth.toFixed(1)}deg)">${icons.arrow}</span></span>
          </button>`,
          )
          .join('');

        list.querySelectorAll<HTMLButtonElement>('.item').forEach((button) => {
          button.addEventListener('click', () => {
            const entry = entries[Number(button.dataset.i)];
            if (entry) onPick(entry);
          });
        });
      }

      sheetTonight.dataset.open = 'true';
    },

    closeSheets,
  };

  return shell;
}

/**
 * The compass strip: a ruler of bearings with the current heading under a
 * caret. 120 degrees across, so at least two cardinal points are always in
 * view and the reading has context rather than being a bare number.
 */
function drawCompass(target: SVGSVGElement, heading: number, mode: string): void {
  const span = 120;
  const width = 366;
  const perDegree = width / span;
  const start = heading - span / 2;

  const parts: string[] = [];

  for (let tick = Math.ceil(start / 5) * 5; tick <= start + span; tick += 5) {
    const x = (tick - start) * perDegree;
    if (x < 7 || x > width - 7) continue;

    const bearing = normalize360(tick);
    const major = Math.abs(bearing % 15) < 0.001 || Math.abs((bearing % 15) - 15) < 0.001;
    const cardinal = CARDINAL_LABELS[Math.round(bearing)];

    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${major ? 8 : 13}" x2="${x.toFixed(1)}" y2="20" stroke="rgba(238,242,248,${major ? 0.55 : 0.24})" stroke-width="1"/>`,
    );

    if (cardinal) {
      parts.push(
        `<text x="${x.toFixed(1)}" y="35" text-anchor="middle" font-family="'Space Grotesk',sans-serif" font-size="11.5" font-weight="600" letter-spacing="1" fill="rgba(238,242,248,0.88)">${cardinal}</text>`,
      );
    } else if (major) {
      parts.push(
        `<text x="${x.toFixed(1)}" y="34" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="9.5" fill="rgba(238,242,248,0.40)">${Math.round(bearing)}</text>`,
      );
    }
  }

  const centre = width / 2;
  parts.push(
    `<path d="M${centre},3 L${centre + 5},11 L${centre - 5},11 Z" fill="var(--accent)"/>`,
    `<line x1="${centre}" y1="11" x2="${centre}" y2="23" stroke="var(--accent)" stroke-width="1.25"/>`,
    `<text x="${centre}" y="51" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="12" font-weight="500" fill="var(--accent)">${heading.toFixed(1)}°</text>`,
  );

  if (mode === 'manual') {
    parts.push(
      `<text x="${width - 10}" y="51" text-anchor="end" font-family="'Space Grotesk',sans-serif" font-size="9.5" font-weight="600" letter-spacing="1.4" fill="rgba(238,242,248,0.32)">DRAG</text>`,
    );
  }

  target.innerHTML = parts.join('');
}
