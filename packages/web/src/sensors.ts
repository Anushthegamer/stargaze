/**
 * Sensors, and what to do when they are not there.
 *
 * Three things can be missing independently -- camera, location, orientation --
 * and the app has to stay useful when any of them is. So each is requested on
 * its own and each has a fallback:
 *
 *   no camera      -> plain dark sky behind the overlay
 *   no location    -> the user enters one, or it defaults to Greenwich
 *   no orientation -> drag to look around, which is how a desktop uses it anyway
 *
 * The drag fallback is not a consolation prize. It is the mode this was
 * developed in, and the only way to check the sky against a planetarium on a
 * machine with no magnetometer.
 */

import { isNative, nativePosition, requestNativeCamera, requestNativeLocation } from './native.js';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface OrientationSample {
  alpha: number;
  beta: number;
  gamma: number;
  screenAngle: number;
  /** True when the reading is referenced to compass north rather than an
   *  arbitrary starting direction. Without it the heading is meaningless. */
  absolute: boolean;
}

/* ------------------------------------------------------------------ *
 * Location
 * ------------------------------------------------------------------ */

export interface Position {
  latitude: number;
  longitude: number;
  elevation: number;
  /** Metres of horizontal uncertainty, or null if unknown. */
  accuracy: number | null;
}

/** Greenwich: an honest default, and the one every almanac is written for. */
export const DEFAULT_POSITION: Position = {
  latitude: 51.4779,
  longitude: 0,
  elevation: 0,
  accuracy: null,
};

export async function requestPosition(): Promise<Position | null> {
  // On Android the runtime permission has to be granted before the API will
  // answer, and the plugin path fails fast where the WebView's own can hang.
  if (isNative()) {
    if ((await requestNativeLocation()) === 'denied') return null;
    const fromPlugin = await nativePosition();
    if (fromPlugin) return fromPlugin;
  }

  if (!('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (result) =>
        resolve({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          elevation: result.coords.altitude ?? 0,
          accuracy: result.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  });
}

/* ------------------------------------------------------------------ *
 * Orientation
 * ------------------------------------------------------------------ */

type OrientationListener = (sample: OrientationSample) => void;

interface IosDeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export class OrientationSource {
  private listener: OrientationListener | null = null;
  private handler: ((event: DeviceOrientationEvent) => void) | null = null;
  private eventName: 'deviceorientationabsolute' | 'deviceorientation' = 'deviceorientation';

  /** Set once a reading has actually arrived, not merely been permitted. */
  receiving = false;

  /** False when readings are relative to wherever the phone happened to start. */
  absolute = false;

  static get supported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /**
   * Ask for permission and start listening.
   *
   * iOS requires this to be called from inside a user gesture, which is why the
   * permission gate is one deliberate button rather than something that runs on
   * load.
   */
  async start(listener: OrientationListener): Promise<PermissionState> {
    if (!OrientationSource.supported) return 'unsupported';

    const constructor = window.DeviceOrientationEvent as unknown as IosDeviceOrientationEvent;
    if (typeof constructor?.requestPermission === 'function') {
      try {
        const outcome = await constructor.requestPermission();
        if (outcome !== 'granted') return 'denied';
      } catch {
        // Thrown when not called from a gesture. Treat as a refusal rather than
        // silently carrying on with a heading that will never arrive.
        return 'denied';
      }
    }

    this.listener = listener;
    // `deviceorientationabsolute` is the one referenced to true compass north.
    // Chrome on Android fires it; Safari does not, and reports the same thing
    // through `webkitCompassHeading` on the plain event instead.
    this.eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

    this.handler = (event) => this.onEvent(event);
    window.addEventListener(this.eventName, this.handler as EventListener, true);

    // A permission grant is not a reading. If nothing arrives, the caller needs
    // to know so it can fall back to drag rather than showing a frozen sky.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return this.receiving ? 'granted' : 'denied';
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener(this.eventName, this.handler as EventListener, true);
      this.handler = null;
    }
    this.listener = null;
    this.receiving = false;
  }

  private onEvent(event: DeviceOrientationEvent): void {
    const webkitHeading = (event as unknown as { webkitCompassHeading?: number })
      .webkitCompassHeading;

    let alpha: number | null;
    if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
      // Safari reports a compass BEARING (clockwise from north) where alpha is
      // a counter-clockwise rotation. They run in opposite directions.
      alpha = 360 - webkitHeading;
      this.absolute = true;
    } else {
      alpha = event.alpha;
      this.absolute = event.absolute === true || this.eventName === 'deviceorientationabsolute';
    }

    if (alpha === null || event.beta === null || event.gamma === null) return;

    this.receiving = true;
    this.listener?.({
      alpha,
      beta: event.beta,
      gamma: event.gamma,
      screenAngle: screenAngle(),
      absolute: this.absolute,
    });
  }
}

/** How far the UI is rotated from the device's natural orientation. */
export function screenAngle(): number {
  const orientation = screen.orientation as ScreenOrientation | undefined;
  if (orientation && typeof orientation.angle === 'number') return orientation.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/* ------------------------------------------------------------------ *
 * Camera
 * ------------------------------------------------------------------ */

export interface CameraResult {
  stream: MediaStream | null;
  state: PermissionState;
  /**
   * Horizontal field of view in degrees, if the browser will say. Almost none
   * will, so this is usually null and the user calibrates it by hand.
   */
  fov: number | null;
}

export async function requestCamera(): Promise<CameraResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, state: 'unsupported', fov: null };
  }

  // Android grants camera access to the app, not to the page. Without this,
  // getUserMedia rejects with no prompt having ever appeared.
  if (isNative() && (await requestNativeCamera()) === 'denied') {
    return { stream: null, state: 'denied', fov: null };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    return { stream, state: 'granted', fov: fovFromTrack(stream) };
  } catch (error) {
    const denied = error instanceof DOMException && error.name === 'NotAllowedError';
    return { stream: null, state: denied ? 'denied' : 'unsupported', fov: null };
  }
}

/**
 * Recover the camera's field of view from the track, where the browser exposes
 * it. Chrome on Android sometimes reports focal length and sensor size; almost
 * nothing else does, so treat a null here as normal rather than a fault.
 */
function fovFromTrack(stream: MediaStream): number | null {
  const track = stream.getVideoTracks()[0];
  if (!track) return null;

  const settings = track.getSettings() as MediaTrackSettings & {
    focalLengthX?: number;
    width?: number;
  };

  if (
    typeof settings.focalLengthX === 'number' &&
    settings.focalLengthX > 0 &&
    typeof settings.width === 'number'
  ) {
    const halfWidth = settings.width / 2;
    return (2 * Math.atan(halfWidth / settings.focalLengthX) * 180) / Math.PI;
  }

  return null;
}

/** Whether the page is in a context where sensors are allowed at all. */
export function isSecureContextForSensors(): boolean {
  // Camera, geolocation and motion all require a secure context. On a LAN this
  // is the thing that quietly breaks: http://192.168.x.x fails with no error
  // that points at the cause.
  //
  // Inside Capacitor the WebView serves from https://localhost, so this is
  // always satisfied -- which is one of the better reasons to ship the wrapper.
  return window.isSecureContext;
}
