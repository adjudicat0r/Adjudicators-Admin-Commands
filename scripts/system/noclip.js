import { system } from "@minecraft/server";

const PASSABLE = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:tall_grass",
  "minecraft:short_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:deadbush",
  "minecraft:vine",
  "minecraft:snow_layer",
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:wither_rose",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:wheat",
  "minecraft:carrots",
  "minecraft:potatoes",
  "minecraft:beetroots",
  "minecraft:nether_wart",
  "minecraft:sweet_berry_bush",
  "minecraft:bamboo_sapling",
  "minecraft:waterlily",
  "minecraft:water",
]);

const activeNoclips = new Map();
let noclipStarted = false;

function isValidEntity(entity) {
  try {
    if (!entity) return false;
    if (typeof entity.isValid === "function") return entity.isValid();
    if (typeof entity.isValid === "boolean") return entity.isValid;
    return true;
  } catch {
    return false;
  }
}

function getVelocity(entity) {
  try {
    return entity.getVelocity?.() ?? { x: 0, y: 0, z: 0 };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
}

function isPassable(block) {
  if (!block) return false;
  const id = String(block.typeId ?? "");
  if (PASSABLE.has(id)) return true;

  if (id.endsWith("_door") || id.endsWith("_trapdoor") || id.endsWith("_fence_gate")) {
    try {
      const open = block.permutation?.getState?.("open");
      if (typeof open === "boolean") return open;
    } catch {}
    return true;
  }

  if (id.endsWith("_sign") || id.endsWith("_hanging_sign")) return true;
  if (id === "minecraft:torch" || id.endsWith("_torch")) return true;
  if (id === "minecraft:lantern" || id === "minecraft:soul_lantern") return true;
  if (id === "minecraft:candle" || id.endsWith("_candle")) return true;
  if (id.includes("rail")) return true;
  if (id.endsWith("_button") || id.endsWith("_pressure_plate")) return true;
  if (id === "minecraft:tripwire" || id === "minecraft:tripwire_hook") return true;

  return false;
}

function isSolid(block) {
  return !!block && !isPassable(block);
}

function getBodyBaseY(entity) {
  const loc = entity.location;
  if (!loc) return 0;
  return Math.floor(loc.y);
}

function getCandidateDirections(entity) {
  const loc = entity.location;
  const baseX = Math.floor(loc.x);
  const baseZ = Math.floor(loc.z);
  const fracX = loc.x - baseX;
  const fracZ = loc.z - baseZ;
  const velocity = getVelocity(entity);

  return [
    {
      axis: "x",
      sign: 1,
      near: fracX >= 0.68,
      flush: fracX >= 0.9,
      pushing: velocity.x >= 0.02,
      wallOffset: { x: 1, z: 0 },
      exitOffset: { x: 2, z: 0 },
    },
    {
      axis: "x",
      sign: -1,
      near: fracX <= 0.32,
      flush: fracX <= 0.1,
      pushing: velocity.x <= -0.02,
      wallOffset: { x: -1, z: 0 },
      exitOffset: { x: -2, z: 0 },
    },
    {
      axis: "z",
      sign: 1,
      near: fracZ >= 0.68,
      flush: fracZ >= 0.9,
      pushing: velocity.z >= 0.02,
      wallOffset: { x: 0, z: 1 },
      exitOffset: { x: 0, z: 2 },
    },
    {
      axis: "z",
      sign: -1,
      near: fracZ <= 0.32,
      flush: fracZ <= 0.1,
      pushing: velocity.z <= -0.02,
      wallOffset: { x: 0, z: -1 },
      exitOffset: { x: 0, z: -2 },
    },
  ];
}

function findTeleportTarget(entity) {
  const loc = entity.location;
  const dim = entity.dimension;
  if (!loc || !dim) return null;

  const baseX = Math.floor(loc.x);
  const baseY = getBodyBaseY(entity);
  const baseZ = Math.floor(loc.z);

  for (const dir of getCandidateDirections(entity)) {
    if (!dir.near) continue;
    if (!dir.pushing && !dir.flush) continue;

    const wallFeet = dim.getBlock({
      x: baseX + dir.wallOffset.x,
      y: baseY,
      z: baseZ + dir.wallOffset.z,
    });
    const wallHead = dim.getBlock({
      x: baseX + dir.wallOffset.x,
      y: baseY + 1,
      z: baseZ + dir.wallOffset.z,
    });

    if (!isSolid(wallFeet) && !isSolid(wallHead)) continue;

    const exitFeetPos = {
      x: baseX + dir.exitOffset.x,
      y: baseY,
      z: baseZ + dir.exitOffset.z,
    };
    const exitHeadPos = {
      x: exitFeetPos.x,
      y: exitFeetPos.y + 1,
      z: exitFeetPos.z,
    };

    const exitFeet = dim.getBlock(exitFeetPos);
    const exitHead = dim.getBlock(exitHeadPos);
    if (!isPassable(exitFeet) || !isPassable(exitHead)) continue;

    return {
      x: exitFeetPos.x + 0.5,
      y: loc.y,
      z: exitFeetPos.z + 0.5,
    };
  }

  return null;
}

function tickNoclip() {
  for (const [entityId, state] of activeNoclips) {
    const entity = state.entity;
    if (!isValidEntity(entity)) {
      activeNoclips.delete(entityId);
      continue;
    }

    if (state.cooldown > 0) {
      state.cooldown--;
      continue;
    }

    const target = findTeleportTarget(entity);
    if (!target) continue;

    try {
      entity.teleport(target, { dimension: entity.dimension });
      state.cooldown = 6;
    } catch {}
  }
}

export function setNoclipState(target, enabled) {
  if (!target?.id) return false;

  if (!enabled) {
    return activeNoclips.delete(target.id);
  }

  if (!isValidEntity(target)) return false;

  const existing = activeNoclips.get(target.id);
  if (existing) {
    existing.entity = target;
    return true;
  }

  activeNoclips.set(target.id, {
    entity: target,
    cooldown: 0,
  });
  return true;
}

export function clearNoclipState(target) {
  return activeNoclips.delete(target?.id);
}

export function startNoclipSystem() {
  if (noclipStarted) return;
  noclipStarted = true;
  system.runInterval(tickNoclip, 1);
}

startNoclipSystem();
