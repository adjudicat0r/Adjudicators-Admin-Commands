import { BlockPermutation, system, world } from "@minecraft/server";

const activeJails = new Map();
let jailTickerStarted = false;

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

function saveBlock(saved, dim, loc) {
  const key = makeBlockKey(loc);
  if (saved.has(key)) return;

  try {
    const block = dim.getBlock(loc);
    if (!block) return;
    saved.set(key, {
      loc: cloneBlockLoc(loc),
      permutation: block.permutation,
    });
  } catch {}
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

function buildJail(dim, baseLoc) {
  const saved = new Map();
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
    saveBlock(saved, dim, entry.loc);
    setBlockType(dim, entry.loc, entry.typeId);
  }

  return Array.from(saved.values());
}

function restoreJailBlocks(session) {
  const dim = getDimensionById(session.dimensionId);
  const records = Array.isArray(session?.savedBlocks) ? session.savedBlocks : [];

  for (const record of records) {
    try {
      const block = dim.getBlock(record.loc);
      if (!block) continue;
      block.setPermutation(record.permutation);
    } catch {}
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
  const savedBlocks = buildJail(dim, baseLoc);

  try {
    target.teleport(center, { dimension: dim });
  } catch {}

  const session = {
    playerId: target.id,
    dimensionId,
    center,
    expiresAt: Date.now() + durationSeconds * 1000,
    savedBlocks,
  };

  activeJails.set(target.id, session);
  return { ok: true, seconds: durationSeconds };
}
