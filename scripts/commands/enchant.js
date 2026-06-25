
import { ItemComponentTypes, EnchantmentTypes, EquipmentSlot } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}

function getInv(player) {
  return player.getComponent("inventory")?.container ?? null;
}

function getEquippable(player) {
  return player.getComponent("equippable") ?? null;
}

function resolveEnchantType(id) {
  const raw = String(id ?? "").trim();
  if (!raw) return null;

  
  const candidates = [
    raw,
    raw.includes(":") ? raw : `minecraft:${raw}`,
    raw.includes(":") ? raw.split(":").pop() : raw,
  ];

  for (const c of candidates) {
    try {
      const t = EnchantmentTypes?.get?.(c);
      if (t) return t;
    } catch {}
  }
  return null;
}

function addEnchantBestEffort(item, id, level) {
  if (!item) return false;

  let ench;
  try {
    ench = item.getComponent?.(ItemComponentTypes.Enchantable);
  } catch {
    ench = null;
  }
  if (!ench) return false;

  const type = resolveEnchantType(id);
  if (!type) return false;

  const lvl = Math.max(1, Number(level) || 1);

  
  try {
    ench.addEnchantment?.({ type, level: lvl });
    return true;
  } catch {}

  try {
    ench.addEnchantment?.(type, lvl);
    return true;
  } catch {}

  try {
    
    ench.enchantments?.addEnchantment?.({ type, level: lvl });
    return true;
  } catch {}

  return false;
}


const MAX_ENCHANTS = [
  
  { id: "protection", level: 4 },
  { id: "respiration", level: 3 },
  { id: "aqua_affinity", level: 1 },
  { id: "thorns", level: 3 },
  { id: "unbreaking", level: 3 },
  { id: "mending", level: 1 },
  { id: "feather_falling", level: 4 },
  { id: "depth_strider", level: 3 },
  { id: "soul_speed", level: 3 },
  { id: "swift_sneak", level: 3 },

  
  { id: "sharpness", level: 5 },
  { id: "looting", level: 3 },
  { id: "fortune", level: 3 },
  { id: "efficiency", level: 5 },
  { id: "power", level: 5 },
  { id: "flame", level: 1 },
  { id: "luck_of_the_sea", level: 3 },
  { id: "lure", level: 3 },
  { id: "impaling", level: 5 },
  { id: "multishot", level: 1 },
  { id: "quick_charge", level: 3 },
  { id: "density", level: 5 },
  { id: "breach", level: 4 },
  { id: "lunge", level: 3 },
];

function enchantItemWithList(item, list) {
  if (!item) return 0;
  let added = 0;
  for (const e of list) {
    if (addEnchantBestEffort(item, e.id, e.level)) added++;
  }
  return added;
}

function enchantHeld(player, listOrSingle) {
  const inv = getInv(player);
  if (!inv) return 0;

  const slot = player.selectedSlotIndex ?? 0;
  const item = inv.getItem(slot);
  if (!item) return 0;

  let added = 0;
  if (Array.isArray(listOrSingle)) {
    added = enchantItemWithList(item, listOrSingle);
  } else {
    added = addEnchantBestEffort(item, listOrSingle.id, listOrSingle.level) ? 1 : 0;
  }

  if (added) {
    try { inv.setItem(slot, item); } catch {}
  }
  return added;
}

function enchantAllItems(player, list) {
  let added = 0;

  const inv = getInv(player);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (!item) continue;
      const c = enchantItemWithList(item, list);
      if (c) {
        added += c;
        try { inv.setItem(i, item); } catch {}
      }
    }
  }

  const eq = getEquippable(player);
  if (eq) {
    const slots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
      EquipmentSlot.Offhand,
    ];
    for (const s of slots) {
      try {
        const item = eq.getEquipment?.(s);
        if (!item) continue;
        const c = enchantItemWithList(item, list);
        if (c) {
          added += c;
          try { eq.setEquipment?.(s, item); } catch {}
        }
      } catch {}
    }
  }

  return added;
}

export const enchantCommand = {
  name: "enchant",
  minRank: 3, 
  usage: ":enchant <selector> <enchantment> <level> | :enchant <selector> max [all]",
  description:
    "Adds an enchant to held item, or applies a max enchant set to held item / all items.",
  examples: [
    ":enchant me sharpness 5",
    ":enchant all max",
    ":enchant all max all",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const mode = normName(args[1]);

    if (!mode) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    
    if (mode === "max") {
      const scope = normName(args[2]); 
      let playersDone = 0;
      let enchAdded = 0;

      for (const t of targets) {
        try {
          enchAdded += scope === "all" ? enchantAllItems(t, MAX_ENCHANTS) : enchantHeld(t, MAX_ENCHANTS);
          playersDone++;
        } catch {}
      }

      player.sendMessage(
        `Applied max enchants: added ${enchAdded} enchant(s) across ${playersDone} player(s).`
      );
      return;
    }

    
    const enchId = args[1];
    const level = Number(args[2]);
    if (!enchId || !Number.isFinite(level)) {
      player.sendMessage(`Usage: :enchant <selector> <enchantment> <level>`);
      return;
    }

    let playersDone = 0;
    let enchAdded = 0;

    for (const t of targets) {
      try {
        enchAdded += enchantHeld(t, { id: enchId, level });
        playersDone++;
      } catch {}
    }

    player.sendMessage(
      `Added ${enchAdded} enchant(s) across ${playersDone} player(s).`
    );
  },
};
