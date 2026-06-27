import { BlockPermutation, system, world } from "@minecraft/server";

const LIGHT_BLOCK_ID = "minecraft:light_block_15";
const activeGlows = new Map();
const glowBlocks = new Map();
let glowStarted = false;

function isValidEntity(entity) {
  try {
    return !!entity?.isValid;
  } catch {
    return false;
  }
}

function cloneBlockLoc(loc) {
  return {
    x: Math.floor(Number(loc?.x ?? 0)),
    y: Math.floor(Number(loc?.y ?? 0)),
    z: Math.floor(Number(loc?.z ?? 0)),
  };
}

function makeBlockKey(dimensionId, loc) {
  return `${dimensionId}:${loc.x}|${loc.y}|${loc.z}`;
}

function getDimensionById(dimId) {
  const s = String(dimId ?? "").toLowerCase();
  if (s.includes("nether")) return world.getDimension("nether");
  if (s.includes("end")) return world.getDimension("the_end");
  return world.getDimension("overworld");
}

function isAirBlock(block) {
  const typeId = String(block?.typeId ?? "");
  return typeId === "minecraft:air" || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}

function isOurLightBlock(block) {
  const typeId = String(block?.typeId ?? "");
  return typeId === LIGHT_BLOCK_ID || typeId === "minecraft:light_block" || typeId.startsWith("minecraft:light_block_");
}

function setLightBlock(dim, loc) {
  try {
    const block = dim.getBlock(loc);
    if (!block) return false;
    block.setPermutation(BlockPermutation.resolve(LIGHT_BLOCK_ID));
    return true;
  } catch {
    return false;
  }
}

function setAirBlock(dim, loc) {
  try {
    const block = dim.getBlock(loc);
    if (!block) return false;
    block.setPermutation(BlockPermutation.resolve("minecraft:air"));
    return true;
  } catch {
    return false;
  }
}

function getDesiredGlowKeys(entity) {
  const loc = entity?.location;
  const dimensionId = String(entity?.dimension?.id ?? "minecraft:overworld");
  if (!loc) return [];

  const positions = [
    cloneBlockLoc(loc),
    cloneBlockLoc({ x: loc.x, y: loc.y + 1, z: loc.z }),
  ];

  const dim = getDimensionById(dimensionId);
  const out = [];

  for (const pos of positions) {
    try {
      const block = dim.getBlock(pos);
      if (!block) continue;
      if (!isAirBlock(block) && !isOurLightBlock(block)) continue;
      out.push({
        key: makeBlockKey(dimensionId, pos),
        dimensionId,
        loc: pos,
      });
    } catch {}
  }

  return out;
}

function removeGlowClaim(targetId, key) {
  const entry = glowBlocks.get(key);
  if (!entry) return;

  entry.claims.delete(targetId);
  if (entry.claims.size > 0) return;

  const dim = getDimensionById(entry.dimensionId);
  try {
    const block = dim.getBlock(entry.loc);
    if (block && isOurLightBlock(block)) {
      setAirBlock(dim, entry.loc);
    }
  } catch {}

  glowBlocks.delete(key);
}

function addGlowClaim(targetId, blockRef) {
  const dim = getDimensionById(blockRef.dimensionId);
  let entry = glowBlocks.get(blockRef.key);

  if (!entry) {
    try {
      const block = dim.getBlock(blockRef.loc);
      if (!block) return false;
      if (!isAirBlock(block) && !isOurLightBlock(block)) return false;
      entry = {
        dimensionId: blockRef.dimensionId,
        loc: blockRef.loc,
        claims: new Set(),
      };
      glowBlocks.set(blockRef.key, entry);
    } catch {
      return false;
    }
  }

  entry.claims.add(targetId);
  setLightBlock(dim, blockRef.loc);
  return true;
}

function syncGlowTarget(state) {
  const entity = state.entity;
  if (!isValidEntity(entity)) {
    clearGlowStateById(state.id);
    return;
  }

  const desired = getDesiredGlowKeys(entity);
  const nextKeys = new Set(desired.map((entry) => entry.key));

  for (const key of state.blockKeys) {
    if (!nextKeys.has(key)) {
      removeGlowClaim(state.id, key);
      state.blockKeys.delete(key);
    }
  }

  for (const blockRef of desired) {
    if (state.blockKeys.has(blockRef.key)) continue;
    if (addGlowClaim(state.id, blockRef)) {
      state.blockKeys.add(blockRef.key);
    }
  }
}

function tickGlow() {
  for (const state of activeGlows.values()) {
    syncGlowTarget(state);
  }
}

function clearGlowStateById(targetId) {
  const state = activeGlows.get(targetId);
  if (!state) return false;

  activeGlows.delete(targetId);
  for (const key of state.blockKeys) {
    removeGlowClaim(targetId, key);
  }
  state.blockKeys.clear();
  return true;
}

export function setGlowState(target, enabled) {
  if (!target?.id) return false;

  if (!enabled) {
    return clearGlowStateById(target.id);
  }

  if (!isValidEntity(target)) return false;

  const existing = activeGlows.get(target.id);
  if (existing) {
    existing.entity = target;
    syncGlowTarget(existing);
    return true;
  }

  const state = {
    id: target.id,
    entity: target,
    blockKeys: new Set(),
  };
  activeGlows.set(target.id, state);
  syncGlowTarget(state);
  return true;
}

export function clearGlowState(target) {
  return clearGlowStateById(target?.id);
}

export function startGlowSystem() {
  if (glowStarted) return;
  glowStarted = true;
  system.runInterval(tickGlow, 1);
}

startGlowSystem();
