import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the same web build into an Android app.
 *
 * One codebase, two clients. The astronomy in `packages/core` and the whole UI
 * are identical -- Android only changes how the sensors are reached and how the
 * page is served (from the APK rather than over the network, which is also what
 * makes the secure-context problem disappear).
 */
const config: CapacitorConfig = {
  appId: 'app.stargaze.sky',
  appName: 'StarGaze',
  webDir: 'packages/web/dist',

  android: {
    // The app is served from the APK over https://localhost, so there is no
    // reason to allow anything to load over plain http.
    allowMixedContent: false,
    // Leaves the WebView remotely inspectable (chrome://inspect) when true.
    // Off for release; flip to true locally when debugging on-device.
    webContentsDebuggingEnabled: false,
  },

  server: {
    // Serving from https://localhost inside the WebView makes it a secure
    // context, so camera, geolocation and motion all work exactly as they do
    // in the browser -- no separate native path for any of them.
    androidScheme: 'https',
  },

  plugins: {
    // Splash is handled by the page itself: the permission gate IS the first
    // screen, and a separate splash on top of it just adds a flash of nothing.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#05070D',
    },
  },
};

export default config;
