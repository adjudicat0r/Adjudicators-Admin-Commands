import { system } from "@minecraft/server";

const activeGravities = new Map();
let gravStarted = false;
const INPUT_SCALE = 0.01;

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

function clampStrength(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(-10, Math.min(10, numeric)) * INPUT_SCALE;
}

function applyVerticalForce(entity, amount) {
  try {
    entity.applyImpulse?.({ x: 0, y: -amount, z: 0 });
    return true;
  } catch {}

  try {
    entity.applyKnockback?.({ x: 0, z: 0 }, -amount);
    return true;
  } catch {}

  return false;
}

function tickGrav() {
  for (const [entityId, state] of activeGravities) {
    const entity = state.entity;
    if (!isValidEntity(entity)) {
      activeGravities.delete(entityId);
      continue;
    }

    applyVerticalForce(entity, state.amount);
  }
}

export function setGravState(target, amount) {
  if (!target?.id) return { ok: false, error: "bad-target" };

  const strength = clampStrength(amount);
  if (strength == null || strength === 0) {
    return { ok: false, error: "bad-amount" };
  }

  if (!isValidEntity(target)) {
    return { ok: false, error: "bad-target" };
  }

  const existing = activeGravities.get(target.id);
  if (existing) {
    existing.entity = target;
    existing.amount = strength;
    return { ok: true, updated: true, amount: strength };
  }

  activeGravities.set(target.id, {
    entity: target,
    amount: strength,
  });
  return { ok: true, updated: false, amount: strength };
}

export function clearGravState(target) {
  return activeGravities.delete(target?.id);
}

export function startGravSystem() {
  if (gravStarted) return;
  gravStarted = true;
  system.runInterval(tickGrav, 1);
}

startGravSystem();
