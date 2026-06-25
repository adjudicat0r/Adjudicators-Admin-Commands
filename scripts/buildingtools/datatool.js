


import { ModalFormData, ActionFormData } from "@minecraft/server-ui";






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

    const form = new ActionFormData()
      .title(`Entity: ${entity.typeId}`)
      .body(
        `id: ${entity.id}\n` +
          `nameTag: ${nameTag}\n` +
          `tags (${tags.length}): ${tags.slice(0, 12).join(", ")}${
            tags.length > 12 ? "..." : ""
          }`
      )
      .button("Basics (nameTag, kill/remove)")
      .button("Tags")
      .button("Move (teleport/rotation)")
      .button("Dynamic properties")
      .button("Property editor (manual id)")
      .button("Run command (as entity)")
      .button("Close");

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        await showEntityBasics(player, entity);
        break;
      case 1:
        await showEntityTagsMenu(player, entity);
        break;
      case 2:
        await showEntityMove(player, entity);
        break;
      case 3:
        await showEntityDynamicProps(player, entity);
        break;
      case 4:
        await showEntityManualProperty(player, entity);
        break;
      case 5:
        await showEntityRunCommand(player, entity);
        break;
      default:
        return;
    }
  }
}

async function showEntityBasics(player, entity) {
  if (!entity.isValid) return;

  const form = new ModalFormData()
    .title("Basics")
    .textField("nameTag", "text (blank clears)", {
      defaultValue: String(entity.nameTag ?? ""),
    })
    .slider("Kill / remove entity (drag fully right to confirm)", 0, 1, {
      defaultValue: 0,
    });

  const res = await form.show(player);
  if (res.canceled) return;

  safe(() => {
    entity.nameTag = String(res.formValues?.[0] ?? "");
  });

  const killValue = Number(res.formValues?.[1] ?? 0);
  if (killValue >= 1) safe(() => entity.remove());

  player.sendMessage("Saved basics.");
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
  const text = tags.length ? tags.join("\n") : "(no tags)";

  const form = new ModalFormData()
    .title(`Tags (${tags.length})`)
    .textField("All tags (one per line)", "read-only", { defaultValue: text });

  await form.show(player);
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

  const form = new ModalFormData().title("Remove tags");

  
  for (const t of tags) {
    form.slider(`Remove: ${t}`, 0, 1, { defaultValue: 0 });
  }

  const res = await form.show(player);
  if (res.canceled) return;

  const vals = res.formValues ?? [];
  let removed = 0;

  for (let i = 0; i < tags.length; i++) {
    const v = Number(vals[i] ?? 0);
    if (v >= 1) {
      try {
        entity.removeTag(tags[i]);
        removed++;
      } catch {}
    }
  }

  player.sendMessage(`Removed ${removed} tag(s).`);
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
