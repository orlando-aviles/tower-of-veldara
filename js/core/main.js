import { initInput, onKeyOnce } from "./input.js";
import { createField } from "../field/field.js";
import { initCombatHud } from "../combat/combatHud.js";
import { shiftPrev, shiftNext } from "../systems/paradigms.js";
import { getGameState, setGameState, run, isBossDepth, players } from "./state.js";
import { startCombat, endCombat } from "../combat/combatCore.js";

initInput();
initCombatHud();

/* ─────────────────────────────────────
   FIELD HUD
───────────────────────────────────── */
function updateFieldHud() {
  const depthEl = document.getElementById("fieldDepth");
  const xpEl    = document.getElementById("fieldXP");
  if (!depthEl) return;
  depthEl.textContent = `Depth ${run.depth}${isBossDepth(run.depth) ? " ◈" : ""} · ${run.gold}g`;
  const p = players[0];
  xpEl.textContent = `${p.name} Lv${p.level} · ${p.xp}/${p.xpNext} XP`;
}
updateFieldHud();

/* ─────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById("fieldToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "fieldToast";
    el.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
      background:rgba(6,8,14,0.92); border:1px solid rgba(255,200,60,0.4);
      border-radius:10px; padding:9px 20px; font-size:12px;
      color:#ffd840; letter-spacing:.6px; z-index:55;
      opacity:0; transition:opacity .3s; pointer-events:none;
      font-family:'Courier New',monospace; text-align:center;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 2600);
}

/* ─────────────────────────────────────
   FIELD MENU
───────────────────────────────────── */
const fieldMenuEl  = document.getElementById("fieldMenu");
const fieldMenuBtn = document.getElementById("fieldMenuBtn");

function buildMenuParty() {
  const el = document.getElementById("fieldMenuParty");
  if (!el) return;
  el.innerHTML = players.map(p => `
    <div class="fmPartyRow">
      <span class="fmName">${p.name}</span>
      <span class="fmRole">${p.role}</span>
      <span class="fmStats">Lv${p.level} · HP${p.hp}/${p.maxHp} · ATK${p.atk} DEF${p.def}</span>
    </div>`).join("");
}

function openFieldMenu() {
  if (getGameState() !== "field") return;
  setGameState("menu");
  buildMenuParty();
  fieldMenuEl.classList.add("open");
}

function closeFieldMenu() {
  fieldMenuEl.classList.remove("open");
  setGameState("field");
}

fieldMenuBtn.addEventListener("click", () => {
  if (getGameState() === "field") openFieldMenu();
  else if (getGameState() === "menu") closeFieldMenu();
});

fieldMenuEl.addEventListener("click", e => {
  if (e.target === fieldMenuEl) closeFieldMenu();
});

document.getElementById("fieldMenuClose")?.addEventListener("click", closeFieldMenu);

addEventListener("keydown", e => {
  if (e.key === "Escape" && getGameState() === "menu") closeFieldMenu();
});

/* ─────────────────────────────────────
   DEPTH TRANSITION
───────────────────────────────────── */
const transEl     = document.getElementById("depthTransition");
const transTextEl = document.getElementById("depthTransitionText");

function doDepthTransition(newDepth, callback) {
  transTextEl.textContent = isBossDepth(newDepth)
    ? `Depth ${newDepth}  ◈  Warden approaches`
    : `Entering Depth ${newDepth}`;

  transEl.classList.add("fade-in");

  setTimeout(() => {
    run.depth = newDepth;
    updateFieldHud();
    if (callback) callback();

    setTimeout(() => {
      transEl.classList.remove("fade-in");
    }, 900);
  }, 500);
}

/* ─────────────────────────────────────
   FIELD
───────────────────────────────────── */
const field = createField({canvasId: "c"});

field.onEncounter = (boss) => {
  startCombat(boss);
  const poll = setInterval(() => {
    if (getGameState() === "field") {
      updateFieldHud();
      clearInterval(poll);
    }
  }, 200);
};

field.onKeyCollected = () => {
  showToast("Key obtained — the path forward is open");
};

field.onExit = () => {
  const nextDepth = run.depth + 1;
  doDepthTransition(nextDepth, () => {
    field.resetPortal();
  });
};

field.start();

/* ─────────────────────────────────────
   COMBAT CONTROLS
───────────────────────────────────── */
onKeyOnce("q", () => { if (getGameState() === "combat") shiftPrev(); });
onKeyOnce("e", () => { if (getGameState() === "combat") shiftNext(); });

document.getElementById("shiftPrev")?.addEventListener("click", () => {
  if (getGameState() === "combat") shiftPrev();
});
document.getElementById("shiftNext")?.addEventListener("click", () => {
  if (getGameState() === "combat") shiftNext();
});
document.getElementById("escapeCombat")?.addEventListener("click", () => {
  if (getGameState() === "combat") {
    endCombat();
    setTimeout(updateFieldHud, 50);
  }
});
