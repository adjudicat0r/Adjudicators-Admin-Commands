import { system, world } from "@minecraft/server";
import { handleCommandMessage } from "../commands/index.js";
import { getChatFilterList, getChatFilterMode } from "../storage/db.js";

const S = "\u00A7";

function getStringProp(player, key) {
  try {
    const v = player.getDynamicProperty(key);
    return typeof v === "string" && v.length ? v : null;
  } catch {
    return null;
  }
}

function getChatName(player) {
  const forced = getStringProp(player, "acname");
  if (forced) return forced.replace(new RegExp(`^${S}r`), "");

  try {
    const name = String(player?.name ?? "").trim();
    if (name) return name;
  } catch {}

  try {
    const nameTag = String(player?.nameTag ?? "").trim();
    if (nameTag) return nameTag.replace(new RegExp(`${S}.`, "g"), "");
  } catch {}

  const typeId = String(player?.typeId ?? "target");
  return typeId
    .replace(/^minecraft:/i, "")
    .replace(/_/g, " ");
}

export function sendChatAsPlayer(player, message) {
  const name = getChatName(player);
  world.sendMessage(`[${name}]: ${message}`);
}

function escapeRegex(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scrambleText(text) {
  const glyphs = ["!", "@", "#", "$", "%", "&", "*", "?", "+", "~"];
  let out = "";
  for (const ch of String(text ?? "")) {
    out += /[a-z0-9]/i.test(ch)
      ? glyphs[Math.floor(Math.random() * glyphs.length)]
      : ch;
  }
  return out;
}

function redactText(text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    out += /[a-z0-9]/i.test(ch) ? "#" : ch;
  }
  return `${S}c${out}${S}r`;
}

function transformFilteredMessage(message, blockedEntries, mode) {
  let next = String(message ?? "");
  const entries = blockedEntries.slice().sort((a, b) => b.length - a.length);

  for (const entry of entries) {
    if (!entry) continue;
    const pattern = new RegExp(escapeRegex(entry), "gi");
    next = next.replace(pattern, (match) => {
      if (mode === "scramble") return scrambleText(match);
      if (mode === "redact") return redactText(match);
      return match;
    });
  }

  return next;
}

export function handleChatMessage(event) {
  const player = event.sender;
  const msg = event.message;

  if (!msg) return;

  const isCommand =
    msg.startsWith(".") ||
    msg.startsWith(":") ||
    msg.startsWith(";");

  if (msg.startsWith(".")) {
    event.cancel = true;
    system.run(() => handleCommandMessage(player, msg));
    return;
  }
  if (msg.startsWith(":")) {
    system.run(() => handleCommandMessage(player, msg));
    return;
  }
  if (msg.startsWith(";")) {
    system.run(() => handleCommandMessage(player, msg));
    return;
  }

  if (!isCommand) {
    const lowered = msg.toLowerCase();
    const blocked = getChatFilterList().filter((entry) => entry && lowered.includes(entry));
    if (blocked.length) {
      event.cancel = true;
      const mode = getChatFilterMode();
      if (mode === "block") {
        player.sendMessage("That message contains a blocked word or phrase.");
        return;
      }

      const filtered = transformFilteredMessage(msg, blocked, mode);
      sendChatAsPlayer(player, filtered);
      return;
    }
  }

  event.cancel = true;
  sendChatAsPlayer(player, msg);
}

export function startChatSystem() {
  world.beforeEvents.chatSend.subscribe(handleChatMessage);
}
