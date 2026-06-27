import { system } from "@minecraft/server";

const activeAnnoyers = new Map();
const ANNOY_INTERVAL_TICKS = 1;
const ANNOY_DISTANCE = 1.35;
let annoyStarted = false;

function isValidEntity(entity) {
  try {
    return !!entity?.isValid;
  } catch {
    return false;
  }
}

function getTargetLocation(target) {
  try {
    return target.getHeadLocation?.() ?? target.location ?? null;
  } catch {
    return null;
  }
}

function getTeleportLocation(target, side) {
  const loc = target?.location;
  if (!loc) return null;

  let yaw = 0;
  try {
    yaw = Number(target.getRotation?.().y ?? 0);
  } catch {}

  const radians = yaw * (Math.PI / 180);
  const forwardX = -Math.sin(radians);
  const forwardZ = Math.cos(radians);
  const direction = side === "front" ? 1 : -1;

  return {
    x: loc.x + forwardX * ANNOY_DISTANCE * direction,
    y: loc.y,
    z: loc.z + forwardZ * ANNOY_DISTANCE * direction,
  };
}

function tickAnnoy() {
  for (const [playerId, state] of activeAnnoyers.entries()) {
    const annoyer = state.player;
    if (!isValidEntity(annoyer)) {
      activeAnnoyers.delete(playerId);
      continue;
    }

    const targets = state.targets.filter((target) => isValidEntity(target) && target.id !== playerId);
    if (!targets.length) {
      activeAnnoyers.delete(playerId);
      continue;
    }

    state.targets = targets;
    state.index = (state.index + 1) % targets.length;

    const target = targets[state.index];
    const teleportLocation = getTeleportLocation(target, state.side);
    const facingLocation = getTargetLocation(target);
    if (!teleportLocation || !facingLocation) continue;

    try {
      annoyer.teleport(teleportLocation, {
        dimension: target.dimension,
        facingLocation,
      });
    } catch {}
  }
}

export function setAnnoyState(player, targets, side = "back") {
  const validTargets = Array.isArray(targets)
    ? targets.filter((target) => isValidEntity(target) && target.id !== player?.id)
    : [];

  if (!isValidEntity(player) || !validTargets.length) {
    activeAnnoyers.delete(player?.id);
    return false;
  }

  activeAnnoyers.set(player.id, {
    player,
    side: side === "front" ? "front" : "back",
    targets: validTargets,
    index: -1,
  });
  return true;
}

export function clearAnnoyState(player) {
  if (!player?.id) return false;
  return activeAnnoyers.delete(player.id);
}

export function startAnnoySystem() {
  if (annoyStarted) return;
  annoyStarted = true;
  system.runInterval(tickAnnoy, ANNOY_INTERVAL_TICKS);
}

startAnnoySystem();
