import { world } from "@minecraft/server";

export const RANK = {
  MEMBER: 1,
  VIP: 2,
  MOD: 3,
  ADMIN: 4,
  HEADADMIN: 5,
  OWNER: 6,
};

export function getPlayerRank(player) {
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
