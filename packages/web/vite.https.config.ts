import basicSsl from '@vitejs/plugin-basic-ssl';
import { mergeConfig } from 'vite';

import base from './vite.config.js';

/**
 * The dev server with a self-signed certificate.
 *
 * Sensors need a secure context. On localhost plain http qualifies, so
 * `npm run dev` is enough at a desk -- but from a phone at
 * http://192.168.x.x:5173 the camera, geolocation and motion APIs are all
 * blocked, silently, with no error that points at the cause. Use this for
 * device testing:
 *
 *     npm run dev:https
 *
 * The phone will warn about the certificate once. Accept it.
 */
export default mergeConfig(base, {
  plugins: [basicSsl()],
});
