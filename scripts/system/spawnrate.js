
import { system, world } from "@minecraft/server";

const KEY = "acspawnrate_v1";

const CLONE_TAG = "ac_spawnrate_clone";
const SEEN_TAG = "ac_spawnrate_seen";


const SCAN_INTERVAL_TICKS = 5;      
const SCAN_RADIUS = 64;             
const MAX_SPAWNS_PER_TICK = 50;     
const MULTIPLY_UNKNOWN_CAUSE = true; 

function getMap() {
  try {
    return JSON.parse(world.getDynamicProperty(KEY) ?? "{}") || {};
  } catch {
    return {};
  }
}

function normalizeTypeId(typeId) {
  const s = String(typeId ?? "").toLowerCase().trim();
  if (!s) return null;
  return s.includes(":") ? s : `minecraft:${s}`;
}

function isClone(e) {
  try { return e.hasTag?.(CLONE_TAG) === true; } catch {}
  return false;
}
function isSeen(e) {
  try { return e.hasTag?.(SEEN_TAG) === true; } catch {}
  return false;
}
function markClone(e) {
  try { e.addTag?.(CLONE_TAG); } catch {}
}
function markSeen(e) {
  try { e.addTag?.(SEEN_TAG); } catch {}
}

function runMultiply(entity, map, spawnBudget) {
  if (!entity) return 0;
  if (isClone(entity)) return 0;
  if (isSeen(entity)) return 0;

  const typeId = normalizeTypeId(entity.typeId);
  if (!typeId) return 0;

  const mul = Math.floor(Number(map[typeId]));
  if (!Number.isFinite(mul) || mul <= 1) {
    
    markSeen(entity);
    return 0;
  }

  
  markSeen(entity);

  const dim = entity.dimension;
  const loc = entity.location;

  let spawned = 0;
  const want = mul - 1;

  for (let i = 0; i < want; i++) {
    if (spawned >= spawnBudget) break;
    try {
      const extra = dim.spawnEntity(typeId, loc);
      if (extra) {
        markClone(extra);
        markSeen(extra);
        spawned++;
        extra.runCommand("spreadplayers ~~ 0 20 @s")
      }
    } catch {
      
      break;
    }
  }

  return spawned;
}

function shouldTreatAsNatural(ev) {
  const c = String(ev?.cause ?? "").toLowerCase().trim();
  if (!c) return MULTIPLY_UNKNOWN_CAUSE;
  if (c.includes("natural")) return true;
  return MULTIPLY_UNKNOWN_CAUSE;
}

export function startSpawnRateSystem() {
  
  try {
    world.afterEvents.entitySpawn.subscribe((ev) => {
      try {
        if (!shouldTreatAsNatural(ev)) return;
        const map = getMap();
        runMultiply(ev.entity, map, 999999);
      } catch {}
    });
  } catch {}

  
  system.runInterval(() => {
    const map = getMap();
    const types = Object.keys(map);
    if (!types.length) return;

    const players = world.getAllPlayers();
    if (!players.length) return;

    let budget = MAX_SPAWNS_PER_TICK;

    
    const seenEntities = new Set();

    for (const pl of players) {
      if (budget <= 0) break;

      const dim = pl.dimension;
      const center = pl.location;

      for (const typeId of types) {
        if (budget <= 0) break;

        let ents = [];
        try {
          
          ents = dim.getEntities({
            type: typeId,
            location: center,
            maxDistance: SCAN_RADIUS,
          }) ?? [];
        } catch {
          continue;
        }

        for (const e of ents) {
          if (budget <= 0) break;

          
          const key = e?.id ?? e; 
          if (seenEntities.has(key)) continue;
          seenEntities.add(key);

          
          const spawned = runMultiply(e, map, budget);
          budget -= spawned;
        }
      }
    }
  }, SCAN_INTERVAL_TICKS);
}
