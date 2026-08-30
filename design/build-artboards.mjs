// Composes the five StarGaze design artboards.
// Artboards share nothing at runtime, so the sky field is emitted into each one.
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'C:/Users/RAMSK/Documents/Projects/stargaze/design';
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ *
 * Shared chrome
 * ------------------------------------------------------------------ */

const HEAD = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      background: #05070D;
      color: #EEF2F8;
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    a { color: #E9A93B; }
    a:hover { color: #F5C46B; }
    .frame { position: relative; width: 390px; height: 844px; overflow: hidden; background: #05070D; }
    .mono { font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .cap { font-size: 9.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(238, 242, 248, 0.38); }
    .glass {
      background: rgba(9, 13, 21, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.11);
      backdrop-filter: blur(16px) saturate(125%);
      -webkit-backdrop-filter: blur(16px) saturate(125%);
    }
  </style>
</helmet>`;

const TAIL = (props, logic) => `</x-dc>
<script data-dc-script data-props='${props}'>
${logic}
</script>
</body>
</html>
`;

const PREVIEW = '"$preview":{"width":390,"height":844}';
const ACCENT_PROP =
  '"accent":{"editor":"color","default":"#E9A93B","options":["#E9A93B","#4FD1E0","#F0F4FA","#FF7A5C"],"section":"Theme"}';

const accentLogic = (extra = '') => `class Component extends DCLogic {
  renderVals() {
    return {
      accent: this.props.accent ?? '#E9A93B',${extra}
    };
  }
}`;

/* ------------------------------------------------------------------ *
 * Sky field
 * ------------------------------------------------------------------ */

// Deterministic background scatter (see build note in design/README).
const SCATTER = `<circle cx="144.3" cy="591.4" r="1.29" fill="#FFD9AE" opacity="0.63"></circle>
      <circle cx="364" cy="272.3" r="0.71" fill="#CFE0FF" opacity="0.41"></circle>
      <circle cx="134.3" cy="520.4" r="0.5" fill="#FFF6E8" opacity="0.2"></circle>
      <circle cx="33.6" cy="649.9" r="0.5" fill="#FFF6E8" opacity="0.21"></circle>
      <circle cx="65" cy="168" r="0.69" fill="#FFF6E8" opacity="0.4"></circle>
      <circle cx="168.7" cy="651.9" r="0.5" fill="#FFF6E8" opacity="0.2"></circle>
      <circle cx="110.4" cy="411.7" r="0.69" fill="#FFF6E8" opacity="0.4"></circle>
      <circle cx="19.5" cy="454.4" r="0.65" fill="#FFF6E8" opacity="0.37"></circle>
      <circle cx="216.6" cy="542.4" r="1.1" fill="#FFF6E8" opacity="0.57"></circle>
      <circle cx="241.5" cy="12.6" r="1.22" fill="#FFD9AE" opacity="0.61"></circle>
      <circle cx="205.3" cy="699.7" r="0.5" fill="#FFF6E8" opacity="0.21"></circle>
      <circle cx="281.8" cy="379.5" r="0.7" fill="#CFE0FF" opacity="0.41"></circle>
      <circle cx="98.2" cy="325.3" r="1.93" fill="#FFF6E8" opacity="0.79"></circle>
      <circle cx="275.2" cy="344.3" r="0.78" fill="#FFF6E8" opacity="0.45"></circle>
      <circle cx="39.5" cy="289.3" r="0.95" fill="#FFF6E8" opacity="0.52"></circle>
      <circle cx="260.6" cy="613.6" r="0.89" fill="#FFD9AE" opacity="0.5"></circle>
      <circle cx="240.1" cy="665.2" r="1.09" fill="#FFF6E8" opacity="0.57"></circle>
      <circle cx="147.2" cy="517.1" r="1.53" fill="#FFD9AE" opacity="0.69"></circle>
      <circle cx="264.1" cy="685.8" r="0.96" fill="#CFE0FF" opacity="0.52"></circle>
      <circle cx="185.3" cy="309.2" r="0.51" fill="#CFE0FF" opacity="0.23"></circle>
      <circle cx="213.6" cy="40.8" r="0.5" fill="#FFF6E8" opacity="0.21"></circle>
      <circle cx="279.8" cy="4.9" r="1.09" fill="#FFF6E8" opacity="0.57"></circle>
      <circle cx="388.7" cy="127.6" r="0.84" fill="#CFE0FF" opacity="0.48"></circle>
      <circle cx="64.3" cy="537.6" r="0.67" fill="#FFF6E8" opacity="0.39"></circle>
      <circle cx="209.5" cy="602.3" r="1.65" fill="#CFE0FF" opacity="0.72"></circle>
      <circle cx="370.9" cy="243.7" r="0.67" fill="#FFF6E8" opacity="0.39"></circle>
      <circle cx="87.7" cy="348.5" r="1.67" fill="#FFF6E8" opacity="0.73"></circle>
      <circle cx="7.3" cy="65.8" r="1.54" fill="#FFF6E8" opacity="0.7"></circle>
      <circle cx="383.1" cy="679.9" r="1.19" fill="#FFF6E8" opacity="0.6"></circle>
      <circle cx="275.6" cy="176.4" r="1.64" fill="#FFF6E8" opacity="0.72"></circle>
      <circle cx="250.3" cy="626.4" r="1.56" fill="#FFF6E8" opacity="0.7"></circle>
      <circle cx="151.7" cy="350.7" r="0.54" fill="#FFF6E8" opacity="0.29"></circle>
      <circle cx="367.4" cy="380.5" r="1.49" fill="#CFE0FF" opacity="0.68"></circle>
      <circle cx="206.9" cy="651.8" r="0.53" fill="#FFF6E8" opacity="0.27"></circle>
      <circle cx="227.1" cy="425.5" r="1.81" fill="#FFF6E8" opacity="0.76"></circle>
      <circle cx="221.9" cy="98.5" r="1.41" fill="#FFF6E8" opacity="0.66"></circle>
      <circle cx="293.2" cy="351.6" r="0.77" fill="#FFF6E8" opacity="0.44"></circle>
      <circle cx="35.5" cy="347.1" r="0.5" fill="#FFF6E8" opacity="0.2"></circle>
      <circle cx="326.3" cy="372" r="0.91" fill="#FFF6E8" opacity="0.51"></circle>
      <circle cx="221" cy="491.8" r="0.59" fill="#FFD9AE" opacity="0.33"></circle>
      <circle cx="267.3" cy="257.8" r="1.37" fill="#FFD9AE" opacity="0.65"></circle>
      <circle cx="253.5" cy="484.6" r="1.09" fill="#FFF6E8" opacity="0.57"></circle>
      <circle cx="171.9" cy="591.6" r="0.55" fill="#FFF6E8" opacity="0.29"></circle>
      <circle cx="15.4" cy="572.7" r="1.66" fill="#FFF6E8" opacity="0.73"></circle>
      <circle cx="363.3" cy="40.2" r="1.31" fill="#FFF6E8" opacity="0.63"></circle>
      <circle cx="351.4" cy="256" r="1.39" fill="#FFF6E8" opacity="0.66"></circle>
      <circle cx="244.7" cy="545.8" r="1.14" fill="#FFF6E8" opacity="0.58"></circle>
      <circle cx="334" cy="261.9" r="1.56" fill="#FFF6E8" opacity="0.7"></circle>
      <circle cx="61.2" cy="135.8" r="1.84" fill="#FFF6E8" opacity="0.77"></circle>
      <circle cx="206.7" cy="540.4" r="0.54" fill="#FFF6E8" opacity="0.28"></circle>
      <circle cx="151" cy="651.5" r="1.76" fill="#FFF6E8" opacity="0.75"></circle>
      <circle cx="257.9" cy="577" r="0.53" fill="#FFD9AE" opacity="0.27"></circle>
      <circle cx="26.3" cy="295.8" r="1.39" fill="#FFF6E8" opacity="0.66"></circle>
      <circle cx="303.7" cy="624" r="0.75" fill="#FFF6E8" opacity="0.43"></circle>
      <circle cx="12.8" cy="399.1" r="0.6" fill="#FFF6E8" opacity="0.34"></circle>
      <circle cx="169.6" cy="351.7" r="1.32" fill="#FFF6E8" opacity="0.64"></circle>
      <circle cx="379.3" cy="504.5" r="0.75" fill="#FFF6E8" opacity="0.43"></circle>
      <circle cx="2.8" cy="517.6" r="0.51" fill="#FFF6E8" opacity="0.23"></circle>
      <circle cx="296.5" cy="671.4" r="0.64" fill="#FFF6E8" opacity="0.37"></circle>
      <circle cx="22.3" cy="654.4" r="1.02" fill="#CFE0FF" opacity="0.55"></circle>
      <circle cx="135" cy="498.1" r="1.85" fill="#FFF6E8" opacity="0.77"></circle>
      <circle cx="99.9" cy="476.7" r="1.43" fill="#CFE0FF" opacity="0.67"></circle>
      <circle cx="82.7" cy="462.7" r="0.53" fill="#FFF6E8" opacity="0.26"></circle>
      <circle cx="339.3" cy="106.8" r="1.27" fill="#FFF6E8" opacity="0.63"></circle>
      <circle cx="151.9" cy="683.4" r="0.8" fill="#FFF6E8" opacity="0.46"></circle>
      <circle cx="315.6" cy="519.1" r="0.58" fill="#FFF6E8" opacity="0.32"></circle>
      <circle cx="15.4" cy="597" r="0.62" fill="#FFF6E8" opacity="0.36"></circle>
      <circle cx="93.5" cy="2.9" r="0.61" fill="#FFF6E8" opacity="0.35"></circle>
      <circle cx="231.9" cy="256.6" r="1.87" fill="#FFF6E8" opacity="0.77"></circle>
      <circle cx="295" cy="644.5" r="0.61" fill="#FFF6E8" opacity="0.35"></circle>
      <circle cx="181.4" cy="447.3" r="1.58" fill="#FFF6E8" opacity="0.71"></circle>
      <circle cx="46.7" cy="327.5" r="1" fill="#FFF6E8" opacity="0.54"></circle>
      <circle cx="119.2" cy="221.8" r="1.09" fill="#FFF6E8" opacity="0.57"></circle>
      <circle cx="329.7" cy="253.7" r="0.93" fill="#FFF6E8" opacity="0.51"></circle>
      <circle cx="238.8" cy="675.1" r="0.58" fill="#FFF6E8" opacity="0.32"></circle>
      <circle cx="109.7" cy="110.2" r="1.32" fill="#FFF6E8" opacity="0.64"></circle>
      <circle cx="90.8" cy="643" r="1.29" fill="#FFF6E8" opacity="0.63"></circle>
      <circle cx="207.7" cy="468.7" r="0.53" fill="#FFF6E8" opacity="0.26"></circle>
      <circle cx="100.9" cy="298.6" r="1.42" fill="#FFF6E8" opacity="0.66"></circle>
      <circle cx="293.4" cy="230.4" r="0.56" fill="#FFF6E8" opacity="0.31"></circle>
      <circle cx="366.1" cy="46.7" r="0.92" fill="#FFF6E8" opacity="0.51"></circle>
      <circle cx="378" cy="578.3" r="0.96" fill="#FFF6E8" opacity="0.52"></circle>
      <circle cx="200.6" cy="127.9" r="0.89" fill="#CFE0FF" opacity="0.5"></circle>
      <circle cx="378.3" cy="269.9" r="0.93" fill="#FFF6E8" opacity="0.51"></circle>
      <circle cx="37.3" cy="519.9" r="1.61" fill="#FFF6E8" opacity="0.71"></circle>
      <circle cx="330.8" cy="39.9" r="0.57" fill="#FFF6E8" opacity="0.31"></circle>`;

// Orion as seen from mid-northern latitudes: Betelgeuse upper-left, Rigel lower-right.
const O = {
  betelgeuse: [128, 250], bellatrix: [246, 232],
  mintaka: [255, 336], alnilam: [222, 348], alnitak: [190, 359],
  saiph: [170, 452], rigel: [285, 440],
};
const seg = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"></line>`;
const ORION_LINES = [
  seg(O.betelgeuse, O.bellatrix), seg(O.betelgeuse, O.alnitak),
  seg(O.bellatrix, O.mintaka), seg(O.mintaka, O.alnilam),
  seg(O.alnilam, O.alnitak), seg(O.alnitak, O.saiph), seg(O.mintaka, O.rigel),
].join('\n        ');

const disc = ([x, y], r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"></circle>`;
const ORION_STARS = [
  disc(O.betelgeuse, 3.4, '#FFC894'), disc(O.bellatrix, 2.4, '#DDE7FF'),
  disc(O.mintaka, 2.2, '#CFE0FF'), disc(O.alnilam, 2.6, '#CFE0FF'),
  disc(O.alnitak, 2.4, '#CFE0FF'), disc(O.saiph, 2.3, '#DDE7FF'),
  disc(O.rigel, 3.2, '#DDE7FF'), disc([312, 188], 4.2, '#FFE0B0'),
].join('\n      ');

const GRAIN_URI =
  "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%273%27/%3E%3C/filter%3E%3Crect width=%27140%27 height=%27140%27 filter=%27url(%23n)%27/%3E%3C/svg%3E')";

const TREELINE_D =
  'M0,170 L0,110 L14,100 L22,116 L34,90 L46,108 L58,84 L70,104 L84,94 L96,118 L110,88 L124,108 ' +
  'L138,78 L152,100 L166,114 L180,86 L194,104 L208,92 L222,118 L236,96 L250,110 L264,82 L278,104 ' +
  'L292,94 L306,116 L320,88 L334,108 L348,98 L362,118 L376,96 L390,110 L390,170 Z';

/**
 * The camera-plus-overlay stack.
 * @param {object} opts
 * @param {boolean} opts.bindLines wrap constellation lines in the `lines` tweak
 * @param {boolean} opts.labelBetelgeuse draw the inline Betelgeuse label (off when it is selected)
 * @param {number}  opts.overlayOpacity dims the whole overlay behind a sheet
 */
const skyLayer = ({ bindLines = false, labelBetelgeuse = true, overlayOpacity = 1 } = {}) => {
  const open = bindLines
    ? `<sc-if value="{{lines}}" hint-placeholder-val="{{ true }}">
      <g stroke="rgba(152, 182, 236, 0.30)" stroke-width="1" stroke-linecap="round">`
    : `<g stroke="rgba(152, 182, 236, 0.30)" stroke-width="1" stroke-linecap="round">`;
  const close = bindLines ? `</g>\n    </sc-if>` : `</g>`;
  return `  <div style="position: absolute; inset: 0; background: radial-gradient(135% 72% at 50% 4%, #0C1526 0%, #070B15 46%, #04060C 100%);"></div>
  <div style="position: absolute; left: -70px; top: 60px; width: 540px; height: 320px; transform: rotate(-24deg); background: radial-gradient(50% 50% at 50% 50%, rgba(148, 174, 226, 0.11) 0%, rgba(148, 174, 226, 0) 70%); filter: blur(20px);"></div>
  <svg viewBox="0 0 390 844" width="390" height="844" style="position: absolute; inset: 0; display: block; opacity: ${overlayOpacity};" aria-hidden="true">
    <defs>
      <filter id="starglow" x="-300%" y="-300%" width="700%" height="700%">
        <feGaussianBlur stdDeviation="2.6" result="blurred"></feGaussianBlur>
        <feMerge><feMergeNode in="blurred"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
      </filter>
    </defs>
    <g>
      ${SCATTER}
    </g>
    ${open}
        ${ORION_LINES}
      ${close}
    <g filter="url(#starglow)">
      ${ORION_STARS}
    </g>
    <text x="228" y="522" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="10" font-weight="600" letter-spacing="3.2" fill="rgba(152, 182, 236, 0.40)">ORION</text>
    <text x="312" y="172" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="10" fill="rgba(255, 224, 176, 0.72)">Jupiter</text>
${labelBetelgeuse ? `    <text x="128" y="234" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="10" fill="rgba(255, 200, 148, 0.70)">Betelgeuse</text>\n` : ''}    <text x="285" y="462" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="10" fill="rgba(221, 231, 255, 0.62)">Rigel</text>
  </svg>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 240px; background: linear-gradient(to top, rgba(58, 78, 118, 0.26), rgba(58, 78, 118, 0) 100%);"></div>
  <svg viewBox="0 0 390 170" width="390" height="170" style="position: absolute; left: 0; bottom: 0; display: block;" aria-hidden="true">
    <path d="${TREELINE_D}" fill="#010307"></path>
  </svg>
  <div style="position: absolute; inset: 0; opacity: 0.075; mix-blend-mode: screen; pointer-events: none; background-image: ${GRAIN_URI};"></div>`;
};

/* ------------------------------------------------------------------ *
 * Compass strip
 * ------------------------------------------------------------------ */

const HEADING = 47.3;
const SPAN = 120;
const STRIP_W = 366;
const bx = (b) => +((b - (HEADING - SPAN / 2)) * (STRIP_W / SPAN)).toFixed(1);
const CARDINALS = { 0: 'N', 45: 'NE', 90: 'E' };

let TICKS = '';
for (let b = -15; b <= 110; b += 5) {
  const x = bx(b);
  if (x < 7 || x > STRIP_W - 7) continue;
  const major = b % 15 === 0;
  TICKS += `\n        <line x1="${x}" y1="${major ? 8 : 13}" x2="${x}" y2="20" stroke="rgba(238, 242, 248, ${major ? 0.55 : 0.24})" stroke-width="1"></line>`;
  if (!major) continue;
  const card = CARDINALS[b];
  TICKS += card
    ? `\n        <text x="${x}" y="35" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="11.5" font-weight="600" letter-spacing="1" fill="rgba(238, 242, 248, 0.88)">${card}</text>`
    : `\n        <text x="${x}" y="34" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="9.5" fill="rgba(238, 242, 248, 0.40)">${b}</text>`;
}

const COMPASS = `  <div class="glass" style="position: absolute; left: 12px; top: 14px; width: 366px; height: 60px; border-radius: 15px; overflow: hidden;">
    <svg viewBox="0 0 366 60" width="366" height="60" style="display: block;" aria-hidden="true">${TICKS}
      <path d="M183,3 L188,11 L178,11 Z" fill="{{accent}}"></path>
      <line x1="183" y1="11" x2="183" y2="23" stroke="{{accent}}" stroke-width="1.25"></line>
      <text x="183" y="51" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="500" fill="{{accent}}">47.3&#176;</text>
    </svg>
  </div>`;

const READOUT = `  <div style="position: absolute; left: 12px; top: 84px; display: flex; gap: 8px;">
    <div class="glass" style="display: flex; align-items: baseline; gap: 7px; padding: 6px 11px; border-radius: 9px;">
      <span class="cap">Alt</span><span class="mono" style="font-size: 12px; color: rgba(238, 242, 248, 0.88);">38.6&#176;</span>
    </div>
    <div class="glass" style="display: flex; align-items: baseline; gap: 7px; padding: 6px 11px; border-radius: 9px;">
      <span class="cap">Az</span><span class="mono" style="font-size: 12px; color: rgba(238, 242, 248, 0.88);">47.3&#176;</span>
    </div>
  </div>`;

const RETICLE = `  <svg viewBox="0 0 96 96" width="96" height="96" style="position: absolute; left: 147px; top: 374px; display: block;" aria-hidden="true">
    <circle cx="48" cy="48" r="27" fill="none" stroke="rgba(238, 242, 248, 0.16)" stroke-width="1"></circle>
    <line x1="48" y1="6" x2="48" y2="26" stroke="rgba(238, 242, 248, 0.34)" stroke-width="1"></line>
    <line x1="48" y1="70" x2="48" y2="90" stroke="rgba(238, 242, 248, 0.34)" stroke-width="1"></line>
    <line x1="6" y1="48" x2="26" y2="48" stroke="rgba(238, 242, 248, 0.34)" stroke-width="1"></line>
    <line x1="70" y1="48" x2="90" y2="48" stroke="rgba(238, 242, 248, 0.34)" stroke-width="1"></line>
    <circle cx="48" cy="48" r="1.4" fill="rgba(238, 242, 248, 0.55)"></circle>
  </svg>`;

/* ------------------------------------------------------------------ *
 * Icons + nav
 * ------------------------------------------------------------------ */

const ico = (inner, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  search: ico('<circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="15.4" y1="15.4" x2="20.5" y2="20.5"></line>'),
  tonight: ico('<path d="M19.6 14.3A7.7 7.7 0 0 1 9.7 4.4a7.7 7.7 0 1 0 9.9 9.9Z"></path><path d="M17.4 3.2l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6Z"></path>'),
  settings: ico('<line x1="3" y1="8" x2="21" y2="8"></line><line x1="3" y1="16" x2="21" y2="16"></line><circle cx="9" cy="8" r="2.6"></circle><circle cx="16" cy="16" r="2.6"></circle>'),
  camera: ico('<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"></path><circle cx="12" cy="13" r="3.6"></circle>', 20),
  pin: ico('<path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z"></path><circle cx="12" cy="10" r="2.5"></circle>', 20),
  compass: ico('<circle cx="12" cy="12" r="8.5"></circle><path d="M15.3 8.7 13.6 13.6 8.7 15.3 10.4 10.4Z"></path>', 20),
  back: ico('<path d="M15 5 8 12l7 7"></path>', 22),
  close: ico('<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>', 18),
};

const navBtn = (icon, label, active) =>
  `      <button type="button" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 110px; height: 58px; padding: 0; border: 0; border-radius: 13px; background: ${active ? 'rgba(255, 255, 255, 0.07)' : 'transparent'}; color: ${active ? '{{accent}}' : 'rgba(238, 242, 248, 0.62)'}; font-family: inherit; cursor: pointer;">
        ${icon}
        <span style="font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;">${label}</span>
      </button>`;

const navbar = (active = null) => `  <div class="glass" style="position: absolute; left: 12px; bottom: 24px; width: 366px; height: 78px; border-radius: 20px; display: flex; align-items: center; justify-content: space-evenly; padding: 0 6px;">
${navBtn(ICONS.search, 'Search', active === 'search')}
${navBtn(ICONS.tonight, 'Tonight', active === 'tonight')}
${navBtn(ICONS.settings, 'Settings', active === 'settings')}
  </div>`;

/* ------------------------------------------------------------------ *
 * 1. Main — sky view, idle
 * ------------------------------------------------------------------ */

writeFileSync(`${OUT}/Main.dc.html`, `${HEAD}
<div class="frame">
${skyLayer({ bindLines: true })}
${COMPASS}
${READOUT}
${RETICLE}
${navbar()}
</div>
${TAIL(
  `{${ACCENT_PROP},"lines":{"editor":"boolean","default":true,"section":"Overlay"},${PREVIEW}}`,
  accentLogic(`\n      lines: this.props.lines ?? true,`)
)}`);

/* ------------------------------------------------------------------ *
 * 2. Selected — object info card
 * ------------------------------------------------------------------ */

const stat = (label, value) => `        <div style="display: flex; flex-direction: column; gap: 5px;">
          <span class="cap">${label}</span>
          <span class="mono" style="font-size: 14px; font-weight: 500; color: #EEF2F8;">${value}</span>
        </div>`;

const SELECTION_RING = `  <svg viewBox="0 0 120 120" width="120" height="120" style="position: absolute; left: 68px; top: 190px; display: block;" aria-hidden="true">
    <circle cx="60" cy="60" r="26" fill="none" stroke="{{accent}}" stroke-width="1.25" opacity="0.9"></circle>
    <circle cx="60" cy="60" r="34" fill="none" stroke="{{accent}}" stroke-width="1" opacity="0.28"></circle>
    <line x1="60" y1="20" x2="60" y2="30" stroke="{{accent}}" stroke-width="1.25"></line>
    <line x1="60" y1="90" x2="60" y2="100" stroke="{{accent}}" stroke-width="1.25"></line>
    <line x1="20" y1="60" x2="30" y2="60" stroke="{{accent}}" stroke-width="1.25"></line>
    <line x1="90" y1="60" x2="100" y2="60" stroke="{{accent}}" stroke-width="1.25"></line>
  </svg>
  <svg viewBox="0 0 200 120" width="200" height="120" style="position: absolute; left: 128px; top: 130px; display: block;" aria-hidden="true">
    <path d="M18,120 L58,80 L150,80" fill="none" stroke="{{accent}}" stroke-width="1" opacity="0.55"></path>
  </svg>
  <div class="mono" style="position: absolute; left: 190px; top: 192px; font-size: 11px; letter-spacing: 0.06em; color: {{accent}};">&#945; ORIONIS</div>`;

const INFO_CARD = `  <div class="glass" style="position: absolute; left: 12px; bottom: 24px; width: 366px; border-radius: 22px; padding: 20px 20px 22px;">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 7px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="width: 9px; height: 9px; border-radius: 50%; background: #FFC894; box-shadow: 0 0 10px 2px rgba(255, 200, 148, 0.55);"></span>
          <h1 style="margin: 0; font-size: 25px; font-weight: 600; letter-spacing: -0.015em;">Betelgeuse</h1>
        </div>
        <div style="display: flex; gap: 7px;">
          <span style="padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.13); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(238, 242, 248, 0.72);">Red supergiant</span>
          <span style="padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.13); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(238, 242, 248, 0.72);">Variable</span>
        </div>
      </div>
      <button type="button" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: -6px -6px 0 0; padding: 0; border: 0; border-radius: 12px; background: transparent; color: rgba(238, 242, 248, 0.55); cursor: pointer;">${ICONS.close}</button>
    </div>
    <div style="height: 1px; margin: 18px 0; background: rgba(255, 255, 255, 0.09);"></div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 12px;">
${stat('Magnitude', '+0.42')}
${stat('Constellation', 'Orion')}
${stat('Distance', '548 ly')}
${stat('Altitude', '38.6&#176;')}
${stat('Azimuth', '47.3&#176;')}
${stat('Sets', '04:12')}
    </div>
    <div style="display: flex; align-items: center; gap: 9px; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.09);">
      <span style="color: {{accent}}; display: flex;">${ICONS.compass}</span>
      <span style="font-size: 12.5px; color: rgba(238, 242, 248, 0.62);">Rose at 19:48 &#183; highest at 01:04</span>
    </div>
  </div>`;

writeFileSync(`${OUT}/Selected.dc.html`, `${HEAD}
<div class="frame">
${skyLayer({ bindLines: true, labelBetelgeuse: false })}
${COMPASS}
${READOUT}
${SELECTION_RING}
${INFO_CARD}
</div>
${TAIL(
  `{${ACCENT_PROP},"lines":{"editor":"boolean","default":true,"section":"Overlay"},${PREVIEW}}`,
  accentLogic(`\n      lines: this.props.lines ?? true,`)
)}`);

/* ------------------------------------------------------------------ *
 * 3. Permissions — the sensor gate
 * ------------------------------------------------------------------ */

const permRow = (icon, title, reason, granted) => `      <div style="display: flex; align-items: flex-start; gap: 14px; padding: 17px 0;">
        <span style="display: flex; align-items: center; justify-content: center; flex: 0 0 40px; width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: ${granted ? '{{accent}}' : 'rgba(238, 242, 248, 0.72)'};">${icon}</span>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 15px; font-weight: 600; letter-spacing: -0.005em;">${title}</span>
          <span style="font-size: 12.5px; line-height: 1.45; color: rgba(238, 242, 248, 0.56); text-wrap: pretty;">${reason}</span>
        </div>
        <span style="flex: 0 0 auto; margin-top: 3px; padding: 4px 10px; border-radius: 999px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; ${granted
          ? 'background: {{accent}}; color: #06080E;'
          : 'border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(238, 242, 248, 0.52);'}">${granted ? 'Granted' : 'Required'}</span>
      </div>`;

writeFileSync(`${OUT}/Permissions.dc.html`, `${HEAD}
<div class="frame">
  <div style="position: absolute; inset: 0; background: radial-gradient(120% 60% at 50% 0%, #0B1322 0%, #06090F 55%, #04060C 100%);"></div>
  <svg viewBox="0 0 390 844" width="390" height="844" style="position: absolute; inset: 0; display: block; opacity: 0.5;" aria-hidden="true">
    <g>
      ${SCATTER}
    </g>
  </svg>
  <div style="position: absolute; inset: 0; opacity: 0.06; mix-blend-mode: screen; pointer-events: none; background-image: ${GRAIN_URI};"></div>

  <div style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 76px 24px 34px;">
    <div style="display: flex; align-items: center; gap: 9px;">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 13.9 9.1 21 11 13.9 12.9 12 20 10.1 12.9 3 11 10.1 9.1Z" fill="{{accent}}"></path></svg>
      <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(238, 242, 248, 0.82);">StarGaze</span>
    </div>

    <h1 style="margin: 34px 0 0; font-size: 33px; line-height: 1.14; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance;">Three sensors,<br>no guesswork.</h1>
    <p style="margin: 14px 0 0; font-size: 14.5px; line-height: 1.55; color: rgba(238, 242, 248, 0.58); text-wrap: pretty;">StarGaze doesn&#39;t photograph the sky &#8212; it calculates it. Where you are, what time it is, and which way you&#39;re pointing is everything it needs.</p>

    <div class="glass" style="margin-top: 30px; border-radius: 20px; padding: 4px 18px;">
${permRow(ICONS.pin, 'Location', 'Your latitude decides which half of the sky is above you.', true)}
      <div style="height: 1px; background: rgba(255, 255, 255, 0.07);"></div>
${permRow(ICONS.camera, 'Camera', 'Puts the real sky behind the overlay so you can match them up.', false)}
      <div style="height: 1px; background: rgba(255, 255, 255, 0.07);"></div>
${permRow(ICONS.compass, 'Motion &amp; compass', 'Tells the app which direction and angle you&#39;re aiming at.', false)}
    </div>

    <div style="flex-grow: 1;"></div>

    <button type="button" style="width: 100%; height: 58px; border: 0; border-radius: 17px; background: {{accent}}; color: #06080E; font-family: inherit; font-size: 16px; font-weight: 600; letter-spacing: 0.01em; cursor: pointer;">Enable &amp; start</button>
    <p style="margin: 16px 0 0; text-align: center; font-size: 11.5px; line-height: 1.5; color: rgba(238, 242, 248, 0.38); text-wrap: pretty;">Every position is computed on your device.<br>Nothing about where you are is sent anywhere.</p>
  </div>
</div>
${TAIL(`{${ACCENT_PROP},${PREVIEW}}`, accentLogic())}`);

/* ------------------------------------------------------------------ *
 * 4. Settings — bottom sheet
 * ------------------------------------------------------------------ */

const slider = (label, value, pct, helper) => `      <div style="display: flex; flex-direction: column; gap: 11px;">
        <div style="display: flex; align-items: baseline; justify-content: space-between;">
          <span style="font-size: 14.5px; font-weight: 500;">${label}</span>
          <span class="mono" style="font-size: 13px; color: {{accent}};">${value}</span>
        </div>
        <div style="position: relative; height: 22px;">
          <div style="position: absolute; left: 0; right: 0; top: 9px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.10);"></div>
          <div style="position: absolute; left: 0; width: ${pct}%; top: 9px; height: 4px; border-radius: 2px; background: {{accent}};"></div>
          <div style="position: absolute; left: calc(${pct}% - 11px); top: 0; width: 22px; height: 22px; border-radius: 50%; background: #EEF2F8; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);"></div>
        </div>
        <span style="font-size: 11.5px; color: rgba(238, 242, 248, 0.42);">${helper}</span>
      </div>`;

const toggle = (label, on) => `      <div style="display: flex; align-items: center; justify-content: space-between; min-height: 46px;">
        <span style="font-size: 14.5px; font-weight: 500;">${label}</span>
        <span style="position: relative; display: block; width: 50px; height: 29px; border-radius: 999px; background: ${on ? '{{accent}}' : 'rgba(255, 255, 255, 0.13)'};">
          <span style="position: absolute; top: 3px; left: ${on ? '24px' : '3px'}; width: 23px; height: 23px; border-radius: 50%; background: ${on ? '#06080E' : '#EEF2F8'};"></span>
        </span>
      </div>`;

writeFileSync(`${OUT}/Settings.dc.html`, `${HEAD}
<div class="frame">
${skyLayer({ overlayOpacity: 0.55 })}
  <div style="position: absolute; inset: 0; background: rgba(4, 6, 12, 0.55); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);"></div>
${COMPASS}

  <div class="glass" style="position: absolute; left: 0; right: 0; bottom: 0; height: 648px; border-radius: 26px 26px 0 0; border-bottom: 0; padding: 12px 22px 30px; display: flex; flex-direction: column;">
    <span style="align-self: center; width: 38px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.22);"></span>
    <h2 style="margin: 18px 0 0; font-size: 21px; font-weight: 600; letter-spacing: -0.015em;">Settings</h2>

    <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 24px;">
      <span class="cap">Catalog</span>
${slider('Magnitude cutoff', '4.5', 92, '486 stars above the horizon right now.')}
${toggle('Constellation lines', true)}
${toggle('Planet labels', true)}
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
      <span class="cap">Alignment</span>
${slider('Camera field of view', '66&#176;', 48, 'Widen or narrow until the overlay sits on the real stars.')}
      <div style="display: flex; align-items: center; justify-content: space-between; min-height: 46px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 14.5px; font-weight: 500;">True-north offset</span>
          <span style="font-size: 11.5px; color: rgba(238, 242, 248, 0.42);">Declination &#8722;1.8&#176; already applied.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" style="width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, 0.13); border-radius: 12px; background: transparent; color: #EEF2F8; font-family: inherit; font-size: 19px; line-height: 1; cursor: pointer;">&#8722;</button>
          <span class="mono" style="min-width: 62px; text-align: center; font-size: 14px; color: {{accent}};">+2.5&#176;</span>
          <button type="button" style="width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, 0.13); border-radius: 12px; background: transparent; color: #EEF2F8; font-family: inherit; font-size: 19px; line-height: 1; cursor: pointer;">+</button>
        </div>
      </div>
    </div>

    <div style="flex-grow: 1;"></div>
    <button type="button" style="width: 100%; height: 52px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 15px; background: transparent; color: #EEF2F8; font-family: inherit; font-size: 14.5px; font-weight: 500; cursor: pointer;">Calibrate on a known star</button>
  </div>
</div>
${TAIL(`{${ACCENT_PROP},${PREVIEW}}`, accentLogic())}`);

/* ------------------------------------------------------------------ *
 * 5. Tonight — visible-object list
 * ------------------------------------------------------------------ */

const OBJECTS = [
  { name: 'Moon', sub: 'Waxing gibbous &#183; 68%', mag: '&#8722;11.9', alt: '52&#176;', az: 118, r: 11, fill: '#F2E6CE' },
  { name: 'Jupiter', sub: 'Planet &#183; Taurus', mag: '&#8722;2.4', alt: '41&#176;', az: 96, r: 7, fill: '#FFE0B0' },
  { name: 'Saturn', sub: 'Planet &#183; Aquarius', mag: '+0.9', alt: '28&#176;', az: 214, r: 6, fill: '#F0D9A8' },
  { name: 'Vega', sub: 'Star &#183; Lyra', mag: '+0.03', alt: '63&#176;', az: 292, r: 5, fill: '#DDE7FF' },
  { name: 'Capella', sub: 'Star &#183; Auriga', mag: '+0.08', alt: '71&#176;', az: 24, r: 5, fill: '#FFF0D2' },
  { name: 'Rigel', sub: 'Star &#183; Orion', mag: '+0.13', alt: '26&#176;', az: 61, r: 4.5, fill: '#DDE7FF' },
  { name: 'Betelgeuse', sub: 'Star &#183; Orion', mag: '+0.42', alt: '39&#176;', az: 47, r: 4.5, fill: '#FFC894' },
  { name: 'Arcturus', sub: 'Star &#183; Bo&#246;tes', mag: '&#8722;0.05', alt: '34&#176;', az: 268, r: 5, fill: '#FFD2A0' },
];

const row = (o, last) => `      <div style="display: flex; align-items: center; gap: 15px; padding: 15px 18px; ${last ? '' : 'border-bottom: 1px solid rgba(255, 255, 255, 0.06);'}">
        <span style="display: flex; align-items: center; justify-content: center; flex: 0 0 40px; width: 40px; height: 40px;">
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <circle cx="20" cy="20" r="${o.r + 6}" fill="${o.fill}" opacity="0.10"></circle>
            <circle cx="20" cy="20" r="${o.r}" fill="${o.fill}"></circle>
          </svg>
        </span>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0;">
          <span style="font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em;">${o.name}</span>
          <span style="font-size: 11.5px; color: rgba(238, 242, 248, 0.46);">${o.sub}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
          <span class="mono" style="font-size: 13px; color: rgba(238, 242, 248, 0.88);">${o.mag}</span>
          <span class="mono" style="font-size: 11px; color: rgba(238, 242, 248, 0.42);">alt ${o.alt}</span>
        </div>
        <span style="display: flex; align-items: center; justify-content: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.11);">
          <svg viewBox="0 0 24 24" width="24" height="24" style="transform: rotate(${o.az}deg);" aria-hidden="true">
            <path d="M12 5 L12 19 M12 5 L8.4 9 M12 5 L15.6 9" fill="none" stroke="{{accent}}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </span>
      </div>`;

const chip = (label, active) => `      <button type="button" style="height: 34px; padding: 0 15px; border-radius: 999px; font-family: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; ${active
  ? 'border: 0; background: {{accent}}; color: #06080E;'
  : 'border: 1px solid rgba(255, 255, 255, 0.13); background: transparent; color: rgba(238, 242, 248, 0.68);'}">${label}</button>`;

writeFileSync(`${OUT}/Tonight.dc.html`, `${HEAD}
<div class="frame">
  <div style="position: absolute; inset: 0; background: radial-gradient(120% 55% at 50% 0%, #0A1120 0%, #06090F 60%, #04060C 100%);"></div>
  <svg viewBox="0 0 390 844" width="390" height="844" style="position: absolute; inset: 0; display: block; opacity: 0.32;" aria-hidden="true">
    <g>
      ${SCATTER}
    </g>
  </svg>

  <div style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 60px 12px 0;">
    <div style="display: flex; align-items: center; gap: 6px; padding: 0 6px;">
      <button type="button" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -10px; padding: 0; border: 0; background: transparent; color: rgba(238, 242, 248, 0.75); cursor: pointer;">${ICONS.back}</button>
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <h1 style="margin: 0; font-size: 23px; font-weight: 600; letter-spacing: -0.02em;">Tonight</h1>
        <span class="mono" style="font-size: 11px; color: rgba(238, 242, 248, 0.42);">23:14 &#183; 12.97&#176;N 77.59&#176;E &#183; 24 visible</span>
      </div>
    </div>

    <div style="display: flex; gap: 8px; margin: 20px 0 14px; padding: 0 6px;">
${chip('All', true)}
${chip('Planets', false)}
${chip('Stars', false)}
${chip('Moon', false)}
    </div>

    <div class="glass" style="border-radius: 20px; overflow: hidden;">
${OBJECTS.map((o, i) => row(o, i === OBJECTS.length - 1)).join('\n')}
    </div>
  </div>

  <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 130px; background: linear-gradient(to top, #04060C 30%, rgba(4, 6, 12, 0));"></div>
${navbar('tonight')}
</div>
${TAIL(`{${ACCENT_PROP},${PREVIEW}}`, accentLogic())}`);

/* ------------------------------------------------------------------ *
 * canvas.json
 * ------------------------------------------------------------------ */

const GAP = 130;
const W = 390;
const H = 844;
const order = ['Permissions', 'Main', 'Selected', 'Settings', 'Tonight'];
writeFileSync(
  `${OUT}/canvas.json`,
  JSON.stringify(
    {
      artboards: order.map((name, i) => ({
        file: `${name}.dc.html`,
        x: i * (W + GAP),
        y: 0,
        w: W,
        h: H,
        title: {
          Permissions: '1 · Permission gate',
          Main: '2 · Sky view',
          Selected: '3 · Object selected',
          Settings: '4 · Settings',
          Tonight: '5 · Tonight',
        }[name],
      })),
      annotations: [
        {
          id: 'flow-note',
          x: 0,
          y: -150,
          w: 560,
          text:
            'StarGaze — sensor-driven sky AR.\nRead left to right: the gate collects GPS, clock and compass access, then every other screen is that data drawn back at you.\nAccent is a tweak (amber / cyan / white / coral) — amber is the default because it preserves dark adaptation.',
        },
      ],
      launch: { view: 'canvas' },
    },
    null,
    2
  ) + '\n'
);

console.log('wrote', [...order.map((n) => `${n}.dc.html`), 'canvas.json'].join(', '));
