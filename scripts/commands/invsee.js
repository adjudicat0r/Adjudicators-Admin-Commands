
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { ItemStack } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

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

function getInv(p) {
  return p.getComponent("inventory")?.container ?? null;
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
      .map(e => `${e.type.id.split(":").pop()} ${e.level}`)
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

function labelForSlot(slotIndex, item) {
  if (!item) return `#${slotIndex} (empty)`;

  const id = item.typeId ?? "unknown";
  const shortId = id.includes(":") ? id.split(":")[1] : id;
  const amt = item.amount ?? 1;

  const nm = safeName(item);
  const ench = enchantSummary(item);
  const namePart = nm ? ` | ${nm}` : "";

  return `#${slotIndex} ${shortId} x${amt}${namePart}${ench}`;
}

function openInvList(viewer, target) {
  const inv = getInv(target);
  if (!inv) {
    viewer.sendMessage("Target has no inventory.");
    return;
  }

  const showEmpty = getBoolProp(viewer, "acinvseeEmpty", false);

  const slots = [];
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!showEmpty && !it) continue;
    slots.push({ slot: i, item: it });
  }

  showWithRetry(
    viewer,
    () => {
      const form = new ActionFormData()
        .title(`InvSee: ${target.name}`)
        .body("Select a slot to edit.");

      form.button(`Show empty slots: ${showEmpty ? "§aON" : "§cOFF"}`);

      for (const s of slots) {
        const text = labelForSlot(s.slot, s.item);
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
        return openInvList(viewer, target);
      }

      
      const closeIndex = 1 + slots.length;
      if (idx === closeIndex) return;

      
      const chosen = slots[idx - 1];
      if (!chosen) return;
      openSlotActions(viewer, target, chosen.slot);
    }
  );
}

function openSlotActions(viewer, target, slot) {
  const inv = getInv(target);
  if (!inv) return;

  const item = inv.getItem(slot);

  showWithRetry(
    viewer,
    () => {
      const form = new ActionFormData()
        .title(`Edit Slot #${slot}`)
        .body(labelForSlot(slot, item));

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
        if (sel === 0) return openSetAmount(viewer, target, slot);
        if (sel === 1) return openRename(viewer, target, slot);
        if (sel === 2) return openReplace(viewer, target, slot);
        if (sel === 3) return doDelete(viewer, target, slot);
        return openInvList(viewer, target);
      } else {
        if (sel === 0) return openReplace(viewer, target, slot);
        return openInvList(viewer, target);
      }
    }
  );
}

function openSetAmount(viewer, target, slot) {
  const inv = getInv(target);
  if (!inv) return;

  const item = inv.getItem(slot);
  if (!item) return openSlotActions(viewer, target, slot);

  const max = item.maxAmount ?? 64;

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Set amount (#${slot})`)
        .textField(`Amount (1-${max})`, "e.g. 16", { defaultValue: String(item.amount ?? 1) });
      return form;
    },
    (res) => {
      const raw = String(res.formValues?.[0] ?? "").trim();
      const n = Number(raw);
      if (!Number.isFinite(n)) return openSlotActions(viewer, target, slot);

      const amt = Math.max(1, Math.min(max, Math.floor(n)));

      try {
        const cur = inv.getItem(slot);
        if (!cur) return openInvList(viewer, target);
        cur.amount = amt;
        inv.setItem(slot, cur);
      } catch {
        viewer.sendMessage("Failed to set amount.");
      }

      openSlotActions(viewer, target, slot);
    }
  );
}

function openRename(viewer, target, slot) {
  const inv = getInv(target);
  if (!inv) return;

  const item = inv.getItem(slot);
  if (!item) return openSlotActions(viewer, target, slot);

  const curName = safeName(item).replace(/^§r/, "");

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Rename (#${slot})`)
        .textField("Name (empty clears)", "e.g. Banned Stick", { defaultValue: curName });
      return form;
    },
    (res) => {
      const name = String(res.formValues?.[0] ?? "").trim();

      try {
        const cur = inv.getItem(slot);
        if (!cur) return openInvList(viewer, target);

        cur.nameTag = name ? `§r${name}` : undefined;
        inv.setItem(slot, cur);
      } catch {
        viewer.sendMessage("Failed to rename.");
      }

      openSlotActions(viewer, target, slot);
    }
  );
}

function openReplace(viewer, target, slot) {
  const inv = getInv(target);
  if (!inv) return;

  const item = inv.getItem(slot);
  const oldId = item?.typeId ?? "minecraft:stone";

  showWithRetry(
    viewer,
    () => {
      const form = new ModalFormData()
        .title(`Set itemId (#${slot})`)
        .textField("Item id", "minecraft:diamond_sword", { defaultValue: oldId });
      return form;
    },
    (res) => {
      const raw = String(res.formValues?.[0] ?? "").trim();
      if (!raw) return openSlotActions(viewer, target, slot);

      const itemId = raw.startsWith("minecraft:") ? raw : `minecraft:${raw}`;

      try {
        const existing = inv.getItem(slot);
        const keepAmt = existing?.amount ?? 1;
        const keepName = existing ? safeName(existing) : "";

        const next = new ItemStack(itemId, 1);

        
        const max = next.maxAmount ?? 64;
        next.amount = Math.max(1, Math.min(max, keepAmt));
        if (keepName) next.nameTag = keepName;

        inv.setItem(slot, next);
      } catch {
        viewer.sendMessage("Failed (bad item id or API limits).");
      }

      openSlotActions(viewer, target, slot);
    }
  );
}

function doDelete(viewer, target, slot) {
  const inv = getInv(target);
  if (!inv) return;

  try {
    inv.setItem(slot, undefined);
  } catch {
    viewer.sendMessage("Failed to delete item.");
  }

  openInvList(viewer, target);
}

export const invseeCommand = {
  name: "invsee",
  minRank: 3, 
  usage: ":invsee <selector>",
  description: "Views/edits a player's inventory with icons + slot editing.",
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

    openInvList(player, target);
  },
};
