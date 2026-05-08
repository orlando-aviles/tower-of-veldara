let gameState = "field";

export function setGameState(v) {
  gameState = v;
}

export function getGameState() {
  return gameState;
}

/* =========================
RUN STATE  (depth + progression)
========================= */
export const run = {
  depth: 1,
  gold:  0,
};

export function isBossDepth(d) {
  return d > 0 && d % 5 === 0;
}

export function xpNeeded(lv) {
  return Math.floor(30 + (lv - 1) * 18 + Math.pow(lv - 1, 1.25) * 6);
}

export function awardXP(amount) {
  const logs = [];
  players.forEach(p => {
    if (p.hp <= 0) return;
    p.xp += amount;
    logs.push(`${p.name} +${amount} XP`);
    while (p.xp >= p.xpNext) {
      p.xp    -= p.xpNext;
      p.level += 1;
      p.xpNext = xpNeeded(p.level);
      const hpG  = 8  + Math.floor(Math.random() * 5);
      const atkG = 2  + (Math.random() < 0.4 ? 1 : 0);
      const defG = 1  + (Math.random() < 0.3 ? 1 : 0);
      p.maxHp += hpG;
      p.hp     = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.25));
      p.atk   += atkG;
      p.def   += defG;
      logs.push(`★ ${p.name} → Lv${p.level}! +HP${hpG} +ATK${atkG} +DEF${defG}`);
    }
  });
  return logs;
}

/* =========================
PARTY  – Cross soldiers (prologue)
Roles: Sentinel · Commando · Ravager
No Medic / Synergist — Cross doctrine
========================= */
export const players = [
  { name:"Vane",   hp:120, maxHp:120, atb:0, atk:10, def:7,  level:1, xp:0, xpNext:30, role:"Sentinel",  atbRate:0.9 },
  { name:"Corvin", hp:100, maxHp:100, atb:0, atk:13, def:5,  level:1, xp:0, xpNext:30, role:"Commando",  atbRate:1.1 },
  { name:"Lira",   hp:90,  maxHp:90,  atb:0, atk:15, def:3,  level:1, xp:0, xpNext:30, role:"Ravager",   atbRate:1.3 },
];

/* =========================
ENEMY  (set by combat system each encounter)
========================= */
export const enemy = {
  name: "???",
  boss: false,
  hp: 100, maxHp: 100,
  atb: 0,  atbRate: 1.5,
  atk: 10, def: 3,

  // Chain system
  chain: 0,
  decay: 0,
  decaySpeed: 0,
  chainGain: 45,        // how much a Ravager hit adds
  staggered: false,
  staggerTimer: 0,
};

export function resetEnemy(template) {
  Object.assign(enemy, template);
  enemy.atb       = 0;
  enemy.chain     = 0;
  enemy.decay     = 0;
  enemy.decaySpeed= 0;
  enemy.staggered = false;
  enemy.staggerTimer = 0;
}

/* =========================
ENEMY ROSTER
========================= */
const ENEMY_TIERS = [
  // tier 0 — depths 1-2, normal forest
  { name:"Dire Wolf",           hp:60,  atk:9,  def:2, atbRate:1.4, chainGain:45, decaySpeed:95 },
  { name:"Forest Boar",         hp:80,  atk:7,  def:4, atbRate:1.2, chainGain:38, decaySpeed:80 },
  { name:"Thorn Crawler",       hp:50,  atk:10, def:1, atbRate:1.6, chainGain:52, decaySpeed:110},
  // tier 1 — depths 3-4, agitated
  { name:"Fevered Stag",        hp:90,  atk:11, def:3, atbRate:1.5, chainGain:42, decaySpeed:88 },
  { name:"Pallid Serpent",      hp:70,  atk:13, def:2, atbRate:1.7, chainGain:55, decaySpeed:70 },
  // tier 2 — depths 6-8, warped
  { name:"Glassback Hound",     hp:110, atk:14, def:4, atbRate:1.6, chainGain:48, decaySpeed:65 },
  { name:"Root Revenant",       hp:130, atk:12, def:6, atbRate:1.3, chainGain:40, decaySpeed:55 },
  { name:"Fracture Moth",       hp:90,  atk:16, def:2, atbRate:1.9, chainGain:60, decaySpeed:50 },
  // tier 3 — depths 9+, integration entities
  { name:"Void-Touched Bear",   hp:160, atk:18, def:7, atbRate:1.5, chainGain:45, decaySpeed:45 },
  { name:"Crystal Shard Wraith",hp:120, atk:20, def:5, atbRate:1.8, chainGain:65, decaySpeed:38 },
];

const TIER_RANGES = [[0,3],[3,5],[5,8],[8,10]];

const BOSS_TABLE = [
  { name:"Crystal Warden",      hp:300, atk:18, def:8,  atbRate:1.8, chainGain:50, decaySpeed:40 },
  { name:"The Fracture Bloom",  hp:450, atk:25, def:12, atbRate:1.9, chainGain:55, decaySpeed:30 },
  { name:"Void-Eye",            hp:600, atk:32, def:16, atbRate:2.0, chainGain:60, decaySpeed:22 },
];

function getTierIdx(d) {
  if (d <= 2) return 0;
  if (d <= 4) return 1;
  if (d <= 8) return 2;
  return 3;
}

export function makeEnemyTemplate(depth, boss = false) {
  if (boss) {
    const bi = Math.min(Math.floor((depth - 1) / 5), BOSS_TABLE.length - 1);
    const t  = BOSS_TABLE[bi];
    return {
      name: t.name, boss: true,
      hp:   t.hp  + depth * 20,
      atk:  t.atk + depth * 2,
      def:  t.def + Math.floor(depth * 0.8),
      atbRate:    t.atbRate,
      chainGain:  t.chainGain,
      decaySpeed: t.decaySpeed,
      maxHp: t.hp + depth * 20,
    };
  }
  const [lo, hi] = TIER_RANGES[Math.min(getTierIdx(depth), 3)];
  const pool = ENEMY_TIERS.slice(lo, hi);
  const t    = pool[Math.floor(Math.random() * pool.length)];
  const hp   = t.hp + depth * 8 + Math.floor(Math.random() * 20);
  return {
    name: t.name, boss: false,
    hp,   maxHp: hp,
    atk:  t.atk + depth * 1.4 + Math.floor(Math.random() * 4),
    def:  t.def + Math.floor(depth * 0.6) + Math.floor(Math.random() * 2),
    atbRate:    t.atbRate,
    chainGain:  t.chainGain,
    decaySpeed: t.decaySpeed,
  };
}

/* =========================
PARADIGMS  — Cross formations only
========================= */
export const paradigms = [
  { name:"Iron Wall",     roles:["Sentinel","Commando","Commando"] },
  { name:"Cross Assault", roles:["Commando","Commando","Ravager"]  },
  { name:"Storm Blade",   roles:["Commando","Ravager","Ravager"]   },
  { name:"Spearhead",     roles:["Sentinel","Commando","Ravager"]  },
];

let activeParadigmIndex = 0;

export function getParadigmIndex() {
  return activeParadigmIndex;
}

export function setParadigmIndex(i) {
  activeParadigmIndex = i;
}
