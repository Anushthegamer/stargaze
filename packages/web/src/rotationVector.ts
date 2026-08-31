/**
 * JS-side binding for the custom Android plugin at
 * android/app/src/main/java/app/stargaze/sky/RotationVectorPlugin.java.
 *
 * Not a published Capacitor plugin -- registerPlugin only needs the name
 * below to match what MainActivity registers natively. Importing this file
 * on the web build is harmless: with no native side registered, every call
 * rejects, which native.ts already treats the same as "not available".
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface RotationVectorReading {
  x: number;
  y: number;
  z: number;
  w: number;
  /** Radians, or -1 if the device does not report one. */
  accuracy: number;
}

export interface RotationVectorPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'reading',
    listener: (reading: RotationVectorReading) => void,
  ): Promise<PluginListenerHandle>;
}

export const RotationVector = registerPlugin<RotationVectorPlugin>('RotationVector');
