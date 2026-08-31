/**
 * StarGaze web client.
 *
 * Two control modes, and the fallback is a first-class one:
 *
 *   sensors -- the phone knows where it is pointed
 *   manual  -- drag to look, pinch to zoom
 *
 * Manual mode is how this gets developed (desktops have no magnetometer) and
 * how it stays usable when a browser refuses motion permission, which Safari
 * does routinely. It is also how Stellarium's own web version works.
 */

import './styles.css';

import {
  basisFromDeviceOrientation,
  HeadingFilter,
  normalize360,
  type CameraBasis,
  type Viewport,
} from '@stargaze/core';

import { loadSkyData, type SkyData } from './data.js';
import {
  DEFAULT_POSITION,
  OrientationSource,
  requestCamera,
  requestPosition,
  isSecureContextForSensors,
  type PermissionState,
  type Position,
} from './sensors.js';
import { SkyRenderer, type RenderOptions } from './render.js';
import {
  calibrate,
  calibrationTargets,
  describe,
  search,
  SkyModel,
  skyCaption,
  tonight,
  type SkyFrame,
  type TonightEntry,
} from './sky.js';
import { buildShell, type Shell } from './ui.js';

/* ------------------------------------------------------------------ *
 * Settings, remembered between visits
 * ------------------------------------------------------------------ */

interface Settings {
  magnitudeLimit: number;
  fov: number;
  showConstellations: boolean;
  showLabels: boolean;
  showHorizon: boolean;
  northOffset: number;
}

const DEFAULTS: Settings = {
  magnitudeLimit: 4.5,
  fov: 66,
  showConstellations: true,
  showLabels: true,
  showHorizon: true,
  northOffset: 0,
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem('stargaze.settings');
    return stored ? { ...DEFAULTS, ...(JSON.parse(stored) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    // Private browsing, or storage disabled. Defaults are fine.
    return { ...DEFAULTS };
  }
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem('stargaze.settings', JSON.stringify(settings));
  } catch {
    /* not worth telling the user about */
  }
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

type Mode = 'sensors' | 'manual';

class StarGaze {
  private settings = loadSettings();
  private data!: SkyData;
  private model!: SkyModel;
  private renderer!: SkyRenderer;
  private shell!: Shell;

  private frame: SkyFrame | null = null;
  private viewport: Viewport = { width: 0, height: 0, horizontalFov: 66 };

  private mode: Mode = 'manual';
  private observer: Position = DEFAULT_POSITION;
  /** null means nothing is selected. See RenderOptions.selected. */
  private selected: number | null = null;

  /** Manual-mode look direction. */
  private lookAltitude = 25;
  private lookAzimuth = 180;

  private readonly orientation = new OrientationSource();
  private readonly heading = new HeadingFilter(0.18);
  private latest: { alpha: number; beta: number; gamma: number; screenAngle: number } | null = null;

  private permissions: Record<'camera' | 'location' | 'motion', PermissionState> = {
    camera: 'unknown',
    location: 'unknown',
    motion: 'unknown',
  };

  private lastSkyUpdate = 0;
  private timeOffsetMs = 0;

  /** The object being sighted during compass calibration, if any. */
  private calibrationTarget: TonightEntry | null = null;

  async start(root: HTMLElement): Promise<void> {
    this.shell = buildShell(root);
    this.renderer = new SkyRenderer(this.shell.canvas);

    this.shell.setStatus('Loading catalogue…');
    try {
      this.data = await loadSkyData();
    } catch (error) {
      this.shell.fatal(
        'Could not load the star catalogue.',
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    this.model = new SkyModel(this.data);
    this.shell.setStatus(`${this.data.stars.count.toLocaleString()} stars ready`);

    this.wireGate();
    this.wireSettings();
    this.wireCanvas();
    this.wireNav();

    window.addEventListener('resize', () => this.onResize());
    screen.orientation?.addEventListener?.('change', () => this.onResize());

    this.onResize();
    this.updateSky(true);
    requestAnimationFrame(() => this.tick());
  }

  /* ---------------------------------------------------------------- *
   * Permissions
   * ---------------------------------------------------------------- */

  private wireGate(): void {
    if (!isSecureContextForSensors()) {
      this.shell.gateWarning(
        'This page is not on a secure origin, so the camera, location and motion sensors are all blocked. ' +
          'Use https, or localhost.',
      );
    }

    this.shell.enableButton.addEventListener('click', () => void this.requestEverything());
    this.shell.skipButton.addEventListener('click', () => {
      this.permissions.motion = this.permissions.motion === 'unknown' ? 'denied' : this.permissions.motion;
      this.enterSky();
    });
  }

  private async requestEverything(): Promise<void> {
    this.shell.enableButton.disabled = true;
    this.shell.enableButton.textContent = 'Asking…';

    // Motion first, and in the same gesture: iOS only grants it from inside a
    // user gesture, and an await on anything else loses that.
    const motion = await this.orientation.start((sample) => {
      this.latest = sample;
      if (!sample.absolute) this.permissions.motion = 'granted';
    });
    this.permissions.motion = motion;
    this.shell.setPermission('motion', motion);

    const position = await requestPosition();
    if (position) {
      this.observer = position;
      this.permissions.location = 'granted';
    } else {
      this.permissions.location = 'denied';
    }
    this.shell.setPermission('location', this.permissions.location);

    const camera = await requestCamera();
    this.permissions.camera = camera.state;
    this.shell.setPermission('camera', camera.state);

    if (camera.stream) {
      this.shell.video.srcObject = camera.stream;
      await this.shell.video.play().catch(() => undefined);
      this.shell.video.style.display = 'block';
      if (camera.fov) {
        this.settings.fov = camera.fov;
        saveSettings(this.settings);
      }
    }

    this.mode = motion === 'granted' ? 'sensors' : 'manual';
    this.enterSky();
  }

  private enterSky(): void {
    this.shell.gate.remove();
    this.updateSky(true);
    this.syncModeButton();

    if (this.mode === 'manual') {
      this.shell.toast(
        this.permissions.motion === 'granted'
          ? 'Drag to look around.'
          : 'No compass available — drag to look around, pinch to zoom.',
        5200,
      );
    } else if (!this.orientation.absolute) {
      this.shell.toast(
        'Your browser is reporting orientation without a compass reference, so north is a guess. ' +
          'Use the true-north offset in settings to correct it.',
        7000,
      );
    }

    if (this.permissions.location === 'denied') {
      this.shell.toast('No location — showing the sky from Greenwich. Set yours in settings.', 6000);
    }
  }

  /* ---------------------------------------------------------------- *
   * Input
   * ---------------------------------------------------------------- */

  private wireCanvas(): void {
    const canvas = this.shell.canvas;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 1) {
        dragging = true;
        moved = 0;
        lastX = event.clientX;
        lastY = event.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        pinchDistance = this.spread(pointers);
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 2) {
        const spread = this.spread(pointers);
        if (pinchDistance > 0 && spread > 0) {
          this.setFov(this.settings.fov * (pinchDistance / spread));
          pinchDistance = spread;
        }
        return;
      }

      if (!dragging || this.mode !== 'manual') return;

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      // Drag by the same number of degrees the pixels represent, so the sky
      // tracks the finger instead of sliding at some arbitrary rate.
      const degreesPerPixel = this.settings.fov / Math.max(1, this.viewport.width);
      this.lookAzimuth = normalize360(this.lookAzimuth - dx * degreesPerPixel);
      this.lookAltitude = Math.max(-90, Math.min(90, this.lookAltitude + dy * degreesPerPixel));
    });

    const release = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (pointers.size === 0 && dragging) {
        dragging = false;
        // A tap, not a drag.
        if (moved < 8) this.onTap(event.clientX, event.clientY);
      }
    };

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.setFov(this.settings.fov * (event.deltaY > 0 ? 1.08 : 1 / 1.08));
      },
      { passive: false },
    );
  }

  private spread(pointers: Map<number, { x: number; y: number }>): number {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private setFov(value: number): void {
    this.settings.fov = Math.max(12, Math.min(110, value));
    this.viewport.horizontalFov = this.settings.fov;
    this.shell.fovInput.value = String(Math.round(this.settings.fov));
    this.shell.fovValue.textContent = `${Math.round(this.settings.fov)}°`;
    saveSettings(this.settings);
  }

  private onTap(clientX: number, clientY: number): void {
    const rect = this.shell.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const hit = this.renderer.pick(x, y);
    if (hit === null) {
      this.selected = null;
      this.shell.closeCard();
      return;
    }

    this.selected = hit;
    this.showCard();
  }

  private showCard(): void {
    if (!this.frame || this.selected === null) return;
    const detail = describe(this.selected, this.frame, this.data);
    if (detail) this.shell.openCard(detail);
  }

  /* ---------------------------------------------------------------- *
   * Chrome wiring
   * ---------------------------------------------------------------- */

  private wireNav(): void {
    this.shell.tonightButton.addEventListener('click', () => {
      if (!this.frame) return;
      const entries = tonight(this.frame, this.data);
      this.shell.openTonight(entries, skyCaption(this.frame, entries.length), (entry) =>
        this.goTo(entry),
      );
    });

    this.shell.searchButton.addEventListener('click', () => {
      this.shell.openSearch(
        (query) => (this.frame ? search(query, this.frame, this.data) : []),
        (entry) => this.goTo(entry),
      );
    });

    this.shell.settingsButton.addEventListener('click', () => this.shell.openSettings());
    this.wireCalibration();
    this.shell.modeButton.addEventListener('click', () => void this.toggleMode());
    this.shell.cardClose.addEventListener('click', () => {
      this.selected = null;
      this.shell.closeCard();
    });
  }

  /**
   * Select an object and aim at it.
   *
   * In drag mode the view turns to face it, which is the whole answer to "where
   * is Jupiter". With sensors that would fight the phone, so instead the object
   * is selected and the user swings the phone until the marker appears.
   */
  private goTo(entry: TonightEntry): void {
    this.selected = entry.index;
    this.shell.closeSheets();

    if (this.mode === 'manual') {
      this.lookAltitude = entry.altitude;
      this.lookAzimuth = entry.azimuth;
    } else {
      const turn = ((entry.azimuth - this.currentBasis().azimuth + 540) % 360) - 180;
      const direction = turn > 0 ? 'right' : 'left';
      this.shell.toast(
        entry.altitude > 0
          ? `${entry.label} is ${Math.abs(turn).toFixed(0)}° to your ${direction}, ${entry.altitude.toFixed(0)}° up.`
          : `${entry.label} is below the horizon right now.`,
        4200,
      );
    }

    this.showCard();
  }

  private wireCalibration(): void {
    const shell = this.shell;

    shell.calibrateButton.addEventListener('click', () => {
      if (!this.frame) return;
      this.calibrationTarget = null;
      shell.openCalibrate(
        calibrationTargets(this.frame, this.data),
        (entry) => {
          this.calibrationTarget = entry;
          shell.calibrateConfirm.disabled = false;
          shell.setCalibrationStatus(
            `Put the crosshair on ${entry.label} — ${entry.altitude.toFixed(0)}° up, bearing ${entry.azimuth.toFixed(0)}° — hold still, then confirm.`,
          );
        },
        this.settings.northOffset,
      );
    });

    shell.calibrateConfirm.addEventListener('click', () => {
      const target = this.calibrationTarget;
      if (!target) return;

      if (this.mode !== 'sensors') {
        // In drag mode the heading is whatever the user dragged it to, so a
        // sighting would measure nothing but their own aim.
        shell.setCalibrationStatus(
          'Calibration needs the phone’s own compass. Switch to sensor mode first.',
        );
        return;
      }

      // Measure against the raw sensor heading, with the existing correction
      // removed, or each calibration would be relative to the last one.
      const raw = this.currentBasis().azimuth - this.settings.northOffset;
      const result = calibrate(raw, target);

      this.settings.northOffset = Number(result.offset.toFixed(1));
      saveSettings(this.settings);
      shell.offsetValue.textContent = `${this.settings.northOffset > 0 ? '+' : ''}${this.settings.northOffset.toFixed(1)}°`;

      shell.setCalibrationStatus(
        `Corrected by ${result.offset > 0 ? '+' : ''}${result.offset.toFixed(1)}°. ` +
          `The compass read ${result.reported.toFixed(1)}°; ${target.label} is at ${result.actual.toFixed(1)}°.`,
      );
      shell.toast(
        `Compass corrected by ${result.offset > 0 ? '+' : ''}${result.offset.toFixed(1)}°.`,
        3600,
      );
    });

    shell.calibrateReset.addEventListener('click', () => {
      this.settings.northOffset = 0;
      this.calibrationTarget = null;
      saveSettings(this.settings);
      shell.offsetValue.textContent = '0.0°';
      shell.calibrateConfirm.disabled = true;
      shell.setCalibrationStatus('Correction cleared. Choose a target to redo it.');
    });
  }

  private async toggleMode(): Promise<void> {
    if (this.mode === 'sensors') {
      this.mode = 'manual';
      // Carry the current view across, so the sky does not jump.
      this.lookAltitude = this.currentBasis().altitude;
      this.lookAzimuth = this.currentBasis().azimuth;
      this.shell.toast('Drag to look around.', 2600);
    } else {
      const state = this.orientation.receiving
        ? 'granted'
        : await this.orientation.start((sample) => {
            this.latest = sample;
          });
      if (state !== 'granted') {
        this.shell.toast('This device is not reporting orientation.', 3200);
        return;
      }
      this.mode = 'sensors';
      this.shell.toast('Following the phone.', 2200);
    }
    this.syncModeButton();
  }

  private syncModeButton(): void {
    this.shell.modeButton.setAttribute('aria-pressed', String(this.mode === 'sensors'));
    this.shell.modeButton.querySelector('span')!.textContent =
      this.mode === 'sensors' ? 'Sensors' : 'Drag';
  }

  private wireSettings(): void {
    const s = this.shell;

    s.magInput.value = String(this.settings.magnitudeLimit);
    s.magValue.textContent = this.settings.magnitudeLimit.toFixed(1);
    s.fovInput.value = String(Math.round(this.settings.fov));
    s.fovValue.textContent = `${Math.round(this.settings.fov)}°`;
    s.offsetValue.textContent = `${this.settings.northOffset > 0 ? '+' : ''}${this.settings.northOffset.toFixed(1)}°`;

    s.magInput.addEventListener('input', () => {
      this.settings.magnitudeLimit = Number(s.magInput.value);
      s.magValue.textContent = this.settings.magnitudeLimit.toFixed(1);
      saveSettings(this.settings);
      this.updateSky(true);
    });

    s.fovInput.addEventListener('input', () => this.setFov(Number(s.fovInput.value)));

    for (const [button, key] of [
      [s.linesToggle, 'showConstellations'],
      [s.labelsToggle, 'showLabels'],
      [s.horizonToggle, 'showHorizon'],
    ] as const) {
      button.setAttribute('aria-pressed', String(this.settings[key]));
      button.addEventListener('click', () => {
        this.settings[key] = !this.settings[key];
        button.setAttribute('aria-pressed', String(this.settings[key]));
        saveSettings(this.settings);
      });
    }

    for (const [button, delta] of [
      [s.offsetMinus, -0.5],
      [s.offsetPlus, 0.5],
    ] as const) {
      button.addEventListener('click', () => {
        this.settings.northOffset = Math.max(-30, Math.min(30, this.settings.northOffset + delta));
        s.offsetValue.textContent = `${this.settings.northOffset > 0 ? '+' : ''}${this.settings.northOffset.toFixed(1)}°`;
        saveSettings(this.settings);
      });
    }

    s.locationForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const latitude = Number(s.latInput.value);
      const longitude = Number(s.lonInput.value);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        this.shell.toast('Latitude is -90 to 90, longitude -180 to 180.', 3600);
        return;
      }
      this.observer = { latitude, longitude, elevation: 0, accuracy: null };
      this.permissions.location = 'granted';
      this.updateSky(true);
      this.shell.closeSheets();
      this.shell.toast(`Observing from ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°.`, 3200);
    });

    s.useGpsButton.addEventListener('click', async () => {
      s.useGpsButton.disabled = true;
      const position = await requestPosition();
      s.useGpsButton.disabled = false;
      if (!position) {
        this.shell.toast('Location unavailable.', 3000);
        return;
      }
      this.observer = position;
      this.permissions.location = 'granted';
      s.latInput.value = position.latitude.toFixed(4);
      s.lonInput.value = position.longitude.toFixed(4);
      this.updateSky(true);
      this.shell.toast('Location updated.', 2400);
    });

    s.timeInput.addEventListener('input', () => {
      // Hours from now, so you can wind the sky forward and see what rises.
      const hours = Number(s.timeInput.value);
      this.timeOffsetMs = hours * 3600000;
      s.timeValue.textContent = hours === 0 ? 'now' : `${hours > 0 ? '+' : ''}${hours}h`;
      this.updateSky(true);
    });
  }

  /* ---------------------------------------------------------------- *
   * Loop
   * ---------------------------------------------------------------- */

  private onResize(): void {
    const viewport = this.renderer.resize();
    this.viewport = { ...viewport, horizontalFov: this.settings.fov };
  }

  private now(): Date {
    return new Date(Date.now() + this.timeOffsetMs);
  }

  private updateSky(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastSkyUpdate < 1000) return;
    this.lastSkyUpdate = now;
    this.frame = this.model.compute(this.now(), this.observer, this.settings.magnitudeLimit);
  }

  private currentBasis(): CameraBasis {
    const declination =
      (this.frame?.declinationReliable ? this.frame.declination : 0) + this.settings.northOffset;

    if (this.mode === 'sensors' && this.latest) {
      const smoothed = this.heading.push(this.latest.alpha);
      return basisFromDeviceOrientation({
        alpha: smoothed,
        beta: this.latest.beta,
        gamma: this.latest.gamma,
        screenAngle: this.latest.screenAngle,
        declination,
      });
    }

    // Manual mode: synthesise the same basis from the look direction. beta of
    // 90 is a phone held upright; adding the altitude tips it toward the sky.
    return basisFromDeviceOrientation({
      alpha: -this.lookAzimuth,
      beta: 90 + this.lookAltitude,
      gamma: 0,
      screenAngle: 0,
      declination: 0,
    });
  }

  private tick(): void {
    this.updateSky();

    if (this.frame) {
      const basis = this.currentBasis();
      const options: RenderOptions = {
        showConstellations: this.settings.showConstellations,
        showLabels: this.settings.showLabels,
        showHorizon: this.settings.showHorizon,
        magnitudeLimit: this.settings.magnitudeLimit,
        selected: this.selected,
      };

      this.renderer.draw(this.frame, this.data, basis, this.viewport, options);
      this.shell.updateHud(basis, this.frame, this.mode);
    }

    requestAnimationFrame(() => this.tick());
  }
}

/* ------------------------------------------------------------------ */

const root = document.getElementById('app');
if (root) void new StarGaze().start(root);

// Register the service worker only in a build: in dev it caches the very files
// being edited, which turns every change into a mystery.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
