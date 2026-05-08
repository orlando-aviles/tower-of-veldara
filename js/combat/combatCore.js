import {
  players,
  enemy,
  resetEnemy,
  makeEnemyTemplate,
  setGameState,
  run,
  isBossDepth,
  awardXP,
} from "../core/state.js";

import {
  buildPartyHud,
  updateBars,
  updatePartyRoleLabels,
  logMsg,
  clearLog,
  updateParadigmHud,
  updateEnemyName,
  spawnFloatingNumber
} from "./combatHud.js";

import {
  initBattleStage,
  initBattleActors,
  startBattleRenderLoop,
  stopBattleRenderLoop,
  triggerAttackAnim,
  triggerEnemyHit,
  triggerStaggerZoom,
  getEnemyScreenPos,
  getPlayerScreenPos
} from "./battleStage.js";

import { applyParadigm } from "../systems/paradigms.js";


let battleOver = false;
let timer = null;
let isBossBattle = false;

// stagger impact freeze
let freezeTimer = 0;

function alive(){
  return players.filter(p=>p.hp>0);
}


/* =========================
CHAIN CONSTANTS
========================= */

const THRESHOLD = 350;
const FIRST_HIT_CHAIN = 100;

// Ravager chain gain pulled from enemy.chainGain per encounter
const BASE_DECAY_SPEED = 95;
const RAVAGER_ACCEL = 10;

const COMMANDO_STABILIZE = 92;
const MIN_DECAY_SPEED = 15;

const STAGGER_SECONDS = 20.0;
const STAGGER_BASE_MULT = 500;

const TICK_RATE = 0.1;


/* =========================
DAMAGE
========================= */

function damageEnemy(base){
  // stagger multiplier uses chain/100 when staggered (chain is elevated)
  const mult = enemy.staggered ? enemy.chain / 100 : 1;
  const raw  = base - enemy.def * 0.4;
  const dmg  = Math.max(1, Math.round(raw * mult));
  enemy.hp   = Math.max(0, enemy.hp - dmg);
  return dmg;
}

function damagePlayer(target, base){
  const dmg = Math.max(1, Math.round(base - target.def * 0.5));
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}


/* =========================
STAGGER
========================= */

function enterStagger(){

  enemy.staggered = true;
  enemy.chain = STAGGER_BASE_MULT;
  enemy.staggerTimer = STAGGER_SECONDS;

  triggerStaggerZoom();

  freezeTimer = 0.5;

  players.forEach(p=>{
    if(p.hp>0) p.atb = 100;
  });

  const pos = getEnemyScreenPos();

  spawnFloatingNumber("STAGGER!",pos.x,pos.y-40,"chain");

  logMsg("STAGGER!");

}


/* =========================
RAVAGER HIT
========================= */

function handleRavagerHit(){

  if(!enemy.staggered){

    if(enemy.chain===0){

      enemy.chain = FIRST_HIT_CHAIN;
      enemy.decaySpeed = enemy.decaySpeed || BASE_DECAY_SPEED;

    }else{

      enemy.chain += enemy.chainGain;
      enemy.decaySpeed += RAVAGER_ACCEL;

    }

    enemy.decay = enemy.chain;

    if(enemy.chain >= THRESHOLD){
      enterStagger();
    }

  }else{

    enemy.chain += 18;

  }

}


/* =========================
COMMANDO HIT
========================= */

function handleCommandoHit(){

  if(!enemy.staggered){

    if(enemy.chain < 100){

      enemy.chain = 100;

      if(enemy.decaySpeed===0){
        enemy.decaySpeed = enemy.decaySpeed || BASE_DECAY_SPEED;
      }

    }

    if(enemy.chain>0){

      enemy.decaySpeed = Math.max(
        MIN_DECAY_SPEED,
        enemy.decaySpeed - COMMANDO_STABILIZE
      );

      enemy.decay = enemy.chain;

    }

  }else{

    enemy.chain += 10;

  }

}


/* =========================
SENTINEL HIT  — guard-strike
Low chain contribution, best damage consistency,
slightly reduces incoming damage (handled via def bonus at role level)
========================= */

function handleSentinelHit(){

  if(!enemy.staggered){

    // Small chain push — keeps gauge alive but builds slowly
    if(enemy.chain === 0){
      enemy.chain = Math.floor(FIRST_HIT_CHAIN * 0.6);
      enemy.decaySpeed = enemy.decaySpeed || BASE_DECAY_SPEED;
    } else {
      enemy.chain += Math.floor(enemy.chainGain * 0.35);
    }

    // Strong stabilize — heavily slows decay
    enemy.decaySpeed = Math.max(
      MIN_DECAY_SPEED * 0.5,
      enemy.decaySpeed - COMMANDO_STABILIZE * 1.4
    );

    enemy.decay = enemy.chain;

  }else{

    enemy.chain += 8;

  }

}


/* =========================
CHAIN UPDATE
========================= */

function updateChain(){

  if(!enemy.staggered && enemy.chain>0){

    enemy.decay -= enemy.decaySpeed * TICK_RATE;

    if(enemy.decay > enemy.chain){
      enemy.decay = enemy.chain;
    }

    if(enemy.decay <= 0){

      enemy.chain = 0;
      enemy.decay = 0;
      enemy.decaySpeed = 0;

      logMsg("Chain dropped.");

    }

  }

  else if(enemy.staggered){

    enemy.staggerTimer -= TICK_RATE;

    if(enemy.staggerTimer <= 0){

      enemy.staggered = false;

      enemy.chain = 0;
      enemy.decay = 0;
      enemy.decaySpeed = 0;

      logMsg("Stagger ended.");

    }

  }

}


/* =========================
ROLE ACTION
========================= */

function roleAction(p,i){

  triggerAttackAnim(i);

  if(p.role==="Sentinel"){

    const dmg = damageEnemy(p.atk * 0.85);
    triggerEnemyHit();
    const pos = getEnemyScreenPos();
    spawnFloatingNumber(dmg, pos.x, pos.y, "damage");
    logMsg(`${p.name} [SEN] guard-strike → ${dmg}`);
    handleSentinelHit();

  }

  if(p.role==="Ravager"){

    const dmg = damageEnemy(p.atk * 0.75);
    triggerEnemyHit();
    const pos = getEnemyScreenPos();
    spawnFloatingNumber(dmg, pos.x, pos.y, "damage");
    logMsg(`${p.name} [RAV] rapid → ${dmg}  ⬡${Math.round(enemy.chain)}`);
    handleRavagerHit();

  }

  if(p.role==="Commando"){

    const dmg = damageEnemy(p.atk * 1.1);
    triggerEnemyHit();
    const pos = getEnemyScreenPos();
    spawnFloatingNumber(dmg, pos.x, pos.y, "damage");
    logMsg(`${p.name} [COM] strikes → ${dmg}`);
    handleCommandoHit();

  }

  if(p.role==="Medic"){

    const targets = players
      .filter(pl=>pl.hp>0)
      .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));

    if(targets.length>0){
      const t = targets[0];
      t.hp = Math.min(t.maxHp, t.hp + 30);
      const pos = getPlayerScreenPos(players.indexOf(t));
      spawnFloatingNumber("+30", pos.x, pos.y, "heal");
      logMsg(`${p.name} heals 30`);
    }

  }

}


/* =========================
BATTLE LOOP
========================= */

function loop(){

  if(battleOver) return;

  if(freezeTimer > 0){
    freezeTimer -= TICK_RATE;
    timer = setTimeout(loop,100);
    return;
  }

  players.forEach((p,i)=>{

    if(p.hp<=0) return;

    p.atb += p.atbRate * 1.6;

    if(p.atb >= 100){

      roleAction(p,i);

      p.atb = 0;

    }

  });

  enemy.atb += enemy.atbRate * 1.6;

  if(enemy.atb >= 100){

    const targets = alive();
    const t = targets[Math.floor(Math.random() * targets.length)];

    if(t){

      triggerAttackAnim(0,true);

      const special = enemy.boss && Math.random() < 0.25;
      const rawDmg  = Math.max(1, Math.round(enemy.atk - t.def * 0.5));
      const finalDmg = special ? Math.round(rawDmg * 1.7) : rawDmg;
      t.hp = Math.max(0, t.hp - finalDmg);

      const pos = getPlayerScreenPos(players.indexOf(t));
      spawnFloatingNumber(String(finalDmg), pos.x, pos.y, "damage");
      if(special) logMsg(`${enemy.name} unleashes a heavy strike!`);

    }

    enemy.atb = 0;

  }

  updateChain();
  updateBars();

  if(enemy.hp <= 0){

    battleOver = true;

    const baseXP  = isBossBattle
      ? (40 + run.depth * 6)
      : (12 + run.depth * 3);
    const gold    = isBossBattle
      ? (20 + run.depth * 8 + Math.floor(Math.random() * 15))
      : (4  + run.depth * 2 + Math.floor(Math.random() * 5));
    run.gold += gold;

    const xpLogs = awardXP(baseXP);

    logMsg(`Victory!  +${gold}g`);
    xpLogs.forEach(x => logMsg(x));

    if(isBossBattle){
      run.depth++;
      logMsg(`▸ Deeper into the labyrinth. Depth ${run.depth}.`);
    }

    setTimeout(endCombat, 1000);
    return;

  }

  if(alive().length === 0){

    battleOver = true;

    const penalty = Math.min(run.gold, Math.floor(run.gold * 0.2) + 1);
    run.gold = Math.max(0, run.gold - penalty);
    logMsg(`Defeat... (-${penalty}g)`);
    // Revive at low HP so the run can continue
    players.forEach(p => { if(p.hp <= 0) p.hp = Math.max(1, Math.floor(p.maxHp * 0.15)); });

    setTimeout(endCombat, 1000);
    return;

  }

  timer = setTimeout(loop,100);

}


/* =========================
START COMBAT
========================= */

export function startCombat(boss = false){

  isBossBattle = boss;

  setGameState("combat");

  document.getElementById("combatScene").style.display = "block";

  battleOver = false;

  clearLog();

  // Build enemy from roster based on current depth
  const template = makeEnemyTemplate(run.depth, boss);
  resetEnemy(template);

  players.forEach(p=>p.atb=0);

  buildPartyHud();

  initBattleStage();
  initBattleActors();

  startBattleRenderLoop();

  applyParadigm(0,{silent:true});

  updatePartyRoleLabels();
  updateParadigmHud();
  updateEnemyName();

  updateBars();

  const label = boss
    ? `⚠ ${enemy.name} blocks the path! [HP:${enemy.maxHp}]`
    : `Encounter! ${enemy.name} [HP:${enemy.maxHp} ATK:${Math.round(enemy.atk)}]`;
  logMsg(label);

  loop();

}


/* =========================
END COMBAT
========================= */

export function endCombat(){

  clearTimeout(timer);

  stopBattleRenderLoop();

  document.getElementById("combatScene").style.display = "none";

  setGameState("field");

}