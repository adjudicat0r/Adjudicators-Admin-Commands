
import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { selectPlayers } from "../lib/selectors.js";

function norm(s) {
  return String(s ?? "").toLowerCase().trim();
}

function showWithRetry(target, form, onDone) {
  form
    .show(target)
    .then((res) => {
      if (res?.canceled && res.cancelationReason === "UserBusy") {
        return system.runTimeout(() => showWithRetry(target, form, onDone), 10);
      }
      onDone?.(res);
    })
    .catch(() => system.runTimeout(() => showWithRetry(target, form, onDone), 10));
}

function getBoolProp(p, key) {
  try { return p.getDynamicProperty(key) === true; } catch { return false; }
}
function getStrProp(p, key) {
  try {
    const v = p.getDynamicProperty(key);
    return typeof v === "string" && v.length ? v : null;
  } catch {
    return null;
  }
}
function getNumProp(p, key) {
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

function getLocation(p) {
  try { if (p.location) return p.location; } catch {}
  try { if (p.pos) return p.pos; } catch {}
  try { if (typeof p.getHeadLocation === "function") return p.getHeadLocation(); } catch {}
  return null;
}

function getGameModeBestEffort(p) {
  try {
    if (typeof p.getGameMode === "function") {
      const gm = p.getGameMode();
      return String(gm ?? "unknown");
    }
  } catch {}
  
  return "unknown";
}

function getHealthLine(p) {
  try {
    const h = p.getComponent("health");
    if (!h) return "unknown";
    const cur = Number(h.currentValue ?? h.value ?? 0);
    const max = Number(h.defaultValue ?? h.effectiveMax ?? 0);
    if (Number.isFinite(cur) && Number.isFinite(max) && max > 0) {
      return `${cur.toFixed(1)}/${max.toFixed(1)}`;
    }
  } catch {}
  return "unknown";
}

function getTagsLine(p) {
  try {
    const tags = p.getTags?.() ?? [];
    if (Array.isArray(tags) && tags.length) return tags.join(", ");
  } catch {}
  return "";
}

function getEffectsLine(p) {
  
  try {
    const effs = p.getEffects?.();
    if (Array.isArray(effs) && effs.length) {
      return effs
        .map((e) => {
          const id = e.typeId ?? e.type?.id ?? e.type ?? "effect";
          const amp = (e.amplifier ?? 0) + 1;
          const dur = e.duration ?? 0;
          return `${String(id).replace("minecraft:", "")} ${amp} (${dur})`;
        })
        .join(", ");
    }
  } catch {}

  
  return "";
}

function buildWhoisBody(p) {
  const loc = getLocation(p);
  const x = loc ? loc.x.toFixed(2) : "??";
  const y = loc ? loc.y.toFixed(2) : "??";
  const z = loc ? loc.z.toFixed(2) : "??";

  const dimId = String(p.dimension?.id ?? "");
  const gm = getGameModeBestEffort(p);
  const hp = getHealthLine(p);

  const lines = [];

  lines.push(`Name: ${p.name}`);
  lines.push(`Gamemode: ${gm}`);
  lines.push(`Health: ${hp}`);
  lines.push(`Dimension: ${dimId || "unknown"}`);
  lines.push(`Position: ${x}, ${y}, ${z}`);

  
  const statuses = [];
  if (getBoolProp(p, "acgod")) statuses.push("god");
  if (getBoolProp(p, "acblinded")) statuses.push("blinded");
  if (getBoolProp(p, "aclocked")) statuses.push("locked");
  if (getBoolProp(p, "acspectating")) statuses.push("spectating");
  if (getBoolProp(p, "acpunished")) statuses.push("punished");
  if (getStrProp(p, "actrail")) statuses.push("trail");
  if (getStrProp(p, "acname")) statuses.push("forcedName");

  lines.push(`Status: ${statuses.length ? statuses.join(", ") : "none"}`);

  const spect = getStrProp(p, "acspectateTarget");
  if (spect) lines.push(`Spectate target: ${spect}`);

  
  if (getBoolProp(p, "aclocked")) {
    const lx = getNumProp(p, "aclockX");
    const ly = getNumProp(p, "aclockY");
    const lz = getNumProp(p, "aclockZ");
    const ldim = getStrProp(p, "aclockDim");
    if (lx != null && ly != null && lz != null) {
      lines.push(`Lock pos: ${lx.toFixed(2)}, ${ly.toFixed(2)}, ${lz.toFixed(2)}`);
      if (ldim) lines.push(`Lock dim: ${ldim}`);
    }
  }

  
  if (getBoolProp(p, "acpunished")) {
    const px = getNumProp(p, "acpunishX");
    const py = getNumProp(p, "acpunishY");
    const pz = getNumProp(p, "acpunishZ");
    const pdim = getStrProp(p, "acpunishDim");
    const pgm = getStrProp(p, "acpunishGm");
    if (pgm) lines.push(`Saved GM: ${pgm}`);
    if (px != null && py != null && pz != null) {
      lines.push(`Punish pos: ${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)}`);
      if (pdim) lines.push(`Punish dim: ${pdim}`);
    }
  }

  
  const tags = getTagsLine(p);
  if (tags) lines.push(`Tags: ${tags}`);

  const effects = getEffectsLine(p);
  if (effects) lines.push(`Effects: ${effects}`);

  return lines.join("\n");
}

function pickTargetUI(executor, targets, onPick) {
  
  if (targets.length === 1) return onPick(targets[0]);

  const form = new ActionFormData()
    .title("Whois: pick a player")
    .body(`Matched ${targets.length} players.`);

  for (const t of targets) form.button(t.name);

  showWithRetry(executor, form, (res) => {
    if (res?.canceled) return;
    const idx = Number(res.selection ?? -1);
    if (!Number.isFinite(idx) || idx < 0 || idx >= targets.length) return;
    onPick(targets[idx]);
  });
}

function showWhoisUI(executor, target) {
  const body = buildWhoisBody(target);
  const form = new ActionFormData()
    .title(`Whois: ${target.name}`)
    .body(body)
    .button("OK");

  showWithRetry(executor, form, () => {});
}

export const whoisCommand = {
  name: "whois",
  minRank: 3, 
  usage: ":whois <selector>",
  description: "Shows detailed info about a player in a form.",
  examples: [":whois me", ":whois others", ":whois all"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    pickTargetUI(player, targets, (t) => showWhoisUI(player, t));
  },
};
