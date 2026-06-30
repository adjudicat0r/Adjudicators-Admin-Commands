import { system } from "@minecraft/server";

const activeRopes = new Map();
const ROPE_INTERVAL_TICKS = 1;
const PARTICLE_ID = "minecraft:electric_spark_particle";
const PARTICLE_STEP = 0.5;
let ropeStarted = false;

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

function getEntityPoint(entity) {
  try {
    return entity.getHeadLocation?.() ?? entity.location ?? null;
  } catch {
    return null;
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

function makeRopeKey(firstId, secondId) {
  const a = String(firstId ?? "");
  const b = String(secondId ?? "");
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function clampLength(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0.5, Math.min(64, numeric));
}

function drawRope(dim, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!(distance > 0)) return;

  const steps = Math.max(1, Math.ceil(distance / PARTICLE_STEP));
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    try {
      dim.spawnParticle(PARTICLE_ID, {
        x: from.x + dx * t,
        y: from.y + dy * t,
        z: from.z + dz * t,
      });
    } catch {}
  }
}

function applyVectorPull(entity, vector, amount) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z) || 1;
  const unit = {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };

  try {
    entity.applyImpulse?.({
      x: unit.x * amount,
      y: unit.y * amount,
      z: unit.z * amount,
    });
    return true;
  } catch {}

  try {
    const horizontal = Math.hypot(unit.x, unit.z) || 1;
    entity.applyKnockback?.(
      { x: (unit.x / horizontal) * amount, z: (unit.z / horizontal) * amount },
      unit.y * amount
    );
    return true;
  } catch {}

  return false;
}

function getMomentumScore(entity, velocity) {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  const fallingBonus = velocity.y < -0.08 ? Math.abs(velocity.y) * 1.5 : 0;
  const groundedPenalty = isOnGroundLike(entity) ? 0.2 : 0;
  return speed + fallingBonus + groundedPenalty;
}

function tickRopes() {
  for (const [ropeKey, rope] of activeRopes) {
    const first = rope.first;
    const second = rope.second;

    if (!isValidEntity(first) || !isValidEntity(second)) {
      activeRopes.delete(ropeKey);
      continue;
    }

    if (first.id === second.id) {
      activeRopes.delete(ropeKey);
      continue;
    }

    if (first.dimension?.id !== second.dimension?.id) continue;

    const firstPoint = getEntityPoint(first);
    const secondPoint = getEntityPoint(second);
    if (!firstPoint || !secondPoint) continue;

    drawRope(first.dimension, firstPoint, secondPoint);

    const dx = secondPoint.x - firstPoint.x;
    const dy = secondPoint.y - firstPoint.y;
    const dz = secondPoint.z - firstPoint.z;
    const distance = Math.hypot(dx, dy, dz);
    if (!(distance > rope.length)) continue;

    const excess = distance - rope.length;
    const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
    const firstVelocity = getVelocity(first);
    const secondVelocity = getVelocity(second);
    const relativeVelocity = {
      x: secondVelocity.x - firstVelocity.x,
      y: secondVelocity.y - firstVelocity.y,
      z: secondVelocity.z - firstVelocity.z,
    };
    const separatingSpeed =
      relativeVelocity.x * direction.x +
      relativeVelocity.y * direction.y +
      relativeVelocity.z * direction.z;

    const totalForce = Math.min(
      0.55,
      0.02 + excess * 0.045 + Math.max(0, separatingSpeed) * 0.08
    );

    const firstMomentum = getMomentumScore(first, firstVelocity);
    const secondMomentum = getMomentumScore(second, secondVelocity);
    const totalMomentum = firstMomentum + secondMomentum;

    const forceOnFirst =
      totalMomentum > 0
        ? totalForce * (0.25 + 0.5 * (secondMomentum / totalMomentum))
        : totalForce * 0.5;
    const forceOnSecond =
      totalMomentum > 0
        ? totalForce * (0.25 + 0.5 * (firstMomentum / totalMomentum))
        : totalForce * 0.5;

    applyVectorPull(first, { x: dx, y: dy, z: dz }, forceOnFirst);
    applyVectorPull(second, { x: -dx, y: -dy, z: -dz }, forceOnSecond);
  }
}

export function setRopeState(first, second, length) {
  if (!first?.id || !second?.id || first.id === second.id) {
    return { ok: false, error: "bad-targets" };
  }

  const ropeLength = clampLength(length);
  if (ropeLength == null) {
    return { ok: false, error: "bad-length" };
  }

  if (!isValidEntity(first) || !isValidEntity(second)) {
    return { ok: false, error: "bad-targets" };
  }

  const key = makeRopeKey(first.id, second.id);
  const existing = activeRopes.get(key);
  if (existing) {
    existing.first = first;
    existing.second = second;
    existing.length = ropeLength;
    return { ok: true, updated: true, length: ropeLength };
  }

  activeRopes.set(key, {
    first,
    second,
    length: ropeLength,
  });
  return { ok: true, updated: false, length: ropeLength };
}

export function clearRopeState(first, second = null) {
  if (!first?.id) return 0;

  if (second?.id) {
    const key = makeRopeKey(first.id, second.id);
    return activeRopes.delete(key) ? 1 : 0;
  }

  let removed = 0;
  for (const [key, rope] of activeRopes) {
    if (rope.first?.id === first.id || rope.second?.id === first.id) {
      activeRopes.delete(key);
      removed++;
    }
  }
  return removed;
}

export function startRopeSystem() {
  if (ropeStarted) return;
  ropeStarted = true;
  system.runInterval(tickRopes, ROPE_INTERVAL_TICKS);
}

startRopeSystem();
