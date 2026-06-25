
import { BlockPermutation } from "@minecraft/server";

const KEY_BASE = "btools_history_v1_";
const PAGES = 36;       
const PAGE_SIZE = 8000; 
const MAX_ACTIONS = 10;

function readAll(player) {
  let out = "";
  for (let i = 0; i < PAGES; i++) {
    const part = player.getDynamicProperty(KEY_BASE + i);
    if (typeof part === "string" && part.length) out += part;
  }
  return out;
}

function writeAll(player, s) {
  
  if (s.length > PAGES * PAGE_SIZE) return false;

  for (let i = 0; i < PAGES; i++) {
    const start = i * PAGE_SIZE;
    const chunk = s.slice(start, start + PAGE_SIZE);
    player.setDynamicProperty(KEY_BASE + i, chunk);
  }
  return true;
}

function loadHistory(player) {
  const raw = readAll(player);
  if (!raw) return { undo: [], redo: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.undo) || !Array.isArray(parsed.redo)) {
      return { undo: [], redo: [] };
    }
    return parsed;
  } catch {
    return { undo: [], redo: [] };
  }
}

function saveHistory(player, hist) {
  try {
    return writeAll(player, JSON.stringify(hist));
  } catch {
    return false;
  }
}

export function pushAction(player, action) {
  const hist = loadHistory(player);
  hist.undo.push(action);
  if (hist.undo.length > MAX_ACTIONS) hist.undo.shift();
  hist.redo = [];
  return saveHistory(player, hist);
}

function resolvePerm(snapshot) {
  return BlockPermutation.resolve(snapshot.typeId, snapshot.states ?? {});
}

function applySnapshotToBlock(dim, pos, snap) {
  const b = dim.getBlock(pos);
  if (!b) return false;

  try {
    if (b.typeId !== snap.typeId) b.setType(snap.typeId);
  } catch {
    return false;
  }

  try {
    b.setPermutation(resolvePerm(snap));
    return true;
  } catch {
    return false;
  }
}

export function undoLast(player) {
  const hist = loadHistory(player);
  const action = hist.undo.pop();
  if (!action) return { ok: false, msg: "Nothing to undo." };

  const dim = player.dimension; 
  let changed = 0;

  for (const e of action.blocks ?? []) {
    if (applySnapshotToBlock(dim, { x: e.x, y: e.y, z: e.z }, e.before)) changed++;
  }

  hist.redo.push(action);
  saveHistory(player, hist);
  return { ok: true, msg: `Undid ${changed} block(s).` };
}

export function redoLast(player) {
  const hist = loadHistory(player);
  const action = hist.redo.pop();
  if (!action) return { ok: false, msg: "Nothing to redo." };

  const dim = player.dimension;
  let changed = 0;

  
  
  const sharedAfter = action.after;

  for (const e of action.blocks ?? []) {
    const snap = e.after ?? sharedAfter;
    if (!snap) continue;
    if (applySnapshotToBlock(dim, { x: e.x, y: e.y, z: e.z }, snap)) changed++;
  }

  hist.undo.push(action);
  if (hist.undo.length > MAX_ACTIONS) hist.undo.shift();
  saveHistory(player, hist);
  return { ok: true, msg: `Redid ${changed} block(s).` };
}
