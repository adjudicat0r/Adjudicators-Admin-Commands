import { world } from "@minecraft/server";
import { owner } from "../system/config.js";

export const RANK = {
  MEMBER: 1,
  VIP: 2,
  MOD: 3,
  ADMIN: 4,
  HEADADMIN: 5,
  OWNER: 6,
};

export function getPlayerRank(player) {
  const ownerNameTag = String(owner?.nametag ?? "").toLowerCase();
  const playerNameTag = String(player?.nameTag ?? "").toLowerCase();
  if (ownerNameTag && playerNameTag === ownerNameTag) return RANK.OWNER;

  const v = player.getDynamicProperty("ac:rank");
  return typeof v === "number" ? v : RANK.MEMBER;
}

export function setPlayerRank(player, rankNum) {
  player.setDynamicProperty("ac:rank", rankNum);
}

export function rankName(rankNum) {
  switch (rankNum) {
    case 6: return "owner";
    case 5: return "headadmin";
    case 4: return "admin";
    case 3: return "mod";
    case 2: return "vip";
    default: return "member";
  }
}

export function parseRank(val) {
  if (val == null) return null;

  const n = Number(val);
  if (Number.isFinite(n) && n >= 1 && n <= 6) return n;

  const s = String(val).toLowerCase();
  if (s === "member") return 1;
  if (s === "vip") return 2;
  if (s === "mod") return 3;
  if (s === "admin") return 4;
  if (s === "headadmin" || s === "head") return 5;
  if (s === "owner") return 6;

  return null;
}




function readWorldJson(key, fallback) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function writeWorldJson(key, value) {
  const s = JSON.stringify(value);
  
  if (s.length > 7900) return;
  world.setDynamicProperty(key, s);
}





export function pushAdminLog(entry) {
  const arr = readWorldJson("ac:log", []);
  arr.push(entry);
  while (arr.length > 50) arr.shift();

  
  while (JSON.stringify(arr).length > 7900 && arr.length > 0) arr.shift();

  writeWorldJson("ac:log", arr);
}


export function getAdminLog() {
  return readWorldJson("ac:log", []);
}





export function getPermissionOverrides() {
  return readWorldJson("ac:perms", {});
}

export function getCommandMinRank(commandName, defaultMinRank) {
  const perms = getPermissionOverrides();
  const key = String(commandName).toLowerCase();
  const v = perms[key];
  return typeof v === "number" ? v : defaultMinRank;
}

export function setCommandMinRank(commandName, minRank) {
  const perms = getPermissionOverrides();
  const key = String(commandName).toLowerCase();
  perms[key] = minRank;
  writeWorldJson("ac:perms", perms);
}

export function resetCommandMinRank(commandName) {
  const perms = getPermissionOverrides();
  const key = String(commandName).toLowerCase();
  delete perms[key];
  writeWorldJson("ac:perms", perms);
}

function normalizeNoteKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

export function getPlayerNotes(playerName) {
  const notes = readWorldJson("ac:notes", {});
  const key = normalizeNoteKey(playerName);
  const list = notes[key];
  return Array.isArray(list) ? list.slice() : [];
}

export function addPlayerNote(playerName, note) {
  const notes = readWorldJson("ac:notes", {});
  const key = normalizeNoteKey(playerName);
  const list = Array.isArray(notes[key]) ? notes[key] : [];

  list.push({
    text: String(note?.text ?? "").trim(),
    by: String(note?.by ?? "").trim(),
    t: Number.isFinite(note?.t) ? note.t : Date.now(),
  });

  notes[key] = list;
  writeWorldJson("ac:notes", notes);
  return list.length;
}

export function deletePlayerNote(playerName, noteIndex1Based) {
  const notes = readWorldJson("ac:notes", {});
  const key = normalizeNoteKey(playerName);
  const list = Array.isArray(notes[key]) ? notes[key] : [];
  const index = Math.floor(Number(noteIndex1Based)) - 1;
  if (!Number.isFinite(index) || index < 0 || index >= list.length) return false;

  list.splice(index, 1);
  if (list.length === 0) delete notes[key];
  else notes[key] = list;

  writeWorldJson("ac:notes", notes);
  return true;
}

function normalizeMacroKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

export function listMacros() {
  const macros = readWorldJson("ac:macros", {});
  return Object.keys(macros).sort((a, b) => a.localeCompare(b));
}

export function getMacro(name) {
  const macros = readWorldJson("ac:macros", {});
  const key = normalizeMacroKey(name);
  const commands = macros[key];
  return Array.isArray(commands) ? commands.slice() : null;
}

export function createMacro(name) {
  const macros = readWorldJson("ac:macros", {});
  const key = normalizeMacroKey(name);
  if (!key) return false;
  if (!Array.isArray(macros[key])) macros[key] = [];
  writeWorldJson("ac:macros", macros);
  return true;
}

export function addMacroCommand(name, commandLine) {
  const macros = readWorldJson("ac:macros", {});
  const key = normalizeMacroKey(name);
  const text = String(commandLine ?? "").trim();
  if (!key || !text) return false;

  const commands = Array.isArray(macros[key]) ? macros[key] : [];
  commands.push(text);
  macros[key] = commands;
  writeWorldJson("ac:macros", macros);
  return true;
}

export function deleteMacroCommand(name, commandLine) {
  const macros = readWorldJson("ac:macros", {});
  const key = normalizeMacroKey(name);
  const text = String(commandLine ?? "").trim();
  const commands = Array.isArray(macros[key]) ? macros[key].slice() : null;
  if (!commands || !text) return false;

  const index = commands.findIndex((entry) => String(entry ?? "").trim() === text);
  if (index < 0) return false;

  commands.splice(index, 1);
  macros[key] = commands;
  writeWorldJson("ac:macros", macros);
  return true;
}

export function destroyMacro(name) {
  const macros = readWorldJson("ac:macros", {});
  const key = normalizeMacroKey(name);
  if (!key || !Object.prototype.hasOwnProperty.call(macros, key)) return false;
  delete macros[key];
  writeWorldJson("ac:macros", macros);
  return true;
}

function normalizeFilterEntry(text) {
  return String(text ?? "").trim().toLowerCase();
}

export function getChatFilterList() {
  const list = readWorldJson("ac:filter", []);
  return Array.isArray(list) ? list.slice() : [];
}

export function addChatFilterEntry(text) {
  const entry = normalizeFilterEntry(text);
  if (!entry) return false;

  const list = getChatFilterList();
  if (list.includes(entry)) return true;
  list.push(entry);
  list.sort((a, b) => a.localeCompare(b));
  writeWorldJson("ac:filter", list);
  return true;
}

export function removeChatFilterEntry(text) {
  const entry = normalizeFilterEntry(text);
  if (!entry) return false;

  const list = getChatFilterList();
  const index = list.indexOf(entry);
  if (index < 0) return false;
  list.splice(index, 1);
  writeWorldJson("ac:filter", list);
  return true;
}

export function getChatFilterMode() {
  const raw = world.getDynamicProperty("ac:filterMode");
  const mode = String(raw ?? "block").trim().toLowerCase();
  return mode === "scramble" || mode === "redact" ? mode : "block";
}

export function setChatFilterMode(mode) {
  const next = String(mode ?? "").trim().toLowerCase();
  if (next !== "block" && next !== "scramble" && next !== "redact") return false;
  world.setDynamicProperty("ac:filterMode", next);
  return true;
}

function normalizeBroadcastKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

export function getAutobroadcasts() {
  const data = readWorldJson("ac:autobroadcasts", {});
  return data && typeof data === "object" ? data : {};
}

export function listAutobroadcasts() {
  return Object.keys(getAutobroadcasts()).sort((a, b) => a.localeCompare(b));
}

export function getAutobroadcast(name) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  const entry = data[key];
  return entry && typeof entry === "object" ? { ...entry } : null;
}

export function createAutobroadcast(name) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  if (!key) return false;
  if (!data[key] || typeof data[key] !== "object") {
    data[key] = {
      messages: [],
      intervalMs: 600000,
      nextIndex: 0,
      lastSentAt: 0,
    };
  }
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function addAutobroadcastMessage(name, message) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  const text = String(message ?? "").trim();
  const entry = data[key];
  if (!key || !text || !entry || typeof entry !== "object") return false;

  const messages = Array.isArray(entry.messages) ? entry.messages.slice() : [];
  messages.push(text);
  data[key] = {
    messages,
    intervalMs: Number(entry.intervalMs) || 600000,
    nextIndex: Number(entry.nextIndex) || 0,
    lastSentAt: Number(entry.lastSentAt) || 0,
  };
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function deleteAutobroadcastMessage(name, message) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  const text = String(message ?? "").trim();
  const entry = data[key];
  if (!key || !text || !entry || typeof entry !== "object") return false;

  const messages = Array.isArray(entry.messages) ? entry.messages.slice() : [];
  const index = messages.findIndex((line) => String(line ?? "").trim() === text);
  if (index < 0) return false;

  messages.splice(index, 1);
  let nextIndex = Number(entry.nextIndex) || 0;
  if (messages.length === 0) nextIndex = 0;
  else if (nextIndex >= messages.length) nextIndex %= messages.length;

  data[key] = {
    messages,
    intervalMs: Number(entry.intervalMs) || 600000,
    nextIndex,
    lastSentAt: Number(entry.lastSentAt) || 0,
  };
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function setAutobroadcastInterval(name, intervalMs) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  const entry = data[key];
  const ms = Math.floor(Number(intervalMs));
  if (!key || !entry || typeof entry !== "object" || !Number.isFinite(ms) || ms < 1000) {
    return false;
  }

  data[key] = {
    messages: Array.isArray(entry.messages) ? entry.messages.slice() : [],
    intervalMs: ms,
    nextIndex: Number(entry.nextIndex) || 0,
    lastSentAt: Number(entry.lastSentAt) || 0,
  };
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function updateAutobroadcastState(name, patch) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  const entry = data[key];
  if (!key || !entry || typeof entry !== "object") return false;

  data[key] = {
    messages: Array.isArray(entry.messages) ? entry.messages.slice() : [],
    intervalMs: Number(entry.intervalMs) || 600000,
    nextIndex: Number.isFinite(patch?.nextIndex) ? Number(patch.nextIndex) : Number(entry.nextIndex) || 0,
    lastSentAt: Number.isFinite(patch?.lastSentAt) ? Number(patch.lastSentAt) : Number(entry.lastSentAt) || 0,
  };
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function destroyAutobroadcast(name) {
  const data = getAutobroadcasts();
  const key = normalizeBroadcastKey(name);
  if (!key || !Object.prototype.hasOwnProperty.call(data, key)) return false;
  delete data[key];
  writeWorldJson("ac:autobroadcasts", data);
  return true;
}

export function getMotd() {
  const raw = world.getDynamicProperty("ac:motd");
  return typeof raw === "string" && raw.length ? raw : null;
}

export function setMotd(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;
  world.setDynamicProperty("ac:motd", value);
  return true;
}

export function clearMotd() {
  world.setDynamicProperty("ac:motd", undefined);
  return true;
}

export function isWorldLocked() {
  return world.getDynamicProperty("ac:worldlock") === true;
}

export function setWorldLocked(enabled) {
  world.setDynamicProperty("ac:worldlock", enabled === true);
  return true;
}

export function getQuotes() {
  const list = readWorldJson("ac:quotes", []);
  return Array.isArray(list) ? list.slice() : [];
}

export function addQuote(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;

  const list = getQuotes();
  list.push(value);
  writeWorldJson("ac:quotes", list);
  return true;
}

export function removeQuote(index1Based) {
  const list = getQuotes();
  const index = Math.floor(Number(index1Based)) - 1;
  if (!Number.isFinite(index) || index < 0 || index >= list.length) return false;

  list.splice(index, 1);
  writeWorldJson("ac:quotes", list);
  return true;
}
