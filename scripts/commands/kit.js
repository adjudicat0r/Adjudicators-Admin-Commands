
import {
  world,
  ItemStack,
  EquipmentSlot,
  ItemComponentTypes,
  EnchantmentTypes,
} from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

const KEY = "ackits";


function getKits() {
  try {
    return JSON.parse(world.getDynamicProperty(KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveKits(kits) {
  world.setDynamicProperty(KEY, JSON.stringify(kits));
}
function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}


function serializeItem(item) {
  if (!item) return null;

  const data = {
    typeId: item.typeId,
    amount: item.amount,
  };

  try {
    if (item.nameTag) data.nameTag = item.nameTag;
  } catch {}

  try {
    const lore = item.getLore?.();
    if (Array.isArray(lore) && lore.length) data.lore = lore;
  } catch {}

  try {
    data.keepOnDeath = item.keepOnDeath === true;
  } catch {}

  try {
    data.lockMode = item.lockMode; 
  } catch {}

  try {
    const canPlaceOn = item.getCanPlaceOn?.();
    if (Array.isArray(canPlaceOn) && canPlaceOn.length) data.canPlaceOn = canPlaceOn;
  } catch {}

  try {
    const canDestroy = item.getCanDestroy?.();
    if (Array.isArray(canDestroy) && canDestroy.length) data.canDestroy = canDestroy;
  } catch {}

  
  try {
    const d = item.getComponent?.(ItemComponentTypes.Durability);
    if (d && typeof d.damage === "number") data.durabilityDamage = d.damage;
  } catch {}

  
  try {
    const ench = item.getComponent?.(ItemComponentTypes.Enchantable);
    const list = ench?.getEnchantments?.() ?? [];
    if (Array.isArray(list) && list.length) {
      data.enchants = list.map((e) => ({
        id: e.type?.id ?? e.type?.toString?.() ?? "",
        level: e.level ?? 1,
      })).filter(e => e.id);
    }
  } catch {}

  return data;
}

function deserializeItem(data) {
  if (!data) return undefined;

  let item;
  try {
    item = new ItemStack(data.typeId, data.amount ?? 1);
  } catch {
    return undefined;
  }

  try {
    if (typeof data.nameTag === "string") item.nameTag = data.nameTag;
  } catch {}

  try {
    if (Array.isArray(data.lore)) item.setLore?.(data.lore);
  } catch {}

  try {
    if (typeof data.keepOnDeath === "boolean") item.keepOnDeath = data.keepOnDeath;
  } catch {}

  try {
    if (data.lockMode != null) item.lockMode = data.lockMode;
  } catch {}

  try {
    if (Array.isArray(data.canPlaceOn)) item.setCanPlaceOn?.(data.canPlaceOn);
  } catch {}

  try {
    if (Array.isArray(data.canDestroy)) item.setCanDestroy?.(data.canDestroy);
  } catch {}

  
  try {
    const d = item.getComponent?.(ItemComponentTypes.Durability);
    if (d && typeof data.durabilityDamage === "number") d.damage = data.durabilityDamage;
  } catch {}

  
  try {
    const ench = item.getComponent?.(ItemComponentTypes.Enchantable);
    if (ench && Array.isArray(data.enchants)) {
      for (const e of data.enchants) {
        try {
          const type = EnchantmentTypes?.get?.(e.id) ?? EnchantmentTypes?.get?.(String(e.id).split(":").pop());
          if (!type) continue;
          ench.addEnchantment?.({ type, level: e.level ?? 1 });
        } catch {}
      }
    }
  } catch {}

  return item;
}


function getInv(player) {
  return player.getComponent("inventory")?.container ?? null;
}

function getEquippable(player) {
  return player.getComponent("equippable") ?? null;
}

function snapshotPlayerLoadout(player) {
  const inv = getInv(player);
  if (!inv) return null;

  const invArr = new Array(inv.size);
  for (let i = 0; i < inv.size; i++) {
    invArr[i] = serializeItem(inv.getItem(i));
  }

  const eq = getEquippable(player);

  const armor = {
    head: serializeItem(eq?.getEquipment?.(EquipmentSlot.Head)),
    chest: serializeItem(eq?.getEquipment?.(EquipmentSlot.Chest)),
    legs: serializeItem(eq?.getEquipment?.(EquipmentSlot.Legs)),
    feet: serializeItem(eq?.getEquipment?.(EquipmentSlot.Feet)),
  };

  const offhand = serializeItem(eq?.getEquipment?.(EquipmentSlot.Offhand));

  return {
    invSize: inv.size,
    inventory: invArr,
    armor,
    offhand,
  };
}

function applyPlayerLoadout(player, kit) {
  const inv = getInv(player);
  if (!inv) return false;

  
  try {
    for (let i = 0; i < inv.size; i++) inv.setItem(i, undefined);
  } catch {}

  const arr = Array.isArray(kit.inventory) ? kit.inventory : [];
  const max = Math.min(inv.size, arr.length);

  for (let i = 0; i < max; i++) {
    try {
      inv.setItem(i, deserializeItem(arr[i]));
    } catch {}
  }

  
  const eq = getEquippable(player);
  if (eq) {
    try { eq.setEquipment?.(EquipmentSlot.Head, deserializeItem(kit.armor?.head)); } catch {}
    try { eq.setEquipment?.(EquipmentSlot.Chest, deserializeItem(kit.armor?.chest)); } catch {}
    try { eq.setEquipment?.(EquipmentSlot.Legs, deserializeItem(kit.armor?.legs)); } catch {}
    try { eq.setEquipment?.(EquipmentSlot.Feet, deserializeItem(kit.armor?.feet)); } catch {}
    try { eq.setEquipment?.(EquipmentSlot.Offhand, deserializeItem(kit.offhand)); } catch {}
  }

  return true;
}


export const kitCommand = {
  name: "kit",
  minRank: 3, 
  usage:
    ":kit save <name> | :kit list | :kit delete <name> | :kit load <selector> <name>",
  description: "Saves/loads full kits (inventory + armor + offhand) globally.",
  examples: [
    ":kit save starter",
    ":kit list",
    ":kit delete starter",
    ":kit load me starter",
    ":kit load others starter",
  ],

  execute({ player, args }) {
    const sub = normName(args[0]);
    const kits = getKits();

    if (!sub) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    
    if (sub === "list") {
      const names = Object.keys(kits);
      if (!names.length) {
        player.sendMessage("No kits saved.");
        return;
      }
      player.sendMessage(`Kits (${names.length}): ${names.join(", ")}`);
      return;
    }

    
    if (sub === "save") {
      const name = normName(args[1]);
      if (!name) {
        player.sendMessage(`Usage: :kit save <name>`);
        return;
      }

      const snap = snapshotPlayerLoadout(player);
      if (!snap) {
        player.sendMessage("Failed to read your inventory.");
        return;
      }

      kits[name] = snap;

      try {
        saveKits(kits);
        player.sendMessage(`Kit "${name}" saved.`);
      } catch {
        player.sendMessage("Failed to save kit (storage limit hit).");
      }
      return;
    }

    
    if (sub === "delete" || sub === "del") {
      const name = normName(args[1]);
      if (!name) {
        player.sendMessage(`Usage: :kit delete <name>`);
        return;
      }
      if (!kits[name]) {
        player.sendMessage(`Kit "${name}" does not exist.`);
        return;
      }
      delete kits[name];
      try {
        saveKits(kits);
        player.sendMessage(`Kit "${name}" deleted.`);
      } catch {
        player.sendMessage("Failed to delete kit.");
      }
      return;
    }

    
    if (sub === "load") {
      const selector = args[1] ?? "me";
      const name = normName(args[2]);

      if (!name) {
        player.sendMessage(`Usage: :kit load <selector> <name>`);
        return;
      }

      const kit = kits[name];
      if (!kit) {
        player.sendMessage(`Kit "${name}" does not exist.`);
        return;
      }

      const targets = selectPlayers(player, selector);
      if (!targets.length) {
        player.sendMessage(`No targets matched: ${selector}`);
        return;
      }

      let count = 0;
      for (const t of targets) {
        try {
          if (applyPlayerLoadout(t, kit)) count++;
        } catch {}
      }

      player.sendMessage(`Loaded kit "${name}" for ${count} player(s).`);
      return;
    }

    player.sendMessage(`Unknown subcommand: ${sub}. Usage: ${this.usage}`);
  },
};
