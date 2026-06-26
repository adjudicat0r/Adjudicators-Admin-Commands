
import { world } from "@minecraft/server";
import { getPlayerRank, parseRank } from "../storage/db.js";
































export function selectPlayers(executor, selectorText) {
  const allPlayers = world.getAllPlayers();
  const raw = String(selectorText ?? "me").trim();
  if (!raw) return [executor];

  
  const parts = splitTopLevelCommas(raw);
  if (parts.length > 1) {
    const out = new Set();
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      const isNeg = part.startsWith("!");
      if (isNeg) part = part.slice(1).trim();

      const matches = selectPlayersSingle(executor, part, allPlayers);

      if (isNeg) {
        for (const m of matches) out.delete(m);
      } else {
        for (const m of matches) out.add(m);
      }
    }
    return Array.from(out);
  }

  return selectPlayersSingle(executor, raw, allPlayers);
}



function selectPlayersSingle(executor, selectorText, allPlayers) {
  const sRaw = String(selectorText ?? "me").trim();
  const s = sRaw.toLowerCase();

  
  if (!s || s === "me" || s === "@s") return [executor];
  if (s === "all" || s === "@a") return allPlayers;
  if (s === "others") return allPlayers.filter((p) => p.name !== executor.name);

  
  if (s.startsWith("entity:")) {
    const rawTypes = sRaw.slice("entity:".length).trim();
    if (!rawTypes) return [];

    const dims = ["overworld", "nether", "the_end"];
    const out = [];

    if (rawTypes.toLowerCase().startsWith("random")) {
      const allEntities = [];
      for (const d of dims) {
        const dim = world.getDimension(d);
        for (const e of dim.getEntities()) {
          allEntities.push(e);
        }
      }

      let n = 1;
      const randomSuffix = rawTypes.slice("random".length).trim();
      if (randomSuffix.startsWith(":")) {
        const parsed = Number(randomSuffix.slice(1).trim());
        if (Number.isFinite(parsed) && parsed > 0) n = Math.floor(parsed);
      }

      if (allEntities.length === 0) return [];
      n = Math.max(1, Math.min(n, allEntities.length));

      const pool = allEntities.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, n);
    }

    if (rawTypes.toLowerCase() === "others") {
      for (const d of dims) {
        const dim = world.getDimension(d);
        for (const e of dim.getEntities()) {
          if (e !== executor) out.push(e);
        }
      }
      return out;
    }

    if (rawTypes.toLowerCase() === "all") {
      for (const d of dims) {
        const dim = world.getDimension(d);
        for (const e of dim.getEntities()) out.push(e);
      }
      return out;
    }

    const list = rawTypes
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (list.length === 0) return [];

    for (const d of dims) {
      const dim = world.getDimension(d);
      for (const e of dim.getEntities()) {
        const type = (e.typeId ?? "").toLowerCase();
        const suffix = type.includes(":") ? type.split(":")[1] : type;

        if (list.some((q) => q === type || q === suffix || type.endsWith(":" + q))) {
          out.push(e);
        }
      }
    }

    return out;
  }

  
  if (s === "random" || s === "@r" || s.startsWith("random:")) {
    if (allPlayers.length === 0) return [];

    let n = 1;
    if (s.startsWith("random:")) {
      const rawN = sRaw.slice("random:".length).trim();
      const parsed = Number(rawN);
      if (Number.isFinite(parsed) && parsed > 0) n = Math.floor(parsed);
    }

    n = Math.max(1, Math.min(n, allPlayers.length));

    const pool = allPlayers.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  
  if (s.startsWith('name:"') || s.startsWith("name:'")) {
    const exactName = parseQuotedAfterPrefix(sRaw, "name:");
    if (!exactName) return [];
    const key = exactName.toLowerCase();
    const found = allPlayers.find((p) => String(p.name ?? "").toLowerCase() === key);
    if (found) return [found];
    
    const byTag = findByNameTagExact(allPlayers, exactName);
    return byTag ? [byTag] : [];
  }

  
  if (s.startsWith("tag:")) {
    const tag = sRaw.slice(4).trim();
    if (!tag) return [];
    return allPlayers.filter((p) => {
      try {
        return p.hasTag(tag);
      } catch {
        return false;
      }
    });
  }

  
  if (s.startsWith("rank:")) {
    const rawRank = sRaw.slice(5).trim();
    const lvl = parseRank(rawRank);
    if (lvl == null) return [];
    return allPlayers.filter((p) => {
      try {
        return getPlayerRank(p) === lvl;
      } catch {
        return false;
      }
    });
  }

  
  if (s.startsWith("nonrank:")) {
    return allPlayers.filter((p) => {
      try {
        return getPlayerRank(p) === 1;
      } catch {
        return false;
      }
    });
  }

  
  if (s.startsWith("near:")) {
    const rest = sRaw.slice("near:".length).trim();
    const { radius, inner } = parseNear(rest);
    if (!(Number.isFinite(radius) && radius > 0)) return [];

    const base = allPlayers.filter((p) => withinRadius(executor, p, radius));
    if (!inner) return base;

    
    const innerMatches = selectPlayers(executor, inner);
    const innerSet = new Set(innerMatches);
    return base.filter((p) => innerSet.has(p));
  }

  
  if (s.startsWith("gm:")) {
    const want = parseGamemodeWord(sRaw.slice(3).trim());
    if (!want) return [];

    return allPlayers.filter((p) => {
      try {
        if (typeof p.getGameMode !== "function") return false;
        const gm = String(p.getGameMode() ?? "").toLowerCase();
        return gm.includes(want); 
      } catch {
        return false;
      }
    });
  }

  
  if (s.startsWith("hasprop:")) {
    const key = sRaw.slice("hasprop:".length).trim();
    if (!key) return [];
    return allPlayers.filter((p) => {
      try {
        const v = p.getDynamicProperty(key);
        return v !== undefined && v !== null;
      } catch {
        return false;
      }
    });
  }

  
  if (s.startsWith("prop:")) {
    const expr = sRaw.slice("prop:".length).trim();
    const { key, value, ok } = parsePropEquals(expr);
    if (!ok) return [];

    return allPlayers.filter((p) => {
      try {
        const v = p.getDynamicProperty(key);
        return deepEq(v, value);
      } catch {
        return false;
      }
    });
  }

  
  
  const exact = allPlayers.find((p) => String(p.name ?? "").toLowerCase() === s);
  if (exact) return [exact];

  
  const partialMatches = allPlayers
    .filter((p) => String(p.name ?? "").toLowerCase().includes(s))
    .sort((a, b) => {
      const la = String(a.name ?? "").length;
      const lb = String(b.name ?? "").length;
      if (la !== lb) return la - lb;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  if (partialMatches.length > 0) return [partialMatches[0]];

  
  const tagExact = findByNameTagExact(allPlayers, sRaw);
  if (tagExact) return [tagExact];

  
  const tagPartial = findByNameTagPartial(allPlayers, sRaw);
  if (tagPartial) return [tagPartial];

  return [];
}

function splitTopLevelCommas(s) {
  const out = [];
  let cur = "";
  let q = null; 

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === q) q = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x.length);
}

function parseQuotedAfterPrefix(raw, prefix) {
  
  const idx = raw.toLowerCase().indexOf(prefix);
  if (idx !== 0) return null;
  const rest = raw.slice(prefix.length).trim();
  if (!rest) return null;

  const quote = rest[0];
  if (quote !== '"' && quote !== "'") return null;

  const end = rest.indexOf(quote, 1);
  if (end <= 1) return null;
  return rest.slice(1, end);
}

function parseNear(rest) {
  
  
  
  const m = rest.match(/^(\d+(?:\.\d+)?)(?::(.*))?$/);
  if (!m) return { radius: NaN, inner: null };
  const radius = Number(m[1]);
  const inner = (m[2] ?? "").trim();
  return { radius, inner: inner.length ? inner : null };
}

function withinRadius(a, b, r) {
  try {
    const la = a.location ?? a.pos ?? null;
    const lb = b.location ?? b.pos ?? null;
    if (!la || !lb) return false;

    const dx = la.x - lb.x;
    const dy = la.y - lb.y;
    const dz = la.z - lb.z;
    return dx * dx + dy * dy + dz * dz <= r * r;
  } catch {
    return false;
  }
}

function parseGamemodeWord(v) {
  const s = normWord(v);
  if (!s) return null;
  if (s === "0" || s === "s" || s === "survival") return "survival";
  if (s === "1" || s === "c" || s === "creative") return "creative";
  if (s === "2" || s === "a" || s === "adventure") return "adventure";
  if (s === "3" || s === "sp" || s === "spec" || s === "spectator") return "spectator";
  return null;
}

function parsePropEquals(expr) {
  
  
  const eq = expr.indexOf("=");
  if (eq <= 0) return { ok: false };

  const key = expr.slice(0, eq).trim();
  let rawVal = expr.slice(eq + 1).trim();
  if (!key) return { ok: false };

  
  if (
    (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2) ||
    (rawVal.startsWith("'") && rawVal.endsWith("'") && rawVal.length >= 2)
  ) {
    rawVal = rawVal.slice(1, -1);
    return { ok: true, key, value: rawVal };
  }

  const low = rawVal.toLowerCase();
  if (low === "true") return { ok: true, key, value: true };
  if (low === "false") return { ok: true, key, value: false };

  const num = Number(rawVal);
  if (Number.isFinite(num) && rawVal !== "") return { ok: true, key, value: num };

  
  return { ok: true, key, value: rawVal };
}

function deepEq(a, b) {
  
  if (Number.isFinite(a) && Number.isFinite(b)) return Number(a) === Number(b);
  return a === b;
}

function normWord(s) {
  return String(s ?? "").toLowerCase().trim();
}

function stripFormatting(s) {
  
  return String(s ?? "").replace(/§./g, "");
}

function getNameTagStr(p) {
  try {
    const nt = p.nameTag;
    if (typeof nt === "string" && nt.length) return nt;
  } catch {}
  return "";
}

function findByNameTagExact(players, needleRaw) {
  const needle = stripFormatting(needleRaw).toLowerCase().trim();
  if (!needle) return null;

  for (const p of players) {
    const nt = stripFormatting(getNameTagStr(p)).toLowerCase().trim();
    if (nt && nt === needle) return p;
  }
  return null;
}

function findByNameTagPartial(players, needleRaw) {
  const needle = stripFormatting(needleRaw).toLowerCase().trim();
  if (!needle) return null;

  const matches = players
    .map((p) => ({ p, nt: stripFormatting(getNameTagStr(p)).toLowerCase().trim() }))
    .filter((x) => x.nt && x.nt.includes(needle))
    .sort((a, b) => {
      if (a.nt.length !== b.nt.length) return a.nt.length - b.nt.length;
      return a.nt.localeCompare(b.nt);
    });

  return matches.length ? matches[0].p : null;
}
