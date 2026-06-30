import { system } from "@minecraft/server";

const activeSlippery = new Map();
const SLIPPERY_INTERVAL_TICKS = 1;
let slipperyStarted = false;
const MIN_TRACK_SPEED = 0.025;
const BASE_GROUND_FRICTION = 0.992;
const BASE_AIR_FRICTION = 0.998;

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

function isOnGroundLike(entity) {
  try {
    if (typeof entity.isOnGround === "boolean") return entity.isOnGround;
  } catch {}
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tickSlippery() {
  for (const [playerId, state] of activeSlippery) {
    const entity = state.entity;
    if (!isValidEntity(entity)) {
      activeSlippery.delete(playerId);
      continue;
    }

    const velocity = getVelocity(entity);
    const onGround = isOnGroundLike(entity);
    const observedX = Number(velocity.x) || 0;
    const observedZ = Number(velocity.z) || 0;
    const observedSpeed = Math.hypot(observedX, observedZ);
    const carrySpeed = Math.hypot(state.carryX, state.carryZ);

    if (observedSpeed > Math.max(MIN_TRACK_SPEED, carrySpeed * 0.72)) {
      state.carryX = observedX;
      state.carryZ = observedZ;
    } else {
      const friction = onGround
        ? BASE_GROUND_FRICTION + clamp(carrySpeed * 0.01, 0, 0.0045)
        : BASE_AIR_FRICTION;
      state.carryX *= friction;
      state.carryZ *= friction;
    }

    const nextCarrySpeed = Math.hypot(state.carryX, state.carryZ);
    if (!(nextCarrySpeed > 0.01)) continue;

    const desiredX = state.carryX;
    const desiredZ = state.carryZ;
    const deltaX = desiredX - observedX;
    const deltaZ = desiredZ - observedZ;
    const maxPush = clamp(0.035 + nextCarrySpeed * 0.22, 0.035, 0.18);
    const pullFactor = onGround ? 0.85 : 0.3;
    const pushX = clamp(deltaX * pullFactor, -maxPush, maxPush);
    const pushZ = clamp(deltaZ * pullFactor, -maxPush, maxPush);

    if (Math.abs(pushX) < 0.001 && Math.abs(pushZ) < 0.001) continue;

    try {
      entity.applyImpulse?.({ x: pushX, y: 0, z: pushZ });
    } catch {}
  }
}

export function setSlipperyState(entity, enabled) {
  if (!isValidEntity(entity)) return false;

  if (!enabled) {
    return activeSlippery.delete(entity.id);
  }

  const velocity = getVelocity(entity);
  activeSlippery.set(entity.id, {
    entity,
    carryX: Number(velocity.x) || 0,
    carryZ: Number(velocity.z) || 0,
  });
  return true;
}

export function clearSlipperyState(entity) {
  return activeSlippery.delete(entity?.id);
}

export function startSlipperySystem() {
  if (slipperyStarted) return;
  slipperyStarted = true;
  system.runInterval(tickSlippery, SLIPPERY_INTERVAL_TICKS);
}

startSlipperySystem();
