/**
 * Serves the built client over HTTPS on the local network.
 *
 * This exists for one reason. Camera, geolocation and DeviceOrientation are all
 * gated behind a *secure context*, and `http://192.168.1.42:5173` is not one.
 * On a phone that failure is silent -- no console error, no permission prompt,
 * just a page that never asks for anything and a sky that never moves. It is
 * the single most time-consuming trap in this whole project, so the dev path
 * ships with a certificate rather than leaving you to find out.
 *
 *   npm run serve
 *
 * The certificate is self-signed, so the phone will warn once. That warning is
 * expected: accept it and the sensors start working.
 */

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import selfsigned from 'selfsigned';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'packages', 'web', 'dist');
const certDir = path.join(here, '.cert');

const PORT = Number(process.env.PORT ?? 8443);
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8080);

/* ------------------------------------------------------------------ *
 * Certificate
 * ------------------------------------------------------------------ */

/**
 * Load a cached certificate, or mint one covering every address this machine
 * answers on.
 *
 * The subjectAltName list is what makes it work from a phone: browsers ignore
 * the common name entirely, so a certificate that does not name the LAN IP the
 * phone actually typed is rejected outright.
 */
function certificate() {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  const fresh = () => Date.now() - fs.statSync(certPath).mtimeMs < 300 * 24 * 3600 * 1000;

  if (fs.existsSync(keyPath) && fs.existsSync(certPath) && fresh()) {
    // The cached certificate names the addresses this machine had when it was
    // minted. Move to a different network and the phone rejects it, so the
    // recorded address list is checked rather than assumed.
    const recorded = readAddresses(certDir);
    const current = addresses().join(',');
    if (recorded === current) {
      return {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8'),
      };
    }
    console.log('network addresses changed since the certificate was minted');
  }

  console.log('minting a self-signed certificate…');

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' },
    ...addresses().map((ip) => ({ type: 7, ip })),
  ];

  const pems = selfsigned.generate([{ name: 'commonName', value: 'stargaze.local' }], {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);
  fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
  fs.writeFileSync(path.join(certDir, 'addresses.txt'), addresses().join(','));

  return { key: pems.private, cert: pems.cert };
}

/** The addresses the cached certificate was minted for, or '' if unknown. */
function readAddresses(dir) {
  try {
    return fs.readFileSync(path.join(dir, 'addresses.txt'), 'utf8').trim();
  } catch {
    return '';
  }
}

/** Every non-loopback IPv4 address this machine has. */
function addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

const app = express();

app.disable('x-powered-by');

app.use((_request, response, next) => {
  // The app asks for camera, location and motion. Without this the iframe-less
  // page is fine, but being explicit documents what it actually uses.
  response.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), accelerometer=(self), magnetometer=(self), gyroscope=(self)');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(
  express.static(dist, {
    setHeaders(response, filePath) {
      if (filePath.endsWith('sw.js')) {
        // A cached service worker is a service worker you cannot update.
        response.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        response.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

// Single-page app: anything unmatched is the shell.
app.use((request, response, next) => {
  if (request.method !== 'GET' || request.path.includes('.')) return next();
  response.sendFile(path.join(dist, 'index.html'));
});

/* ------------------------------------------------------------------ */

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`No build found at ${dist}`);
  console.error('Run:  npm run build');
  process.exit(1);
}

const { key, cert } = certificate();

https.createServer({ key, cert }, app).listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  StarGaze — serving over HTTPS');
  console.log('');
  console.log(`  Local:    https://localhost:${PORT}`);
  for (const address of addresses()) {
    console.log(`  Network:  https://${address}:${PORT}`);
  }
  console.log('');
  console.log('  The certificate is self-signed, so your phone will warn once.');
  console.log('  Accept it — sensors stay blocked until you do.');
  console.log('');
});

// A plain-http listener purely to redirect, because typing https:// by hand is
// the other half of this trap.
http
  .createServer((request, response) => {
    const host = (request.headers.host ?? '').split(':')[0];
    response.writeHead(301, { Location: `https://${host}:${PORT}${request.url}` });
    response.end();
  })
  .listen(HTTP_PORT, '0.0.0.0');
