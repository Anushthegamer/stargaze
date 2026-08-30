/**
 * Where the phone is pointed.
 *
 * Turns raw sensor output into a camera basis in the observer's world frame,
 * which is what the projection needs. Everything here is in East-North-Up
 * coordinates: +x east, +y north, +z straight up.
 *
 * Two inputs are supported, behind one interface:
 *
 *  - Browser `DeviceOrientationEvent` alpha/beta/gamma
 *  - A rotation quaternion, which is what Android's `TYPE_ROTATION_VECTOR`
 *    gives and what a native plugin would pass through
 *
 * The quaternion path exists because the Euler angles are the weaker signal:
 * they degrade near vertical (gimbal lock, exactly where you point a phone at
 * the sky) and browsers disagree about their reference frame. If the web path
 * proves too coarse, a small native plugin drops in behind the same interface.
 */

import { normalize360, toDegrees, toRadians } from './angles.js';

/** A direction in the world frame: +x east, +y north, +z up. Unit length. */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The camera's orientation in the world.
 *
 * `forward` is where the rear camera points; `right` and `up` are the screen's
 * axes mapped into the world, so the projection knows which way is up on the
 * display even when the phone is held sideways.
 */
export interface CameraBasis {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
  /** Degrees above the horizon the camera is aimed at. */
  altitude: number;
  /** Degrees clockwise from TRUE north the camera is aimed at. */
  azimuth: number;
  /** Rotation of the screen about the view axis, degrees. */
  roll: number;
}

export interface DeviceOrientation {
  /** Rotation about the vertical axis, degrees. `DeviceOrientationEvent.alpha`. */
  alpha: number;
  /** Front-to-back tilt, degrees. `DeviceOrientationEvent.beta`. */
  beta: number;
  /** Left-to-right tilt, degrees. `DeviceOrientationEvent.gamma`. */
  gamma: number;
  /** `screen.orientation.angle`: how far the UI is rotated from portrait. */
  screenAngle?: number;
  /**
   * Magnetic declination in degrees east, from {@link magneticDeclination}.
   *
   * Sensor headings are magnetic. Leaving this at zero points the sky at the
   * magnetic pole, which is the wrong pole.
   */
  declination?: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;

function normalize(v: Vector3): Vector3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Rotate a world vector about the vertical axis, for the declination fix. */
function rotateAboutUp(v: Vector3, degrees: number): Vector3 {
  if (degrees === 0) return v;
  // Azimuth runs clockwise from north while the world frame is right-handed,
  // so a positive (eastward) declination rotates vectors this way round.
  const angle = toRadians(degrees);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * v.x + s * v.y, y: -s * v.x + c * v.y, z: v.z };
}

/**
 * Camera basis from browser device-orientation angles.
 *
 * The W3C event describes an intrinsic Z-X'-Y'' rotation carrying the world
 * frame onto the device frame. The rear camera looks along the device's -Z
 * axis, which is why `forward` comes out as the negated third column of that
 * rotation.
 *
 * The camera direction does not depend on `screenAngle` -- the lens points out
 * of the back however you hold it -- but the screen axes do, which is what
 * keeps labels upright in landscape.
 */
export function basisFromDeviceOrientation(orientation: DeviceOrientation): CameraBasis {
  const alpha = toRadians(orientation.alpha);
  const beta = toRadians(orientation.beta);
  const gamma = toRadians(orientation.gamma);
  const screen = toRadians(orientation.screenAngle ?? 0);

  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const cB = Math.cos(beta);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  // R = Rz(alpha) . Rx(beta) . Ry(gamma), device axes expressed in the world.
  const deviceX: Vector3 = {
    x: cA * cG - sA * sB * sG,
    y: sA * cG + cA * sB * sG,
    z: -cB * sG,
  };
  const deviceY: Vector3 = {
    x: -sA * cB,
    y: cA * cB,
    z: sB,
  };
  const deviceZ: Vector3 = {
    x: cA * sG + sA * sB * cG,
    y: sA * sG - cA * sB * cG,
    z: cB * cG,
  };

  // Screen axes in device coordinates, rotated by the UI orientation.
  const cS = Math.cos(screen);
  const sS = Math.sin(screen);

  const combine = (a: Vector3, b: Vector3, wa: number, wb: number): Vector3 => ({
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  });

  return finishBasis(
    { x: -deviceZ.x, y: -deviceZ.y, z: -deviceZ.z },
    combine(deviceX, deviceY, cS, sS),
    combine(deviceX, deviceY, -sS, cS),
    orientation.declination ?? 0,
  );
}

/**
 * Camera basis from a rotation quaternion mapping device axes into the world.
 *
 * This is the path Android's rotation-vector sensor feeds. That sensor fuses
 * gyroscope, accelerometer and magnetometer in hardware, which is steadier than
 * anything reconstructed from Euler angles in JavaScript.
 *
 * Android reports its rotation vector in an East-North-Up frame already, so no
 * axis remapping is needed here.
 */
export function basisFromQuaternion(
  q: Quaternion,
  screenAngle = 0,
  declination = 0,
): CameraBasis {
  const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  const x = q.x / length;
  const y = q.y / length;
  const z = q.z / length;
  const w = q.w / length;

  // Columns of the rotation matrix: the device axes in world coordinates.
  const deviceX: Vector3 = {
    x: 1 - 2 * (y * y + z * z),
    y: 2 * (x * y + z * w),
    z: 2 * (x * z - y * w),
  };
  const deviceY: Vector3 = {
    x: 2 * (x * y - z * w),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (y * z + x * w),
  };
  const deviceZ: Vector3 = {
    x: 2 * (x * z + y * w),
    y: 2 * (y * z - x * w),
    z: 1 - 2 * (x * x + y * y),
  };

  const screen = toRadians(screenAngle);
  const cS = Math.cos(screen);
  const sS = Math.sin(screen);

  const combine = (a: Vector3, b: Vector3, wa: number, wb: number): Vector3 => ({
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  });

  return finishBasis(
    { x: -deviceZ.x, y: -deviceZ.y, z: -deviceZ.z },
    combine(deviceX, deviceY, cS, sS),
    combine(deviceX, deviceY, -sS, cS),
    declination,
  );
}

/** Apply declination, orthonormalise, and read off the pointing angles. */
function finishBasis(
  forwardRaw: Vector3,
  rightRaw: Vector3,
  upRaw: Vector3,
  declination: number,
): CameraBasis {
  const forward = normalize(rotateAboutUp(forwardRaw, declination));
  let right = rotateAboutUp(rightRaw, declination);
  let up = rotateAboutUp(upRaw, declination);

  // Gram-Schmidt: sensor noise makes the raw axes drift out of square, and a
  // non-orthogonal basis shears the whole sky.
  const rightDotForward = dot(right, forward);
  right = normalize({
    x: right.x - forward.x * rightDotForward,
    y: right.y - forward.y * rightDotForward,
    z: right.z - forward.z * rightDotForward,
  });

  // right x forward, in that order. Reversing the operands flips the up axis
  // and renders the whole sky upside down -- and still passes an orthonormality
  // check, so only a directional test catches it.
  up = normalize({
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  });

  const altitude = toDegrees(Math.asin(Math.max(-1, Math.min(1, forward.z))));
  const azimuth = normalize360(toDegrees(Math.atan2(forward.x, forward.y)));

  // Roll: how far the screen's up-axis has turned away from world up, measured
  // in the plane the camera is looking through.
  const worldUpInPlane: Vector3 = {
    x: -forward.z * forward.x,
    y: -forward.z * forward.y,
    z: 1 - forward.z * forward.z,
  };
  const roll = normalize360(
    toDegrees(Math.atan2(dot(worldUpInPlane, right), dot(worldUpInPlane, up))),
  );

  return { forward, right, up, altitude, azimuth, roll };
}

/** Unit vector in the world frame for an altitude and azimuth, in degrees. */
export function directionFromHorizontal(altitude: number, azimuth: number): Vector3 {
  const alt = toRadians(altitude);
  const az = toRadians(azimuth);
  const cosAlt = Math.cos(alt);
  return {
    x: cosAlt * Math.sin(az), // east
    y: cosAlt * Math.cos(az), // north
    z: Math.sin(alt), // up
  };
}

/** Inverse of {@link directionFromHorizontal}. */
export function horizontalFromDirection(v: Vector3): { altitude: number; azimuth: number } {
  const unit = normalize(v);
  return {
    altitude: toDegrees(Math.asin(Math.max(-1, Math.min(1, unit.z)))),
    azimuth: normalize360(toDegrees(Math.atan2(unit.x, unit.y))),
  };
}

/**
 * Smoothing for a live heading.
 *
 * A magnetometer's raw output jitters by degrees from one reading to the next.
 * Drawn straight, the sky visibly shivers. This is a low-pass filter that
 * respects the wrap at north, so a heading crossing 360 does not spin the sky
 * the long way round.
 *
 * `factor` is how much of the new reading to admit: small is smooth and
 * laggy, large is responsive and jittery. Around 0.1 to 0.2 per frame is
 * usually the sweet spot.
 */
export class HeadingFilter {
  private value: number | null = null;

  constructor(private readonly factor: number = 0.15) {}

  push(reading: number): number {
    if (this.value === null) {
      this.value = normalize360(reading);
      return this.value;
    }
    // Step along the short arc, so 359 -> 1 moves forward two degrees.
    const delta = ((reading - this.value + 540) % 360) - 180;
    this.value = normalize360(this.value + delta * this.factor);
    return this.value;
  }

  /** Drop the filter state, e.g. after the sensor is re-enabled. */
  reset(): void {
    this.value = null;
  }

  get current(): number | null {
    return this.value;
  }
}
