/**
 * First-run onboarding: explain, then ask.
 *
 * Three short steps layered over the live sky, which is already rendering
 * by the time this mounts -- a scrim, not a screen replacing it. See the
 * comment above requestEverything() in main.ts for why a consent wall in
 * front of an app nobody has seen yet was removed rather than kept and
 * softened: this does not bring it back. Skippable from every step, and
 * skipping asks for nothing -- drag mode already needs none of it.
 *
 * Runs once. main.ts only mounts this when stargaze.onboarded is unset;
 * every later launch goes straight to the sky as before.
 */

import { icons } from './ui.js';

export interface OnboardingOptions {
  /** Only a mobile-shaped device gets a camera row -- mirrors
   *  primaryPointerIsCoarse(), which gates the same thing in Settings. */
  showCamera: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

interface Step {
  body: string;
  actions: string;
}

const TRANSITION_MS = 220;

function buildSteps(showCamera: boolean): Step[] {
  const cameraRow = showCamera
    ? `<div class="perm">
        <span class="perm-icon">${icons.camera}</span>
        <span class="perm-text"><b>Camera</b><span>Optional — overlays stars on the real view behind them.</span></span>
      </div>`
    : '';

  return [
    {
      body: `
        <div class="wordmark">StarGaze</div>
        <h1>Point your phone at the sky.</h1>
        <p class="lede">It tells you what you're looking at — stars, planets, constellations — as you move, in real time.</p>
      `,
      actions: `<button class="primary" data-action="next" type="button">Next</button>`,
    },
    {
      body: `
        <h2>No photo needed.</h2>
        <p class="lede">Three things line the view up with the real sky, and none of them is a camera.</p>
        <div class="perms">
          <div class="perm">
            <span class="perm-icon">${icons.pin}</span>
            <span class="perm-text"><b>Your location</b><span>Tells what's visible from where you're standing.</span></span>
          </div>
          <div class="perm">
            <span class="perm-icon">${icons.compass}</span>
            <span class="perm-text"><b>Your compass</b><span>Tells which way the phone is pointed.</span></span>
          </div>
          <div class="perm">
            <span class="perm-icon">${icons.tonight}</span>
            <span class="perm-text"><b>The time</b><span>Positions shift by the second — this keeps them exact.</span></span>
          </div>
        </div>
      `,
      actions: `<button class="primary" data-action="next" type="button">Next</button>`,
    },
    {
      body: `
        <h2>Two quick permissions.</h2>
        <p class="lede">Both stay on this device. Nothing here is a photo, and nothing leaves the phone.</p>
        <div class="perms">
          <div class="perm">
            <span class="perm-icon">${icons.pin}</span>
            <span class="perm-text"><b>Location</b><span>So the sky lines up with the one above you, not Greenwich.</span></span>
          </div>
          <div class="perm">
            <span class="perm-icon">${icons.compass}</span>
            <span class="perm-text"><b>Motion &amp; compass</b><span>So the view turns with your phone instead of a drag.</span></span>
          </div>
          ${cameraRow}
        </div>
      `,
      actions: `
        <button class="primary" data-action="enable" type="button">Turn on location &amp; compass</button>
        <p class="footnote">You can change any of this later in Settings.</p>
      `,
    },
  ];
}

export function mountOnboarding(root: HTMLElement, options: OnboardingOptions): void {
  const steps = buildSteps(options.showCamera);
  let index = 0;

  const overlay = document.createElement('div');
  overlay.className = 'onboard';
  overlay.innerHTML = `
    <div class="onboard-card glass">
      <button class="onboard-skip" type="button">Skip</button>
      <div class="onboard-dots">${steps.map(() => '<span class="dot"></span>').join('')}</div>
      <div class="onboard-step" id="onboard-step"></div>
      <div class="onboard-actions" id="onboard-actions"></div>
    </div>
  `;
  root.appendChild(overlay);

  const stepEl = overlay.querySelector<HTMLElement>('#onboard-step')!;
  const actionsEl = overlay.querySelector<HTMLElement>('#onboard-actions')!;
  const dots = [...overlay.querySelectorAll<HTMLElement>('.dot')];

  const dismiss = (action: () => void): void => {
    overlay.style.transition = `opacity ${TRANSITION_MS}ms ease`;
    overlay.style.opacity = '0';
    window.setTimeout(() => overlay.remove(), TRANSITION_MS);
    action();
  };

  const paint = (): void => {
    const step = steps[index]!;
    dots.forEach((dot, i) => (dot.dataset.active = String(i === index)));
    stepEl.innerHTML = step.body;
    actionsEl.innerHTML = step.actions;

    actionsEl.querySelector('[data-action="next"]')?.addEventListener('click', () => goTo(index + 1));
    actionsEl.querySelector('[data-action="enable"]')?.addEventListener('click', () => dismiss(options.onEnable));
  };

  // Step swap: the old step drops out, the new one rises in from the same
  // offset -- one transition, reused for every step rather than a
  // different one per screen. See .onboard-step in styles.css.
  const goTo = (next: number): void => {
    if (next >= steps.length) return;
    stepEl.dataset.leaving = 'true';
    window.setTimeout(() => {
      index = next;
      paint();
      stepEl.dataset.entering = 'true';
      stepEl.dataset.leaving = 'false';
      void stepEl.offsetHeight; // force layout so the entering state above is actually seen before it's cleared
      requestAnimationFrame(() => {
        stepEl.dataset.entering = 'false';
      });
    }, TRANSITION_MS);
  };

  overlay.querySelector('.onboard-skip')?.addEventListener('click', () => dismiss(options.onSkip));

  paint();
}
