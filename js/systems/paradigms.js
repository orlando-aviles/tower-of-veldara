import { players, paradigms, getParadigmIndex, setParadigmIndex } from "../core/state.js";
import { updatePartyRoleLabels, updateParadigmHud, logMsg } from "../combat/combatHud.js";

export function applyParadigm(index, {silent=false}={}) {
  const list = paradigms;
  const newIndex = ((index % list.length) + list.length) % list.length;
  setParadigmIndex(newIndex);

  const p = list[newIndex];

  players.forEach((plr, i) => {
    plr.role = p.roles[i] || "Commando";
  });

  updatePartyRoleLabels();
  updateParadigmHud();

  if (!silent) {
    logMsg(`Paradigm → ${p.name}`);
  }
}

export function shiftPrev() {
  applyParadigm(getParadigmIndex() - 1);
}

export function shiftNext() {
  applyParadigm(getParadigmIndex() + 1);
}
