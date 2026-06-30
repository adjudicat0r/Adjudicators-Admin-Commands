import { system } from "@minecraft/server";

const activeControls = new Map();
const targetControllers = new Map();
const CONTROL_INTERVAL_TICKS = 1;
const INVIS_REFRESH_TICKS = 20;
let controlStarted = false;

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

function getHealthState(entity) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return null;
    const max = Number(health.effectiveMax ?? health.defaultValue ?? 0);
    const current = Number(health.currentValue ?? 0);
    if (!(max > 0)) return null;
    return { component: health, current, max };
  } catch {
    return null;
  }
}

function isDead(entity) {
  const health = getHealthState(entity);
  return !!health && health.current <= 0;
}

function applyInvisible(player) {
  try {
    player.runCommand?.("effect @s invisibility 2 0 true");
  } catch {}
}

function clearInvisible(player) {
  try {
    player.runCommand?.("effect @s invisibility 0");
  } catch {}
}

function syncControlTransform(controller, target) {
  const location = controller.location;
  const rotation = controller.getRotation?.() ?? { x: 0, y: 0 };
  if (!location) return;

  try {
    target.teleport(
      { x: location.x, y: location.y, z: location.z },
      {
        dimension: controller.dimension,
        rotation,
      }
    );
  } catch {}

  try {
    target.setRotation?.(rotation);
  } catch {}
}

function clearControlState(controllerId) {
  const state = activeControls.get(controllerId);
  if (!state) return false;

  activeControls.delete(controllerId);
  targetControllers.delete(state.target.id);

  if (isValidEntity(state.controller)) {
    clearInvisible(state.controller);
  }

  return true;
}

function tickControls() {
  for (const [controllerId, state] of activeControls) {
    const controller = state.controller;
    const target = state.target;

    if (!isValidEntity(controller)) {
      clearControlState(controllerId);
      continue;
    }

    if (!isValidEntity(target) || isDead(target)) {
      clearControlState(controllerId);
      try {
        controller.sendMessage("Control ended.");
      } catch {}
      continue;
    }

    state.tick = (state.tick ?? 0) + 1;
    if (state.tick % INVIS_REFRESH_TICKS === 0) {
      applyInvisible(controller);
    }

    if (controller.dimension?.id !== target.dimension?.id) {
      try {
        target.teleport(controller.location, { dimension: controller.dimension });
      } catch {}
    }

    syncControlTransform(controller, target);
  }
}

export function startControlSystem() {
  if (controlStarted) return;
  controlStarted = true;
  system.runInterval(tickControls, CONTROL_INTERVAL_TICKS);
}

export function setControlState(controller, target) {
  if (!controller?.id || typeof controller?.name !== "string") {
    return { ok: false, error: "bad-controller" };
  }
  if (!target?.id || target.id === controller.id) {
    return { ok: false, error: "bad-target" };
  }
  if (!isValidEntity(controller) || !isValidEntity(target)) {
    return { ok: false, error: "bad-target" };
  }

  const existingControllerId = targetControllers.get(target.id);
  if (existingControllerId && existingControllerId !== controller.id) {
    return { ok: false, error: "already-controlled" };
  }

  try {
    const targetLocation = target.location;
    const targetRotation = target.getRotation?.() ?? { x: 0, y: 0 };
    if (targetLocation) {
      controller.teleport(
        { x: targetLocation.x, y: targetLocation.y, z: targetLocation.z },
        {
          dimension: target.dimension,
          rotation: targetRotation,
        }
      );
    }
  } catch {}

  clearControlState(controller.id);

  activeControls.set(controller.id, {
    controller,
    target,
    tick: 0,
  });
  targetControllers.set(target.id, controller.id);

  applyInvisible(controller);
  syncControlTransform(controller, target);
  return { ok: true };
}

export function clearControlForController(controller) {
  return clearControlState(controller?.id);
}

startControlSystem();
