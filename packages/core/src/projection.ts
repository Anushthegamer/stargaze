/**
 * Sky to screen.
 *
 * A camera is a pinhole: the world in front of it lands on a flat sensor by
 * central projection. Match that exactly and the overlay sits on the real
 * stars; approximate it and the centre lines up while the edges drift.
 */

import { toRadians } from './angles.js';
import type { CameraBasis, Vector3 } from './orientation.js';
import { directionFromHorizontal } from './orientation.js';

export interface Viewport {
  width: number;
  height: number;
  /**
   * Horizontal field of view in degrees.
   *
   * Phone rear cameras are typically 60-70 degrees. Browsers rarely expose the
   * real value, so this is a setting the user can nudge until the overlay lands
   * on the sky -- which is why it is a slider in the design and not a constant.
   */
  horizontalFov: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /**
   * Angular distance from the centre of view, degrees. Useful for fading
   * labels toward the edge, and for hit-testing.
   */
  angleFromCenter: number;
}

/** Focal length in pixels implied by a viewport's field of view. */
export function focalLength(viewport: Viewport): number {
  return viewport.width / 2 / Math.tan(toRadians(viewport.horizontalFov) / 2);
}

/** Vertical field of view implied by the horizontal one and the aspect ratio. */
export function verticalFov(viewport: Viewport): number {
  const focal = focalLength(viewport);
  return (2 * Math.atan(viewport.height / 2 / focal) * 180) / Math.PI;
}

/**
 * Project a world direction onto the screen.
 *
 * Returns null when the target is behind the camera or grazing the edge of the
 * view plane, where central projection sends points off to infinity. Callers
 * must handle null -- drawing an unchecked projection is how you get stars
 * smeared across the screen from behind your head.
 */
export function project(
  direction: Vector3,
  basis: CameraBasis,
  viewport: Viewport,
): ScreenPoint | null {
  const forward =
    direction.x * basis.forward.x +
    direction.y * basis.forward.y +
    direction.z * basis.forward.z;

  // Everything at or behind the view plane has no meaningful projection.
  if (forward <= 1e-6) return null;

  const right =
    direction.x * basis.right.x + direction.y * basis.right.y + direction.z * basis.right.z;
  const up = direction.x * basis.up.x + direction.y * basis.up.y + direction.z * basis.up.z;

  const focal = focalLength(viewport);

  return {
    x: viewport.width / 2 + (right / forward) * focal,
    // Screen y grows downward; the world's up does not.
    y: viewport.height / 2 - (up / forward) * focal,
    angleFromCenter: (Math.acos(Math.min(1, forward)) * 180) / Math.PI,
  };
}

/** Project an altitude/azimuth pair. */
export function projectHorizontal(
  altitude: number,
  azimuth: number,
  basis: CameraBasis,
  viewport: Viewport,
): ScreenPoint | null {
  return project(directionFromHorizontal(altitude, azimuth), basis, viewport);
}

/**
 * The world direction under a screen position -- the inverse of
 * {@link project}. This is what turns a tap into a patch of sky.
 */
export function unproject(x: number, y: number, basis: CameraBasis, viewport: Viewport): Vector3 {
  const focal = focalLength(viewport);
  const dx = (x - viewport.width / 2) / focal;
  const dy = -(y - viewport.height / 2) / focal;

  const v: Vector3 = {
    x: basis.forward.x + basis.right.x * dx + basis.up.x * dy,
    y: basis.forward.y + basis.right.y * dx + basis.up.y * dy,
    z: basis.forward.z + basis.right.z * dx + basis.up.z * dy,
  };

  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Half-angle of the cone that contains the whole viewport.
 *
 * Anything further from the view axis than this cannot be on screen, so the
 * render loop uses it to reject most of the catalogue with one comparison
 * before doing any projection work.
 */
export function viewConeRadius(viewport: Viewport): number {
  const focal = focalLength(viewport);
  const corner = Math.hypot(viewport.width / 2, viewport.height / 2);
  return (Math.atan(corner / focal) * 180) / Math.PI;
}

/**
 * Whether a direction could be on screen.
 *
 * A cheap dot-product rejection: no trigonometry, and it culls the roughly 95
 * per cent of the sky that is not in view.
 */
export function couldBeVisible(
  direction: Vector3,
  basis: CameraBasis,
  cosConeRadius: number,
): boolean {
  return (
    direction.x * basis.forward.x +
      direction.y * basis.forward.y +
      direction.z * basis.forward.z >
    cosConeRadius
  );
}
