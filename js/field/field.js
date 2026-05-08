import { getGameState } from "../core/state.js";
import { getMovementAxis } from "../core/input.js";
import { run, isBossDepth } from "../core/state.js";

/* ─────────────────────────────────
   PIXEL SOLDIER SPRITE
   4×4 pixel art, Cross soldier palette:
   helmet/body = steel blue-grey, face = pale, boots = dark
   'T' = transparent
───────────────────────────────── */
const T = null;
const SOLDIER_SPRITE = [
  //  helm
  [ T,    '#4a6080', '#4a6080', T      ],
  //  face + helm sides
  [ '#4a6080', '#c8b89a', '#c8b89a', '#4a6080' ],
  //  torso (armour)
  [ '#3a5070', '#3a5070', '#3a5070', '#3a5070' ],
  //  boots / legs
  [ T,    '#222c3a', '#222c3a', T      ],
];
const PIXEL = 5;  // each pixel cell is 5 CSS px — matches field scale

function drawSoldier(ctx, x, y, flip = false) {
  const rows = SOLDIER_SPRITE.length;
  const cols = SOLDIER_SPRITE[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = SOLDIER_SPRITE[r][c];
      if (!col) continue;
      const dc = flip ? (cols - 1 - c) : c;
      ctx.fillStyle = col;
      ctx.fillRect(
        Math.round(x - (cols * PIXEL) / 2 + dc * PIXEL),
        Math.round(y - rows * PIXEL + r * PIXEL),
        PIXEL, PIXEL
      );
    }
  }
}

/* ─────────────────────────────────
   FIELD
───────────────────────────────── */
export function createField({canvasId = "c"} = {}) {

  const canvas = document.getElementById(canvasId);
  const ctx    = canvas.getContext("2d");

  const player = {
    x: innerWidth  * 0.5,
    y: innerHeight * 0.5,
    r: 10,
    speed: 220,
    facingLeft: false,
    moving: false,
  };

  /* ── ENCOUNTER SYSTEM ───────────────────────────
     Step-based: accumulate distance walked.
     Every STEPS_PER_CHECK steps we roll an encounter.
     MIN_COOLDOWN_STEPS prevents back-to-back fights.
  ─────────────────────────────────────────────── */
  const STEPS_PER_CHECK   = 90;   // roughly ~90 px walked between rolls
  const ENC_CHANCE_BASE   = 0.35; // base roll chance per check
  const MIN_COOLDOWN_STEPS= 160;  // minimum steps between any two encounters

  let stepsWalked    = 0;
  let stepsSinceLast = MIN_COOLDOWN_STEPS; // start ready
  let stepsToNext    = nextStepThreshold();

  function nextStepThreshold() {
    // Randomise the gap so it's not perfectly predictable
    return STEPS_PER_CHECK + Math.floor(Math.random() * STEPS_PER_CHECK * 0.6);
  }

  function tickEncounter(dx, dy) {
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return; // standing still = no encounters

    stepsWalked    += dist;
    stepsSinceLast += dist;

    if (stepsWalked >= stepsToNext) {
      stepsWalked  -= stepsToNext;
      stepsToNext   = nextStepThreshold();

      // Only roll if cooldown has passed
      if (stepsSinceLast >= MIN_COOLDOWN_STEPS) {
        const depthBonus = Math.min(0.15, run.depth * 0.015);
        if (Math.random() < ENC_CHANCE_BASE + depthBonus) {
          stepsSinceLast = 0;
          const boss = isBossDepth(run.depth);
          if (field.onEncounter) field.onEncounter(boss);
        }
      }
    }
  }

  /* ── KEY PICKUP ───────────────────────────────── */
  const key = {
    x: 0, y: 0, r: 12,
    collected: false,
    pulseT: 0,
  };

  function placeKey() {
    key.collected = false;
    key.pulseT = 0;
    // Put key in a different quadrant from portal
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.min(innerWidth, innerHeight) * (0.25 + Math.random() * 0.2);
    key.x = Math.max(40, Math.min(innerWidth  - 40, innerWidth  * 0.5 + Math.cos(angle) * dist));
    key.y = Math.max(40, Math.min(innerHeight - 40, innerHeight * 0.5 + Math.sin(angle) * dist));
  }

  /* ── EXIT PORTAL ──────────────────────────────── */
  const portal = {
    x: 0, y: 0, r: 24,
    pulseT: 0,
    active: true,
    locked: true,   // locked until key is collected
  };

  function placePortal() {
    portal.active = true;
    portal.locked = true;
    portal.pulseT = 0;
    // Pick a quadrant far from spawn center
    const margin = 80;
    const side = Math.floor(Math.random() * 4);
    const qx = [0.15, 0.7, 0.15, 0.7][side];
    const qy = [0.15, 0.15, 0.7, 0.7][side];
    portal.x = margin + qx * (innerWidth  - margin * 2) + (Math.random() - 0.5) * 60;
    portal.y = margin + qy * (innerHeight - margin * 2) + (Math.random() - 0.5) * 60;
    portal.x = Math.max(margin, Math.min(innerWidth  - margin, portal.x));
    portal.y = Math.max(margin, Math.min(innerHeight - margin, portal.y));
  }

  placePortal();
  placeKey();

  /* ── TREES (static decoration) ──────────────────── */
  const TREES = Array.from({length: 70}, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 6 + Math.random() * 12,
    g: 0.10 + Math.random() * 0.22,
  }));

  let last = performance.now();

  const field = {
    onEncounter: null,
    onExit:      null,
    start() { requestAnimationFrame(tick); },

    resetPortal() {
      player.x = innerWidth  * 0.5;
      player.y = innerHeight * 0.5;
      stepsWalked    = 0;
      stepsSinceLast = MIN_COOLDOWN_STEPS;
      stepsToNext    = nextStepThreshold();
      placePortal();
      placeKey();
    },
  };

  /* ── RESIZE ────────────────────────────────────── */
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(innerWidth  * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width  = innerWidth  + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", () => { resize(); placePortal(); placeKey(); });
  resize();

  /* ── DRAW HELPERS ──────────────────────────────── */
  function drawJoystick() {
    const joy = window.__joy;
    if (!joy || !joy.active) return;
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.arc(joy.baseX, joy.baseY, joy.max, 0, Math.PI * 2);
    ctx.strokeStyle = "#6a9cff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#6a9cff";
    ctx.beginPath();
    ctx.arc(joy.knobX, joy.knobY, joy.max * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }

  function drawKey(dt) {
    if (key.collected) return;
    key.pulseT = (key.pulseT + dt * 2.5) % (Math.PI * 2);
    const pulse = 0.6 + Math.sin(key.pulseT) * 0.4;

    // Outer glow
    const g = ctx.createRadialGradient(key.x, key.y, 0, key.x, key.y, key.r * 2.2 * pulse);
    g.addColorStop(0, "rgba(255,210,60,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(key.x, key.y, key.r * 2.2, 0, Math.PI * 2); ctx.fill();

    // Key body (simple pixel-ish shape)
    ctx.fillStyle = `rgba(255,200,40,${0.7 + pulse * 0.25})`;
    ctx.beginPath(); ctx.arc(key.x, key.y - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,180,20,${0.6 + pulse * 0.3})`;
    ctx.fillRect(key.x - 1, key.y + 4, 3, 8);
    ctx.fillRect(key.x + 1, key.y + 7, 3, 2);

    // Label
    ctx.fillStyle = "rgba(255,210,80,0.7)";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("KEY", key.x, key.y + key.r + 14);
    ctx.textAlign = "left";
  }

  function drawPortal(dt) {
    portal.pulseT = (portal.pulseT + dt * (portal.locked ? 0.8 : 1.8)) % (Math.PI * 2);
    const pulse = 0.7 + Math.sin(portal.pulseT) * 0.3;

    const color  = portal.locked ? "80,100,140" : "170,85,255";
    const colorB = portal.locked ? "40,60,100"  : "100,20,180";
    const alpha  = portal.locked ? 0.12 : 0.22;

    // Outer glow
    const outerR = portal.r * 2.6 * pulse;
    const glow = ctx.createRadialGradient(portal.x, portal.y, 0, portal.x, portal.y, outerR);
    glow.addColorStop(0, `rgba(${color},${alpha})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(portal.x, portal.y, outerR, 0, Math.PI * 2); ctx.fill();

    // Ring
    ctx.beginPath(); ctx.arc(portal.x, portal.y, portal.r, 0, Math.PI * 2);
    ctx.strokeStyle = portal.locked
      ? `rgba(100,130,180,${0.35 + pulse * 0.25})`
      : `rgba(200,130,255,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2.5; ctx.stroke();

    // Inner fill
    const inner = ctx.createRadialGradient(portal.x, portal.y, 0, portal.x, portal.y, portal.r * 0.85);
    inner.addColorStop(0, `rgba(${color},${portal.locked ? 0.15 : 0.45})`);
    inner.addColorStop(1, `rgba(${colorB},0.1)`);
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(portal.x, portal.y, portal.r * 0.85, 0, Math.PI * 2); ctx.fill();

    // Lock icon when locked
    if (portal.locked) {
      ctx.fillStyle = "rgba(100,140,200,0.6)";
      ctx.fillRect(portal.x - 5, portal.y - 2, 10, 9);
      ctx.strokeStyle = "rgba(100,140,200,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(portal.x, portal.y - 4, 5, Math.PI, 0);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = portal.locked
      ? "rgba(100,140,200,0.55)"
      : "rgba(220,180,255,0.75)";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(portal.locked ? "LOCKED" : "DEPTH ▸", portal.x, portal.y + portal.r + 14);
    ctx.textAlign = "left";
    ctx.lineWidth = 1;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // Forest BG
    const grd = ctx.createRadialGradient(
      innerWidth * .5, innerHeight * .5, 0,
      innerWidth * .5, innerHeight * .5, innerHeight * .8
    );
    grd.addColorStop(0, "#07100a");
    grd.addColorStop(1, "#020502");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, innerWidth, innerHeight);

    // Ground grid
    ctx.globalAlpha = 0.055; ctx.strokeStyle = "#2a6a38"; ctx.lineWidth = 1;
    const sp = 52;
    for (let x = 0; x <= innerWidth;  x += sp) { ctx.beginPath(); ctx.moveTo(x, 0);          ctx.lineTo(x, innerHeight); ctx.stroke(); }
    for (let y = 0; y <= innerHeight; y += sp) { ctx.beginPath(); ctx.moveTo(0, y);          ctx.lineTo(innerWidth, y);  ctx.stroke(); }
    ctx.globalAlpha = 1;

    // Trees
    TREES.forEach(t => {
      ctx.globalAlpha = t.g;
      ctx.fillStyle = "#1a5228";
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Integration haze
    if (run.depth >= 3) {
      const amt = Math.min(1, (run.depth - 2) / 10) * 0.22;
      const cr = ctx.createRadialGradient(
        innerWidth * .5, innerHeight * .5, innerHeight * .2,
        innerWidth * .5, innerHeight * .5, innerHeight
      );
      cr.addColorStop(0, "rgba(0,0,0,0)");
      cr.addColorStop(1, `rgba(90,10,160,${amt})`);
      ctx.fillStyle = cr; ctx.fillRect(0, 0, innerWidth, innerHeight);
    }

    // Key
    drawKey(dt);

    // Portal
    if (portal.active) drawPortal(dt);

    // Player shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, player.r * 0.9, player.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Player sprite
    drawSoldier(ctx, player.x, player.y, player.facingLeft);

    drawJoystick();
  }

  /* ── GAME LOOP ─────────────────────────────────── */
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (getGameState() === "field") {
      const axis = getMovementAxis();
      const vx = axis.x * player.speed * dt;
      const vy = axis.y * player.speed * dt;

      player.moving = Math.hypot(axis.x, axis.y) > 0.05;
      if (axis.x < -0.05) player.facingLeft = true;
      if (axis.x >  0.05) player.facingLeft = false;

      player.x = Math.max(player.r, Math.min(innerWidth  - player.r, player.x + vx));
      player.y = Math.max(player.r, Math.min(innerHeight - player.r, player.y + vy));

      // Step-based encounter
      if (player.moving) tickEncounter(vx, vy);

      // Key pickup
      if (!key.collected) {
        const dk = Math.hypot(player.x - key.x, player.y - key.y);
        if (dk < key.r + player.r) {
          key.collected = true;
          portal.locked = false;
          if (field.onKeyCollected) field.onKeyCollected();
        }
      }

      // Portal entry (unlocked only)
      if (portal.active && !portal.locked) {
        const dp = Math.hypot(player.x - portal.x, player.y - portal.y);
        if (dp < portal.r + player.r - 4) {
          portal.active = false;
          if (field.onExit) field.onExit();
        }
      }

      draw(dt);
    }

    requestAnimationFrame(tick);
  }

  return field;
}
