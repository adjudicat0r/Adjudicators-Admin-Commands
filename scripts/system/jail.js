import { BlockPermutation, system, world } from "@minecraft/server";

const activeJails = new Map();
const activeJailBlocks = new Map();
let jailTickerStarted = false;
let nextJailSessionId = 1;

function getDimensionById(dimId) {
  const s = String(dimId ?? "").toLowerCase();
  if (s.includes("nether")) return world.getDimension("nether");
  if (s.includes("end")) return world.getDimension("the_end");
  return world.getDimension("overworld");
}

function getPlayerById(playerId) {
  try {
    return world.getAllPlayers().find((p) => p.id === playerId) ?? null;
  } catch {
    return null;
  }
}

function cloneBlockLoc(loc) {
  return {
    x: Math.floor(Number(loc?.x ?? 0)),
    y: Math.floor(Number(loc?.y ?? 0)),
    z: Math.floor(Number(loc?.z ?? 0)),
  };
}

function makeBlockKey(loc) {
  return `${loc.x}|${loc.y}|${loc.z}`;
}

function makeDimBlockKey(dimensionId, loc) {
  return `${dimensionId}:${makeBlockKey(loc)}`;
}

function setBlockType(dim, loc, typeId) {
  try {
    const block = dim.getBlock(loc);
    if (!block) return false;
    block.setPermutation(BlockPermutation.resolve(typeId));
    return true;
  } catch {
    return false;
  }
}

function getLastClaimTypeId(claims) {
  let lastTypeId = null;
  for (const typeId of claims.values()) {
    lastTypeId = typeId;
  }
  return lastTypeId;
}

function addJailBlockClaim(session, dim, dimensionId, loc, typeId) {
  const locCopy = cloneBlockLoc(loc);
  const key = makeDimBlockKey(dimensionId, locCopy);
  let entry = activeJailBlocks.get(key);

  if (!entry) {
    try {
      const block = dim.getBlock(locCopy);
      if (!block) return;
      entry = {
        loc: locCopy,
        dimensionId,
        originalPermutation: block.permutation,
        claims: new Map(),
      };
      activeJailBlocks.set(key, entry);
    } catch {
      return;
    }
  }

  entry.claims.set(session.sessionId, typeId);
  session.claimKeys.push(key);
  setBlockType(dim, locCopy, typeId);
}

function buildJail(session, dim, dimensionId, baseLoc) {
  const placements = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      placements.push({
        loc: { x: baseLoc.x + dx, y: baseLoc.y, z: baseLoc.z + dz },
        typeId: "minecraft:obsidian",
      });
      placements.push({
        loc: { x: baseLoc.x + dx, y: baseLoc.y + 3, z: baseLoc.z + dz },
        typeId: "minecraft:obsidian",
      });

      const isWall = Math.abs(dx) === 1 || Math.abs(dz) === 1;
      if (isWall) {
        placements.push({
          loc: { x: baseLoc.x + dx, y: baseLoc.y + 1, z: baseLoc.z + dz },
          typeId: "minecraft:iron_bars",
        });
        placements.push({
          loc: { x: baseLoc.x + dx, y: baseLoc.y + 2, z: baseLoc.z + dz },
          typeId: "minecraft:iron_bars",
        });
      }
    }
  }

  placements.push({
    loc: { x: baseLoc.x, y: baseLoc.y + 1, z: baseLoc.z },
    typeId: "minecraft:air",
  });
  placements.push({
    loc: { x: baseLoc.x, y: baseLoc.y + 2, z: baseLoc.z },
    typeId: "minecraft:air",
  });

  for (const entry of placements) {
    addJailBlockClaim(session, dim, dimensionId, entry.loc, entry.typeId);
  }
}

function restoreJailBlocks(session) {
  const dim = getDimensionById(session.dimensionId);
  const claimKeys = Array.isArray(session?.claimKeys) ? session.claimKeys : [];

  for (const key of claimKeys) {
    const entry = activeJailBlocks.get(key);
    if (!entry) continue;

    entry.claims.delete(session.sessionId);

    if (entry.claims.size > 0) {
      const remainingTypeId = getLastClaimTypeId(entry.claims);
      if (remainingTypeId) {
        setBlockType(dim, entry.loc, remainingTypeId);
      }
      continue;
    }

    try {
      const block = dim.getBlock(entry.loc);
      if (!block) continue;
      block.setPermutation(entry.originalPermutation);
    } catch {}

    activeJailBlocks.delete(key);
  }
}

function stopJail(session, options = {}) {
  if (!session) return false;

  activeJails.delete(session.playerId);
  restoreJailBlocks(session);

  const player = getPlayerById(session.playerId);
  if (player && options.notify !== false) {
    try {
      player.sendMessage(options.message ?? "Jail time served.");
    } catch {}
  }

  return true;
}

function tickJails() {
  const now = Date.now();

  for (const session of activeJails.values()) {
    if (now >= session.expiresAt) {
      stopJail(session, { notify: true });
    }
  }
}

function ensureJailTicker() {
  if (jailTickerStarted) return;
  jailTickerStarted = true;
  system.runInterval(tickJails, 2);
}

function secondsToInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const out = Math.floor(n);
  return out > 0 ? out : null;
}

export function jailPlayer(target, seconds) {
  ensureJailTicker();

  const durationSeconds = secondsToInt(seconds);
  if (durationSeconds == null) {
    return { ok: false, error: "bad-seconds" };
  }

  const existing = activeJails.get(target.id);
  if (existing) stopJail(existing, { notify: false });

  const loc = target.location;
  const baseLoc = {
    x: Math.floor(loc.x),
    y: Math.floor(loc.y) - 1,
    z: Math.floor(loc.z),
  };
  const center = {
    x: baseLoc.x + 0.5,
    y: baseLoc.y + 1,
    z: baseLoc.z + 0.5,
  };

  const dimensionId = String(target.dimension?.id ?? "minecraft:overworld");
  const dim = getDimensionById(dimensionId);
  const session = {
    sessionId: nextJailSessionId++,
    playerId: target.id,
    dimensionId,
    center,
    expiresAt: Date.now() + durationSeconds * 1000,
    claimKeys: [],
  };

  buildJail(session, dim, dimensionId, baseLoc);

  try {
    target.teleport(center, { dimension: dim });
  } catch {}

  activeJails.set(target.id, session);
  return { ok: true, seconds: durationSeconds };
}
