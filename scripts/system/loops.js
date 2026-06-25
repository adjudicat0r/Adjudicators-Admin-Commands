
import { system, world } from "@minecraft/server";

function getStringProp(p, key) {
  try {
    const v = p.getDynamicProperty(key);
    return typeof v === "string" && v.length ? v : null;
  } catch {
    return null;
  }
}

function getBoolProp(p, key) {
  try {
    return p.getDynamicProperty(key) === true;
  } catch {
    return false;
  }
}

function getNumberProp(p, key) {
  try {
    const v = p.getDynamicProperty(key);
    return Number.isFinite(v) ? Number(v) : null;
  } catch {
    return null;
  }
}

function dimIdToWorldKey(dimId) {
  const s = String(dimId ?? "").toLowerCase();
  if (s.includes("nether")) return "nether";
  if (s.includes("end")) return "the_end";
  return "overworld";
}


function handleTrail(p) {
  const particleId = getStringProp(p, "actrail");
  if (!particleId) return;

  const dim = p.dimension;
  const loc = p.location;

  try {
    dim.spawnParticle(particleId, { x: loc.x, y: loc.y + 0.2, z: loc.z });
  } catch {}
}


function handleBlind(p) {
  if (!getBoolProp(p, "acblinded")) return;

  try {
    p.runCommand?.(`camera @s fade time 0 1 0 color 0 0 0`);
  } catch {}
}
function handleNameTag(p) {
  const forced = getStringProp(p, "acname");
  if (!forced) return;

  try {
    p.nameTag = forced;
  } catch {}
}

function handleGod(p) {
  if (!getBoolProp(p, "acgod")) return;

  try {
    const health = p.getComponent("health");
    if (health) health.setCurrentValue(health.defaultValue);
  } catch {}

  try {
    p.extinguishFire?.();
  } catch {}
}


function handleLock(p) {
  if (!getBoolProp(p, "aclocked")) return;

  const x = getNumberProp(p, "aclockX");
  const y = getNumberProp(p, "aclockY");
  const z = getNumberProp(p, "aclockZ");
  if (x == null || y == null || z == null) return;

  const dimId = getStringProp(p, "aclockDim") ?? (p.dimension?.id ?? "");
  let dim = p.dimension;

  try {
    const wantKey = dimIdToWorldKey(dimId);
    const wantDim = world.getDimension(wantKey);
    if (wantDim) dim = wantDim;
  } catch {}

  try {
    p.teleport({ x, y, z }, { dimension: dim });
  } catch {}
}


function handleSpectate(viewer, playersByName) {
  if (!getBoolProp(viewer, "acspectating")) return;

  const targetName = getStringProp(viewer, "acspectateTarget");
  if (!targetName) return;

  const target = playersByName.get(targetName);
  if (!target) return;

  
  try {
    target.runCommand?.(
      `camera "${viewer.name}" set minecraft:free ease 0.2 linear pos ^^2^-3 facing @s`
    );
  } catch {}
}

const HANDLERS = [
  handleTrail,
  handleBlind,
  handleGod,
  handlePunish,
  handleLock,
  handleNameTag,
];

let damageHooked = false;
function hookGodDamageCancel() {
  if (damageHooked) return;
  damageHooked = true;

  try {
    world.beforeEvents.entityHurt.subscribe((ev) => {
      const hurt = ev.hurtEntity;
      if (!hurt || hurt.typeId !== "minecraft:player") return;
      try {
        if (hurt.getDynamicProperty("acgod") === true) ev.cancel = true;
      } catch {}
    });
  } catch {}
}

export function startLoops({ intervalTicks = 2 } = {}) {
  hookGodDamageCancel();

  system.runInterval(() => {
    const players = world.getAllPlayers();

    
    const byName = new Map();
    for (const p of players) byName.set(p.name, p);

    for (const p of players) {
      
      for (const fn of HANDLERS) {
        try {
          fn(p);
        } catch {}
      }

      
      try {
        handleSpectate(p, byName);
      } catch {}
    }
  }, intervalTicks);
}


function handlePunish(p) {
  if (!getBoolProp(p, "acpunished")) return;

  
  try {
    p.runCommand?.(`gamemode spectator @s`);
  } catch {}

  
  try {
    p.runCommand?.(`inputpermission set @s movement disabled`);
  } catch {}
}
