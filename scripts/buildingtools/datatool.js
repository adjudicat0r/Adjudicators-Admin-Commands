
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { getPetOwnerTag, markEntityAsPet, unmarkEntityAsPet } from "../system/pet.js";
import { openInventoryEditor } from "../commands/invsee.js";

const DATA_TOOL_PAGE_SIZE = 7;
const EFFECT_OPTIONS = [
  "absorption",
  "bad_omen",
  "blindness",
  "conduit_power",
  "darkness",
  "fatal_poison",
  "fire_resistance",
  "haste",
  "health_boost",
  "hunger",
  "instant_damage",
  "instant_health",
  "invisibility",
  "jump_boost",
  "levitation",
  "mining_fatigue",
  "nausea",
  "night_vision",
  "poison",
  "regeneration",
  "resistance",
  "saturation",
  "slowness",
  "slow_falling",
  "speed",
  "strength",
  "water_breathing",
  "weakness",
  "wither",
];






export async function handleDataToolBlock(player, block) {
  if (!block) return;
  await openBlockEditor(player, block);
}

export async function handleDataToolEntity(player, entity) {
  if (!entity || !entity.isValid) return;
  await openEntityEditor(player, entity);
}






async function openBlockEditor(player, block) {
  await showBlockEditor(player, block);
}

async function showBlockEditor(player, block) {
  try {
    
    const dim = block.dimension;
    const loc = block.location;

    
    const perm = block.permutation;
    const states = perm.getAllStates();
    const keys = Object.keys(states);

    const form = new ModalFormData().title("Block editor");

    
    form.textField(
      `Block typeId (current: ${block.typeId})`,
      "minecraft:stone",
      { defaultValue: block.typeId }
    );

    
    for (const k of keys) {
      const v = states[k];
      form.textField(`${k} (current: ${String(v)})`, "new value", {
        defaultValue: String(v),
      });
    }

    const res = await form.show(player);
    if (res.canceled) return;

    const values = res.formValues ?? [];
    const newTypeId = String(values[0] ?? "").trim();
    if (!newTypeId) return;

    let liveBlock = dim.getBlock(loc);
    if (!liveBlock) return;

    
    if (newTypeId !== liveBlock.typeId) {
      try {
        liveBlock.setType(newTypeId);
      } catch {
        player.sendMessage(`Invalid block typeId: ${newTypeId}`);
        return;
      }
      liveBlock = dim.getBlock(loc);
      if (!liveBlock) return;
    }

    
    const livePerm = liveBlock.permutation;
    const liveStates = livePerm.getAllStates();

    let newPerm = livePerm;

    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!(key in liveStates)) continue;

      const oldVal = liveStates[key];
      const raw = String(values[i + 1] ?? "").trim();

      try {
        newPerm = newPerm.withState(key, parseLike(oldVal, raw));
      } catch {
        
      }
    }

    liveBlock.setPermutation(newPerm);
    player.sendMessage("Block saved.");
  } catch (e) {
    player.sendMessage(`Block editor error: ${String(e)}`);
  }
}

function parseLike(oldVal, raw) {
  if (typeof oldVal === "boolean") return raw.toLowerCase() === "true";
  if (typeof oldVal === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : oldVal;
  }
  return raw;
}





async function openEntityEditor(player, entity) {
  await showEntityMenu(player, entity);
}



async function showEntityMenu(player, entity) {
  while (true) {
    if (!entity.isValid) return;

    const tags = safe(() => entity.getTags(), []) ?? [];
    const nameTag = safe(() => entity.nameTag, "") ?? "";
    const hasInventory = !!safe(() => entity.getComponent("inventory")?.container, null);
    const options = [
      {
        label: "Basics",
        detail: "nameTag, pet, health, remove",
        action: () => showEntityBasics(player, entity),
      },
      {
        label: "Effects",
        detail: "view, add, remove, clear",
        action: () => showEntityEffectsMenu(player, entity),
      },
      {
        label: "Tags",
        detail: `manage ${tags.length} tag(s)`,
        action: () => showEntityTagsMenu(player, entity),
      },
      {
        label: "Move",
        detail: "teleport + rotation",
        action: () => showEntityMove(player, entity),
      },
    ];

    if (hasInventory) {
      options.push({
        label: "Inventory",
        detail: "open inventory editor",
        action: () => openInventoryEditor(player, entity),
      });
    }

    options.push(
      {
        label: "Dynamic properties",
        detail: "edit custom stored values",
        action: () => showEntityDynamicProps(player, entity),
      },
      {
        label: "Property editor",
        detail: "manual property id/value",
        action: () => showEntityManualProperty(player, entity),
      },
      {
        label: "Run command",
        detail: "execute as this entity",
        action: () => showEntityRunCommand(player, entity),
      }
    );

    const form = new ActionFormData()
      .title(`Entity: ${entity.typeId}`)
      .body(
        `id: ${entity.id}\n` +
          `nameTag: ${nameTag || "(none)"}\n` +
          `tags: ${tags.length}\n` +
          `inventory: ${hasInventory ? "yes" : "no"}`
      )
      .button("Close");

    for (const option of options) {
      form.button(`${option.label}`);
    }

    const res = await form.show(player);
    if (res.canceled) return;

    if (res.selection === 0) return;

    const selected = options[res.selection - 1];
    if (!selected) return;
    await selected.action();
  }
}

async function showEntityBasics(player, entity) {
  if (!entity.isValid) return;

  const tags = safe(() => entity.getTags(), []) ?? [];
  const isPet = tags.includes("ac_pet") && tags.includes(getPetOwnerTag(player));
  const healthComp = safe(() => entity.getComponent("minecraft:health"), null);
  const currentHealth = Number(healthComp?.currentValue ?? 0);
  const maxHealth = Number(healthComp?.effectiveMax ?? healthComp?.defaultValue ?? 0);
  const sliderMaxHealth = Math.max(1, Math.floor(maxHealth));
  const sliderDefaultHealth = Math.min(
    sliderMaxHealth,
    Math.max(1, Math.floor(currentHealth || sliderMaxHealth))
  );

  let form = new ModalFormData()
    .title("Basics")
    .textField("nameTag", "text (blank clears)", {
      defaultValue: String(entity.nameTag ?? ""),
    })
    .slider("Mark as your pet", 0, 1, {
      defaultValue: isPet ? 1 : 0,
    });

  if (maxHealth > 0) {
    form = form.slider(`Health (${sliderDefaultHealth}/${sliderMaxHealth})`, 1, sliderMaxHealth, {
      defaultValue: sliderDefaultHealth,
    });
  }

  form = form.slider("Kill / remove entity (drag fully right to confirm)", 0, 1, {
    defaultValue: 0,
  });

  const res = await form.show(player);
  if (res.canceled) return;

  safe(() => {
    entity.nameTag = String(res.formValues?.[0] ?? "");
  });

  const petValue = Number(res.formValues?.[1] ?? 0);
  if (petValue >= 1) {
    safe(() => markEntityAsPet(entity, player));
  } else if (isPet) {
    safe(() => unmarkEntityAsPet(entity, player));
  }

  if (maxHealth > 0) {
    const nextHealth = Number(res.formValues?.[2] ?? sliderDefaultHealth);
    if (Number.isFinite(nextHealth) && nextHealth >= 1) {
      safe(() => {
        const liveHealth = entity.getComponent("minecraft:health");
        if (!liveHealth) return;
        const liveMaxHealth = Number(liveHealth.effectiveMax ?? liveHealth.defaultValue ?? nextHealth);
        liveHealth.setCurrentValue(Math.min(nextHealth, liveMaxHealth));
      });
    }
  }

  const killValue = Number(res.formValues?.[maxHealth > 0 ? 3 : 2] ?? 0);
  if (killValue >= 1) safe(() => entity.remove());

  player.sendMessage("Saved basics.");
}

async function showEntityEffectsMenu(player, entity) {
  while (true) {
    if (!entity.isValid) return;

    const activeEffects = getEntityEffects(entity);
    const form = new ActionFormData()
      .title("Effects")
      .body(
        activeEffects.length
          ? `Active (${activeEffects.length}): ${activeEffects.slice(0, 4).map(formatEffectLabel).join(", ")}${activeEffects.length > 4 ? "..." : ""}`
          : "No active effects."
      )
      .button("View active effects")
      .button("Add effect")
      .button("Remove effect")
      .button("Clear all effects")
      .button("Back");

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        await showEntityEffectsList(player, entity);
        break;
      case 1:
        await showEntityAddEffect(player, entity);
        break;
      case 2:
        await showEntityRemoveEffect(player, entity);
        break;
      case 3:
        safe(() => entity.runCommand("effect @s clear"));
        player.sendMessage("Cleared all effects.");
        break;
      default:
        return;
    }
  }
}

async function showEntityEffectsList(player, entity) {
  const effects = getEntityEffects(entity);
  if (!effects.length) {
    player.sendMessage("No active effects.");
    return;
  }

  await showPagedInfo(player, {
    title: "Active effects",
    items: effects.map((effect) => formatEffectLabel(effect)),
  });
}

async function showEntityAddEffect(player, entity) {
  const effectId = await showPagedSelection(player, {
    title: "Add effect",
    body: "Choose an effect to apply.",
    items: EFFECT_OPTIONS.map((effect) => ({
      label: prettifyEffectName(effect),
      value: effect,
      detail: `minecraft:${effect}`,
    })),
  });
  if (!effectId || !entity.isValid) return;

  const form = new ModalFormData()
    .title(`Add effect: ${prettifyEffectName(effectId)}`)
    .textField("Duration in seconds", "30", { defaultValue: "30" })
    .textField("Amplifier", "0", { defaultValue: "0" })
    .toggle("Hide particles", { defaultValue: false });

  const res = await form.show(player);
  if (res.canceled || !entity.isValid) return;

  const duration = Math.max(1, Math.floor(numOr(30, res.formValues?.[0])));
  const amplifier = Math.max(0, Math.floor(numOr(0, res.formValues?.[1])));
  const hideParticles = !!res.formValues?.[2];
  const command = `effect @s ${effectId} ${duration} ${amplifier} ${hideParticles}`;
  const result = safe(() => entity.runCommand(command), null);

  player.sendMessage(
    result
      ? `Applied ${effectId} for ${duration}s.`
      : `Failed to apply ${effectId}.`
  );
}

async function showEntityRemoveEffect(player, entity) {
  const effects = getEntityEffects(entity);
  if (!effects.length) {
    player.sendMessage("No active effects to remove.");
    return;
  }

  const effectId = await showPagedSelection(player, {
    title: "Remove effect",
    body: "Choose an active effect to clear.",
    items: effects.map((effect) => ({
      label: prettifyEffectName(effect.typeId),
      value: effect.typeId,
      detail: formatEffectLabel(effect),
    })),
  });
  if (!effectId || !entity.isValid) return;

  const result = safe(() => entity.runCommand(`effect @s ${effectId} 0`), null);
  player.sendMessage(result ? `Removed ${effectId}.` : `Failed to remove ${effectId}.`);
}



async function showEntityTagsMenu(player, entity) {
  while (true) {
    if (!entity.isValid) return;

    const form = new ActionFormData()
      .title("Tags")
      .body("Manage entity tags")
      .button("List tags")
      .button("Add tags")
      .button("Remove tags")
      .button("Back");

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        await showEntityTagsList(player, entity);
        break;
      case 1:
        await showEntityTagsAdd(player, entity);
        break;
      case 2:
        await showEntityTagsRemove(player, entity);
        break;
      default:
        return;
    }
  }
}

async function showEntityTagsList(player, entity) {
  if (!entity.isValid) return;

  const tags = safe(() => entity.getTags(), []) ?? [];
  if (!tags.length) {
    player.sendMessage("No tags.");
    return;
  }

  await showPagedInfo(player, {
    title: `Tags (${tags.length})`,
    items: tags,
  });
}

async function showEntityTagsAdd(player, entity) {
  if (!entity.isValid) return;

  const form = new ModalFormData()
    .title("Add tags")
    .textField("Tags to add (comma-separated)", "tag1,tag2", { defaultValue: "" });

  const res = await form.show(player);
  if (res.canceled) return;

  const add = splitCsv(String(res.formValues?.[0] ?? ""));
  let added = 0;

  for (const t of add) {
    try {
      entity.addTag(t);
      added++;
    } catch {}
  }

  player.sendMessage(`Added ${added} tag(s).`);
}

async function showEntityTagsRemove(player, entity) {
  if (!entity.isValid) return;

  const tags = safe(() => entity.getTags(), []) ?? [];
  if (tags.length === 0) {
    player.sendMessage("No tags to remove.");
    return;
  }

  const tagToRemove = await showPagedSelection(player, {
    title: "Remove tags",
    body: "Choose a tag to remove.",
    items: tags.map((tag) => ({ label: tag, value: tag })),
  });
  if (!tagToRemove || !entity.isValid) return;

  let removed = false;
  try {
    entity.removeTag(tagToRemove);
    removed = true;
  } catch {}

  player.sendMessage(removed ? `Removed tag: ${tagToRemove}` : `Failed to remove tag: ${tagToRemove}`);
}



async function showEntityMove(player, entity) {
  if (!entity.isValid) return;

  const loc = safe(() => entity.location, null);
  const rot = safe(() => entity.getRotation(), null);

  const form = new ModalFormData()
    .title("Move")
    .textField("X", "number", { defaultValue: String(loc?.x ?? 0) })
    .textField("Y", "number", { defaultValue: String(loc?.y ?? 0) })
    .textField("Z", "number", { defaultValue: String(loc?.z ?? 0) })
    .textField("Yaw", "number", { defaultValue: String(rot?.y ?? 0) })
    .textField("Pitch", "number", { defaultValue: String(rot?.x ?? 0) });

  const res = await form.show(player);
  if (res.canceled) return;

  const x = numOr(loc?.x ?? 0, res.formValues?.[0]);
  const y = numOr(loc?.y ?? 0, res.formValues?.[1]);
  const z = numOr(loc?.z ?? 0, res.formValues?.[2]);
  const yaw = numOr(rot?.y ?? 0, res.formValues?.[3]);
  const pitch = numOr(rot?.x ?? 0, res.formValues?.[4]);

  safe(() => entity.teleport({ x, y, z }, { dimension: entity.dimension }));
  safe(() => entity.setRotation({ x: pitch, y: yaw }));

  player.sendMessage("Saved move.");
}

async function showEntityDynamicProps(player, entity) {
  if (!entity.isValid) return;

  const ids = safe(() => entity.getDynamicPropertyIds(), []) ?? [];

  const form = new ModalFormData()
    .title("Dynamic properties")
    .textField(`Existing ids (${ids.length})`, "read-only", { defaultValue: ids.join(", ") })
    .textField("Edit id", "my_prop", { defaultValue: ids[0] ?? "" })
    .textField("New value", 'string/number/boolean or JSON (e.g. {"a":1})', {
      defaultValue: "",
    })
    .textField("Delete id (optional)", "id_to_delete", { defaultValue: "" });

  const res = await form.show(player);
  if (res.canceled) return;

  const editId = String(res.formValues?.[1] ?? "").trim();
  const rawVal = String(res.formValues?.[2] ?? "").trim();
  const delId = String(res.formValues?.[3] ?? "").trim();

  if (delId) safe(() => entity.setDynamicProperty(delId, undefined));
  if (editId) safe(() => entity.setDynamicProperty(editId, parseScalarOrJson(rawVal)));

  player.sendMessage("Saved dynamic properties.");
}

async function showEntityManualProperty(player, entity) {
  if (!entity.isValid) return;

  const form = new ModalFormData()
    .title("Property editor (manual)")
    .textField("Property id", "example: minecraft:variant", { defaultValue: "" })
    .textField("New value", "string/number/boolean", { defaultValue: "" })
    .textField("Reset property id (optional)", "id_to_reset", { defaultValue: "" });

  const res = await form.show(player);
  if (res.canceled) return;

  const propId = String(res.formValues?.[0] ?? "").trim();
  const rawVal = String(res.formValues?.[1] ?? "").trim();
  const resetId = String(res.formValues?.[2] ?? "").trim();

  if (resetId) safe(() => entity.resetProperty(resetId));
  if (propId) safe(() => entity.setProperty(propId, parseScalar(rawVal)));

  player.sendMessage("Saved property.");
}

async function showEntityRunCommand(player, entity) {
  if (!entity.isValid) return;

  const form = new ModalFormData()
    .title("Run command as entity")
    .textField("Command (no leading /)", "say hi", { defaultValue: "say edited via script" });

  const res = await form.show(player);
  if (res.canceled) return;

  const cmd = String(res.formValues?.[0] ?? "").trim();
  if (!cmd) return;

  const r = safe(() => entity.runCommand(cmd), null);
  player.sendMessage(r ? `Command OK: ${r.successCount}` : "Command failed.");
}

async function showPagedInfo(player, { title, items, pageSize = DATA_TOOL_PAGE_SIZE }) {
  let page = 0;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  while (true) {
    const start = page * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    const form = new ActionFormData()
      .title(`${title} (${page + 1}/${pageCount})`)
      .body(pageItems.join("\n") || "(empty)")
      .button(page > 0 ? "Previous" : " ")
      .button(page < pageCount - 1 ? "Next" : " ")
      .button("Back");

    const res = await form.show(player);
    if (res.canceled || res.selection === 2) return;
    if (res.selection === 0 && page > 0) {
      page--;
      continue;
    }
    if (res.selection === 1 && page < pageCount - 1) {
      page++;
      continue;
    }
  }
}

async function showPagedSelection(player, { title, body, items, pageSize = DATA_TOOL_PAGE_SIZE }) {
  let page = 0;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  while (true) {
    const start = page * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    const form = new ActionFormData()
      .title(`${title} (${page + 1}/${pageCount})`)
      .body(body ?? "Select an option.")
      .button(page > 0 ? "Previous" : " ")
      .button(page < pageCount - 1 ? "Next" : " ")
      .button("Back");

    for (const item of pageItems) {
      form.button(item.detail ? `${item.label} - ${item.detail}` : item.label);
    }

    const res = await form.show(player);
    if (res.canceled || res.selection === 2) return null;
    if (res.selection === 0 && page > 0) {
      page--;
      continue;
    }
    if (res.selection === 1 && page < pageCount - 1) {
      page++;
      continue;
    }

    const itemIndex = res.selection - 3;
    const selected = pageItems[itemIndex];
    if (selected) return selected.value;
  }
}

function getEntityEffects(entity) {
  const effects = safe(() => entity.getEffects?.(), []) ?? [];
  return Array.isArray(effects) ? effects : [];
}

function formatEffectLabel(effect) {
  const typeId = String(effect?.typeId ?? effect?.type?.id ?? effect?.type ?? "minecraft:effect");
  const amplifier = Number(effect?.amplifier ?? 0) + 1;
  const duration = Number(effect?.duration ?? 0);
  return `${prettifyEffectName(typeId)} ${amplifier} (${duration}t)`;
}

function prettifyEffectName(effectId) {
  return String(effectId)
    .replace("minecraft:", "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}



function splitCsv(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function numOr(fallback, v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseScalar(s) {
  const t = s.trim().toLowerCase();
  if (t === "true") return true;
  if (t === "false") return false;
  const n = Number(s);
  if (Number.isFinite(n) && s.trim() !== "") return n;
  return s;
}

function parseScalarOrJson(s) {
  if (!s) return "";
  const t = s.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {}
  }
  return parseScalar(t);
}

function safe(fn, fallback = undefined) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

