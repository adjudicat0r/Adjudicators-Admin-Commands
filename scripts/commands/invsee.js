import { EquipmentSlot, ItemStack, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { selectPlayers } from "../lib/selectors.js";

const EQUIPMENT_ENTRIES = [
  { key: "offhand", slot: EquipmentSlot.Offhand, label: "Offhand" },
  { key: "head", slot: EquipmentSlot.Head, label: "Armor Head" },
  { key: "chest", slot: EquipmentSlot.Chest, label: "Armor Chest" },
  { key: "legs", slot: EquipmentSlot.Legs, label: "Armor Legs" },
  { key: "feet", slot: EquipmentSlot.Feet, label: "Armor Feet" },
];

function showWithRetry(player, buildFormFn, onOk) {
  const tryShow = () => {
    let form;
    try {
      form = buildFormFn();
    } catch {
      return;
    }

    form.show(player).then((res) => {
      if (res?.canceled) {
        if (res.cancelationReason == "UserBusy") {
          return system.runTimeout(tryShow, 10);
        }
        return;
      }
      onOk(res);
    }).catch(() => {
      system.runTimeout(tryShow, 10);
    });
  };

  tryShow();
}

function getInv(target) {
  return target.getComponent("inventory")?.container ?? null;
}

function getEquippable(target) {
  return target.getComponent("equippable") ?? null;
}

function getTargetLabel(target) {
  try {
    if (typeof target.name === "string" && target.name.length) return target.name;
  } catch {}
  try {
    if (typeof target.nameTag === "string" && target.nameTag.length) return target.nameTag;
  } catch {}
  try {
    const typeId = String(target.typeId ?? "");
    if (typeId) return typeId;
  } catch {}
  return "target";
}

function getBoolProp(p, key, def = false) {
  try {
    const v = p.getDynamicProperty(key);
    return v === true ? true : v === false ? false : def;
  } catch {
    return def;
  }
}

function setBoolProp(p, key, val) {
  try {
    p.setDynamicProperty(key, !!val);
  } catch {}
}

function safeName(item) {
  try {
    const n = item?.nameTag;
    return typeof n === "string" && n.length ? n : "";
  } catch {
    return "";
  }
}

function enchantSummary(item) {
  try {
    const ench = item.getComponent("enchantable");
    if (!ench) return "";
    const list = ench.getEnchantments?.() ?? [];
    if (!list.length) return "";
    return " | " + list
      .map((e) => `${e.type.id.split(":").pop()} ${e.level}`)
      .join(", ");
  } catch {
    return "";
  }
}

function iconForItem(item) {
  try {
    const id = item?.typeId ?? "";
    if (!id) return undefined;
    const shortId = id.includes(":") ? id.split(":")[1] : id;
    return `textures/items/${shortId}.png`;
  } catch {
    return undefined;
  }
}

function getTargetEntries(target, showEmpty) {
  const entries = [];
  const inv = getInv(target);

  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (!showEmpty && !item) continue;
      entries.push({
        kind: "inventory",
        key: `inv:${i}`,
        slot: i,
        label: `#${i}`,
        item,
      });
    }
  }

  const equippable = getEquippable(target);
  if (equippable) {
    for (const entry of EQUIPMENT_ENTRIES) {
      const item = equippable.getEquipment?.(entry.slot) ?? null;
      if (!showEmpty && !item) continue;
      entries.push({
        kind: "equipment",
        key: `eq:${entry.key}`,
        slot: entry.slot,
        label: entry.label,
        item,
      });
    }
  }

  return entries;
}

function getEntryItem(target, entry) {
  if (!entry) return null;

  if (entry.kind === "equipment") {
    return getEquippable(target)?.getEquipment?.(entry.slot) ?? null;
  }

  return getInv(target)?.getItem(entry.slot) ?? null;
}

function setEntryItem(target, entry, item) {
  if (!entry) return false;

  try {
    if (entry.kind === "equipment") {
      const equippable = getEquippable(target);
      if (!equippable) return false;
      equippable.setEquipment?.(entry.slot, item);
      return true;
    }

    const inv = getInv(target);
    if (!inv) return false;
    inv.setItem(entry.slot, item);
    return true;
  } catch {
    return false;
  }
}

function labelForSlot(entry, item) {
  const slotLabel = entry?.label ?? `#${entry?.slot ?? "?"}`;
  if (!item) return `${slotLabel} (empty)`;

  const id = item.typeId ?? "unknown";
  const shortId = id.includes(":") ? id.split(":")[1] : id;
  const amt = item.amount ?? 1;
  const nm = safeName(item);
  const ench = enchantSummary(item);
  const namePart = nm ? ` | ${nm}` : "";

  return `${slotLabel} ${shortId} x${amt}${namePart}${ench}`;
}

export function openInventoryEditor(viewer, target) {
  const hasInventory = !!getInv(target);
  const hasEquippable = !!getEquippable(target);
  if (!hasInventory && !hasEquippable) {
    viewer.sendMessage("Target has no inventory or equipment.");
    return;
  }

  const showEmpty = getBoolProp(viewer, "acinvseeEmpty", false);
  const slots = getTargetEntries(target, showEmpty);

  showWithRetry(
    viewer,
    () => {
      const form = new ActionFormData()
        .title(`Inventory: ${getTargetLabel(target)}`)
        .body("Select an inventory, armor, or offhand slot to edit.");

      form.button(`Show empty slots: ${showEmpty ? "ON" : "OFF"}`);

      for (const s of slots) {
        const text = labelForSlot(s, s.item);
        const icon = s.item ? iconForItem(s.item) : "textures/ui/icon_trash.png";
        form.button(text, icon);
      }

      form.button("Close");
      return form;
    },
    (res) => {
      const idx = res.selection;
      if (idx == null) return;

      if (idx === 0) {
        setBoolProp(viewer, "acinvseeEmpty", !showEmpty);
        return openInventoryEditor(viewer, target);
      }

      const closeIndex = 1 + slots.length;
      if (idx === closeIndex) return;

      const chosen = slots[idx - 1];
      if (!chosen) return;
      openSlotActions(viewer, target, chosen);
    }
  );
}

function openSlotActions(viewer, target, entry) {
  if (!entry) return;
  const item = getEntryItem(target, entry);

  showWithRetry(
    viewer,
    () => {
      const form = new ActionFormData()
        .title(`Edit ${entry.label}`)
        .body(labelForSlot(entry, item));

      if (item) {
        form.button("Set amount", "textures/ui/strength_effect.png");
        form.button("Rename", "textures/ui/pencil_edit_icon.png");
        form.button("Replace itemId", "textures/ui/refresh_light.png");
        form.button("Delete item", "textures/ui/icon_trash.png");
      } else {
        form.button("Set itemId (create)", "textures/ui/refresh_light.png");
      }

      form.button("Back", "textures/ui/arrow_left.png");
      return form;
    },
    (res) => {
      const sel = res.selection;
      if (sel == null) return;

      if (item) {
        if (sel === 0) return openSetAmount(viewer, target, entry);
        if (sel === 1) return openRename(viewer, target, entry);
        if (sel === 2) return openReplace(viewer, target, entry);
        if (sel === 3) return doDelete(viewer, target, entry);
        return openInventoryEditor(viewer, target);
      }

      if (sel === 0) return openReplace(viewer, target, entry);
      return openInventoryEditor(viewer, target);
    }
  );
}

function openSetAmount(viewer, target, entry) {
  const item = getEntryItem(target, entry);
  if (!item) return openSlotActions(viewer, target, entry);

  const max = item.maxAmount ?? 64;

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Set amount (${entry.label})`)
        .textField(`Amount (1-${max})`, "e.g. 16", { defaultValue: String(item.amount ?? 1) });
      return form;
    },
    (res) => {
      const raw = String(res.formValues?.[0] ?? "").trim();
      const n = Number(raw);
      if (!Number.isFinite(n)) return openSlotActions(viewer, target, entry);

      const amt = Math.max(1, Math.min(max, Math.floor(n)));

      try {
        const cur = getEntryItem(target, entry);
        if (!cur) return openInventoryEditor(viewer, target);
        cur.amount = amt;
        if (!setEntryItem(target, entry, cur)) {
          viewer.sendMessage("Failed to set amount.");
        }
      } catch {
        viewer.sendMessage("Failed to set amount.");
      }

      openSlotActions(viewer, target, entry);
    }
  );
}

function openRename(viewer, target, entry) {
  const item = getEntryItem(target, entry);
  if (!item) return openSlotActions(viewer, target, entry);

  const curName = safeName(item).replace(/^§r/, "");

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Rename (${entry.label})`)
        .textField("Name (empty clears)", "e.g. Banned Stick", { defaultValue: curName });
      return form;
    },
    (res) => {
      const name = String(res.formValues?.[0] ?? "").trim();

      try {
        const cur = getEntryItem(target, entry);
        if (!cur) return openInventoryEditor(viewer, target);

        cur.nameTag = name ? `§r${name}` : undefined;
        if (!setEntryItem(target, entry, cur)) {
          viewer.sendMessage("Failed to rename.");
        }
      } catch {
        viewer.sendMessage("Failed to rename.");
      }

      openSlotActions(viewer, target, entry);
    }
  );
}

function openReplace(viewer, target, entry) {
  const item = getEntryItem(target, entry);
  const oldId = item?.typeId ?? "minecraft:stone";

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Set itemId (${entry.label})`)
        .textField("Item id", "minecraft:diamond_sword", { defaultValue: oldId });
      return form;
    },
    (res) => {
      const raw = String(res.formValues?.[0] ?? "").trim();
      if (!raw) return openSlotActions(viewer, target, entry);

      const itemId = raw.startsWith("minecraft:") ? raw : `minecraft:${raw}`;

      try {
        const existing = getEntryItem(target, entry);
        const keepAmt = existing?.amount ?? 1;
        const keepName = existing ? safeName(existing) : "";

        const next = new ItemStack(itemId, 1);
        const max = next.maxAmount ?? 64;
        next.amount = Math.max(1, Math.min(max, keepAmt));
        if (keepName) next.nameTag = keepName;

        if (!setEntryItem(target, entry, next)) {
          viewer.sendMessage("Failed (bad item id or API limits).");
        }
      } catch {
        viewer.sendMessage("Failed (bad item id or API limits).");
      }

      openSlotActions(viewer, target, entry);
    }
  );
}

function doDelete(viewer, target, entry) {
  if (!setEntryItem(target, entry, undefined)) {
    viewer.sendMessage("Failed to delete item.");
  }

  openInventoryEditor(viewer, target);
}

export const invseeCommand = {
  name: "invsee",
  minRank: 3,
  usage: ":invsee <selector>",
  description: "Views/edits a player's inventory with icons + armor/offhand slot editing.",
  examples: [":invsee greg", ":invsee others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const target = targets[0];
    if (targets.length > 1) {
      player.sendMessage(`Multiple matched; opening first: ${target.name}`);
    }

    openInventoryEditor(player, target);
  },
};
