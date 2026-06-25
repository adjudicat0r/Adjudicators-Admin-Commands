
import { EquipmentSlot, ItemComponentTypes } from "@minecraft/server";
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

function repairItemStack(item) {
  if (!item) return false;
  try {
    const d = item.getComponent?.(ItemComponentTypes.Durability);
    if (!d) return false;
    if (typeof d.damage !== "number") return false;
    if (d.damage <= 0) return false;
    d.damage = 0;
    return true;
  } catch {
    return false;
  }
}

function repairHeldItem(player) {
  const inv = getInv(player);
  if (!inv) return 0;

  const slot = player.selectedSlotIndex ?? 0;
  const item = inv.getItem(slot);
  if (!item) return 0;

  if (repairItemStack(item)) {
    try {
      inv.setItem(slot, item); 
    } catch {}
    return 1;
  }
  return 0;
}

function repairAllItems(player) {
  let repaired = 0;

  const inv = getInv(player);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (!item) continue;
      if (repairItemStack(item)) {
        repaired++;
        try {
          inv.setItem(i, item);
        } catch {}
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
        if (repairItemStack(item)) {
          repaired++;
          try {
            eq.setEquipment?.(s, item);
          } catch {}
        }
      } catch {}
    }
  }

  return repaired;
}

export const repairCommand = {
  name: "repair",
  minRank: 3, 
  usage: ":repair [selector] | :repair all [selector]",
  description:
    "Repairs held item, or repairs all items in inventory + armor + offhand to full durability.",
  examples: [":repair", ":repair all", ":repair all all"],

  execute({ player, args }) {
    const a0 = normName(args[0]);

    
    if (a0 === "all") {
      const selector = args[1] ?? "me";
      const targets = selectPlayers(player, selector);

      if (!targets.length) {
        player.sendMessage(`No targets matched: ${selector}`);
        return;
      }

      let playersDone = 0;
      let itemsDone = 0;

      for (const t of targets) {
        try {
          itemsDone += repairAllItems(t);
          playersDone++;
        } catch {}
      }

      player.sendMessage(
        `Repaired ${itemsDone} item(s) for ${playersDone} player(s).`
      );
      return;
    }

    
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let playersDone = 0;
    let itemsDone = 0;

    for (const t of targets) {
      try {
        itemsDone += repairHeldItem(t);
        playersDone++;
      } catch {}
    }

    player.sendMessage(
      `Repaired ${itemsDone} held item(s) for ${playersDone} player(s).`
    );
  },
};
