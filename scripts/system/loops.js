
import { EntityDamageCause, EquipmentSlot, system, world } from "@minecraft/server";

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

function getItemByHand(p) {
  try {
    const equippable = p.getComponent("minecraft:equippable");
    return equippable?.getEquipment?.(EquipmentSlot.Mainhand) ?? null;
  } catch {
    return null;
  }
}

function getEnchantLevel(item, enchantmentType) {
  try {
    const enchantable = item?.getComponent?.("minecraft:enchantable");
    if (!enchantable) return 0;
    const enchant = enchantable.getEnchantment?.(enchantmentType);
    return Number(enchant?.level ?? 0) || 0;
  } catch {
    return 0;
  }
}

function getKillauraProfile(p) {
  const item = getItemByHand(p);
  if (!item) {
    return {
      damage: 1,
      knockback: 0.25,
      fireSeconds: 0,
    };
  }

  const typeId = String(item.typeId ?? "").toLowerCase();
  let base = 1;

  if (typeId.includes("_sword")) {
    if (typeId.includes("wooden")) base = 4;
    else if (typeId.includes("stone")) base = 5;
    else if (typeId.includes("iron")) base = 6;
    else if (typeId.includes("golden") || typeId.includes("gold_")) base = 4;
    else if (typeId.includes("diamond")) base = 7;
    else if (typeId.includes("netherite")) base = 8;
  } else if (typeId.includes("_axe")) {
    if (typeId.includes("wooden")) base = 7;
    else if (typeId.includes("stone")) base = 9;
    else if (typeId.includes("iron")) base = 9;
    else if (typeId.includes("golden") || typeId.includes("gold_")) base = 7;
    else if (typeId.includes("diamond")) base = 9;
    else if (typeId.includes("netherite")) base = 10;
  } else if (typeId.includes("_pickaxe")) {
    if (typeId.includes("wooden")) base = 2;
    else if (typeId.includes("stone")) base = 3;
    else if (typeId.includes("iron")) base = 4;
    else if (typeId.includes("golden") || typeId.includes("gold_")) base = 2;
    else if (typeId.includes("diamond")) base = 5;
    else if (typeId.includes("netherite")) base = 6;
  } else if (typeId.includes("_shovel")) {
    if (typeId.includes("wooden")) base = 2;
    else if (typeId.includes("stone")) base = 3;
    else if (typeId.includes("iron")) base = 4;
    else if (typeId.includes("golden") || typeId.includes("gold_")) base = 2;
    else if (typeId.includes("diamond")) base = 5;
    else if (typeId.includes("netherite")) base = 6;
  } else if (typeId.includes("_hoe")) {
    base = 1;
  } else if (typeId === "minecraft:trident") {
    base = 8;
  } else if (typeId === "minecraft:mace") {
    base = 7;
  } else if (typeId !== "minecraft:air") {
    base = 2;
  }

  const sharpness = getEnchantLevel(item, "sharpness");
  if (sharpness > 0) {
    base += 0.5 + sharpness * 0.5;
  }

  const knockbackLevel = getEnchantLevel(item, "knockback");
  const fireAspectLevel = getEnchantLevel(item, "fire_aspect");

  return {
    damage: Math.max(1, Math.round(base * 10) / 10),
    knockback: (0.25 + knockbackLevel * 0.25) * 4,
    fireSeconds: fireAspectLevel === 1 ? 4 : fireAspectLevel >= 2 ? 8 : 0,
  };
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
  handleKillaura,
  handleGod,
  handlePunish,
  handleLock,
  handleNameTag,
];

let damageHooked = false;
let auraTick = 0;
const auraCooldown = new Map();
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
    auraTick += intervalTicks;
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

function handleKillaura(p) {
  if (p.getDynamicProperty("ackillaura") !== true) return;

  const range = getNumberProp(p, "ackillauraRange") ?? 3;
  if (range <= 0) return;

  const lastTick = auraCooldown.get(p.id) ?? -999999;
  if (auraTick - lastTick < 4) return;
  auraCooldown.set(p.id, auraTick);

  const profile = getKillauraProfile(p);
  if (!(profile.damage > 0)) return;

  let targets = [];
  try {
    targets = p.dimension.getEntities({
      location: p.location,
      maxDistance: range,
    });
  } catch {
    return;
  }

  for (const target of targets) {
    if (!target || target.id === p.id) continue;
    try {
      if (!target.getComponent("minecraft:health")) continue;
    } catch {
      continue;
    }

    try {
      target.applyDamage(profile.damage, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: p,
      });
    } catch {}

    if (profile.fireSeconds > 0) {
      try {
        target.setOnFire(profile.fireSeconds, true);
      } catch {}
    }

    const sourcePos = p.location;
    const targetPos = target.location;
    const kbX = targetPos.x - sourcePos.x;
    const kbZ = targetPos.z - sourcePos.z;
    const kbLen = Math.hypot(kbX, kbZ) || 1;
    try {
      target.applyKnockback(
        { x: kbX / kbLen * profile.knockback, z: kbZ / kbLen * profile.knockback },
        0.18
      );
    } catch {}
  }
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
