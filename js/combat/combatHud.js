import { players, enemy, paradigms, getParadigmIndex } from "../core/state.js";

let logEl;
let partyHud;

const ui = {
  pHp: [],
  pAtb: [],
  pRole: [],
  enemyHp: null,
  enemyAtb: null,
  enemyChain: null,
  enemyName: null,
  staggerTag: null,
  combatFx: null
};

export function initCombatHud() {
  logEl = document.getElementById("log");
  partyHud = document.getElementById("partyHud");

  ui.enemyHp    = document.getElementById("enemy-hp");
  ui.enemyAtb   = document.getElementById("enemy-atb");
  ui.enemyChain = document.getElementById("enemy-chain");
  ui.enemyName  = document.querySelector(".enemyName");
  ui.staggerTag = document.getElementById("staggerTag");
  ui.combatFx   = document.getElementById("combatFx");
}

export function updateEnemyName() {
  if (!ui.enemyName) return;
  ui.enemyName.textContent = enemy.boss
    ? `◈ ${enemy.name}`
    : enemy.name;
}

export function spawnFloatingNumber(text, x, y, type = "damage") {
  if (!ui.combatFx) return;

  const el = document.createElement("div");
  el.className = `floatingNumber ${type}`;
  el.textContent = text;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  ui.combatFx.appendChild(el);

  setTimeout(() => el.remove(), 750);
}

export function logMsg(msg) {
  if (!logEl) return;

  const div = document.createElement("div");
  div.textContent = msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

export function clearLog() {
  if (!logEl) return;
  logEl.innerHTML = "";
}

export function buildPartyHud() {
  if (!partyHud) return;

  partyHud.innerHTML = "";

  ui.pHp = [];
  ui.pAtb = [];
  ui.pRole = [];

  players.forEach((p, i) => {

    const row = document.createElement("div");
    row.className = "unitRow";

    row.innerHTML = `
      <div class="rowTop">
        <div class="rowName">${p.name}</div>
        <div class="rowRole" id="p${i}-role">${p.role}</div>
      </div>

      <div class="rowBar hp">
        <div class="rowFill" id="p${i}-hp"></div>
      </div>

      <div class="rowBar atb">
        <div class="rowFill" id="p${i}-atb"></div>
      </div>
    `;

    partyHud.appendChild(row);

    ui.pHp[i] = row.querySelector(`#p${i}-hp`);
    ui.pAtb[i] = row.querySelector(`#p${i}-atb`);
    ui.pRole[i] = row.querySelector(`#p${i}-role`);

  });
}

export function updatePartyRoleLabels() {

  players.forEach((p, i) => {

    if (ui.pRole[i]) {
      ui.pRole[i].textContent = p.role;
    }

  });

}

export function updateBars() {

  players.forEach((p, i) => {

    if (ui.pHp[i]) {
      ui.pHp[i].style.width = `${(p.hp / p.maxHp) * 100}%`;
    }

    if (ui.pAtb[i]) {
      ui.pAtb[i].style.width = `${Math.min(p.atb, 100)}%`;
    }

  });

  if (ui.enemyHp) {
    ui.enemyHp.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  }

  if (ui.enemyAtb) {
    ui.enemyAtb.style.width = `${Math.min(enemy.atb, 100)}%`;
  }

  if (ui.enemyChain) {

    if (!enemy.staggered) {

      const THRESHOLD = 350;

      const pct = enemy.chain > 0
        ? Math.min(enemy.decay / THRESHOLD, 1) * 100
        : 0;

      ui.enemyChain.style.width = `${pct}%`;

    }

    else {

      const STAGGER_SECONDS = 20.0;

      const pct = Math.max(enemy.staggerTimer / STAGGER_SECONDS, 0) * 100;

      ui.enemyChain.style.width = `${pct}%`;

    }

  }

  if (ui.staggerTag) {
    ui.staggerTag.style.display = enemy.staggered ? "block" : "none";
  }

}

export function updateParadigmHud() {

  const title = document.getElementById("hudParadigmName");
  const roles = document.getElementById("hudParadigmRoles");

  const index = getParadigmIndex();
  const p = paradigms[index];

  if (!p) return;

  if (title) {
    title.textContent = `PARADIGM: ${p.name.toUpperCase()}`;
  }

  if (roles) {
    roles.textContent = p.roles
      .map(r => r.slice(0, 3).toUpperCase())
      .join(" / ");
  }

}