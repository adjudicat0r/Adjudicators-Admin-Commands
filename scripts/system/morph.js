import { system } from "@minecraft/server";

const activeMorphs = new Map();
const MORPH_INTERVAL_TICKS = 1;
const INVIS_REFRESH_TICKS = 20;
let morphStarted = false;

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

function resolveEntityId(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;
  return text.startsWith("minecraft:") ? text : `minecraft:${text}`;
}

function getHealthState(entity) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return null;
    const max = Number(health.effectiveMax ?? health.defaultValue ?? 0);
    const current = Number(health.currentValue ?? 0);
    if (!(max > 0)) return null;
    return {
      component: health,
      current,
      max,
      ratio: Math.max(0, Math.min(1, current / max)),
    };
  } catch {
    return null;
  }
}

function setHealthByRatio(entity, ratio) {
  const state = getHealthState(entity);
  if (!state?.component) return false;
  const next = Math.max(0, Math.min(state.max, state.max * ratio));
  try {
    state.component.setCurrentValue(next);
    return true;
  } catch {
    return false;
  }
}

function setHealthAbsolute(entity, amount) {
  const state = getHealthState(entity);
  if (!state?.component) return false;
  const next = Math.max(0, Math.min(state.max, Number(amount) || 0));
  try {
    state.component.setCurrentValue(next);
    return true;
  } catch {
    return false;
  }
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

function syncMorphTransform(player, morphEntity) {
  const location = player.location;
  const rotation = player.getRotation?.() ?? { x: 0, y: 0 };
  if (!location) return;

  try {
    morphEntity.teleport(
      { x: location.x, y: location.y, z: location.z },
      {
        dimension: player.dimension,
        rotation,
      }
    );
  } catch {}

  try {
    morphEntity.setRotation?.(rotation);
  } catch {}
}

function clearMorphState(playerId, options = {}) {
  const state = activeMorphs.get(playerId);
  if (!state) return false;

  activeMorphs.delete(playerId);
  const player = state.player;
  const morphEntity = state.entity;

  if (options.killEntity !== false && isValidEntity(morphEntity)) {
    try {
      morphEntity.remove?.();
    } catch {}
  }

  if (isValidEntity(player)) {
    clearInvisible(player);
  }

  return true;
}

function stopMorphByDeath(state) {
  const player = state.player;
  clearMorphState(state.player.id, { killEntity: false });
  if (!isValidEntity(player)) return;

  const playerHealth = getHealthState(player);
  if (playerHealth?.component) {
    try {
      playerHealth.component.setCurrentValue(0);
    } catch {}
  }
}

function tickMorphs() {
  for (const [playerId, state] of activeMorphs) {
    const player = state.player;
    const morphEntity = state.entity;

    if (!isValidEntity(player)) {
      clearMorphState(playerId, { killEntity: true });
      continue;
    }

    if (!isValidEntity(morphEntity)) {
      stopMorphByDeath(state);
      continue;
    }

    if (player.dimension?.id !== morphEntity.dimension?.id) {
      try {
        morphEntity.teleport(player.location, { dimension: player.dimension });
      } catch {}
    }

    syncMorphTransform(player, morphEntity);

    state.tick = (state.tick ?? 0) + 1;
    if (state.tick % INVIS_REFRESH_TICKS === 0) {
      applyInvisible(player);
    }

    try {
      morphEntity.nameTag = String(player.nameTag ?? player.name ?? "");
    } catch {}

    const playerHealth = getHealthState(player);
    const morphHealth = getHealthState(morphEntity);
    if (!playerHealth || !morphHealth) {
      clearMorphState(playerId, { killEntity: true });
      continue;
    }

    if (morphHealth.current <= 0) {
      stopMorphByDeath(state);
      continue;
    }

    if (playerHealth.current <= 0) {
      clearMorphState(playerId, { killEntity: true });
      continue;
    }

    const lastPlayerRatio = Number.isFinite(state.lastPlayerRatio) ? state.lastPlayerRatio : playerHealth.ratio;
    const lastMorphRatio = Number.isFinite(state.lastMorphRatio) ? state.lastMorphRatio : morphHealth.ratio;
    const playerDelta = Math.abs(playerHealth.ratio - lastPlayerRatio);
    const morphDelta = Math.abs(morphHealth.ratio - lastMorphRatio);

    if (morphDelta > playerDelta + 0.001) {
      setHealthByRatio(player, morphHealth.ratio);
      state.lastPlayerRatio = morphHealth.ratio;
      state.lastMorphRatio = morphHealth.ratio;
      continue;
    }

    if (playerDelta > morphDelta + 0.001) {
      setHealthByRatio(morphEntity, playerHealth.ratio);
      state.lastPlayerRatio = playerHealth.ratio;
      state.lastMorphRatio = playerHealth.ratio;
      continue;
    }

    const sharedRatio = Math.min(playerHealth.ratio, morphHealth.ratio);
    setHealthByRatio(player, sharedRatio);
    setHealthByRatio(morphEntity, sharedRatio);
    state.lastPlayerRatio = sharedRatio;
    state.lastMorphRatio = sharedRatio;
  }
}

export function startMorphSystem() {
  if (morphStarted) return;
  morphStarted = true;
  system.runInterval(tickMorphs, MORPH_INTERVAL_TICKS);
}

export function setMorphState(player, rawEntityId) {
  if (!player?.id || typeof player?.name !== "string") {
    return { ok: false, error: "bad-player" };
  }

  const entityId = resolveEntityId(rawEntityId);
  if (!entityId) {
    return { ok: false, error: "bad-entity" };
  }

  clearMorphState(player.id, { killEntity: true });

  let morphEntity = null;
  try {
    morphEntity = player.dimension.spawnEntity(entityId, player.location);
  } catch {
    return { ok: false, error: "spawn-failed" };
  }

  if (!isValidEntity(morphEntity)) {
    return { ok: false, error: "spawn-failed" };
  }

  const playerHealth = getHealthState(player);
  const morphHealth = getHealthState(morphEntity);
  if (!playerHealth || !morphHealth) {
    try {
      morphEntity.remove?.();
    } catch {}
    return { ok: false, error: "no-health" };
  }

  try {
    morphEntity.nameTag = String(player.nameTag ?? player.name ?? "");
  } catch {}

  const sharedRatio = playerHealth.ratio;
  setHealthByRatio(morphEntity, sharedRatio);
  setHealthByRatio(player, sharedRatio);
  applyInvisible(player);
  syncMorphTransform(player, morphEntity);

  activeMorphs.set(player.id, {
    player,
    entity: morphEntity,
    entityId,
    tick: 0,
    lastPlayerRatio: sharedRatio,
    lastMorphRatio: sharedRatio,
  });

  return { ok: true, entityId };
}

export function clearMorphForPlayer(player) {
  return clearMorphState(player?.id, { killEntity: true });
}

startMorphSystem();
