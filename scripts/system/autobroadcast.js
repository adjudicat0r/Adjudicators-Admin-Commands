import { system, world } from "@minecraft/server";
import { getAutobroadcasts, updateAutobroadcastState } from "../storage/db.js";

const TICK_INTERVAL = 20;

function normalizeEntry(entry) {
  const messages = Array.isArray(entry?.messages)
    ? entry.messages.map((text) => String(text ?? "").trim()).filter(Boolean)
    : [];

  return {
    messages,
    intervalMs: Math.max(1000, Math.floor(Number(entry?.intervalMs) || 600000)),
    nextIndex: Math.max(0, Math.floor(Number(entry?.nextIndex) || 0)),
    lastSentAt: Math.max(0, Math.floor(Number(entry?.lastSentAt) || 0)),
  };
}

function tickAutobroadcasts() {
  const now = Date.now();
  const broadcasts = getAutobroadcasts();

  for (const [name, rawEntry] of Object.entries(broadcasts)) {
    const entry = normalizeEntry(rawEntry);
    if (!entry.messages.length) continue;
    if (now - entry.lastSentAt < entry.intervalMs) continue;

    const index = entry.nextIndex % entry.messages.length;
    const message = entry.messages[index];
    world.sendMessage(`§6[Broadcast]§r ${message}`);

    updateAutobroadcastState(name, {
      nextIndex: (index + 1) % entry.messages.length,
      lastSentAt: now,
    });
  }
}

export function startAutobroadcastSystem() {
  system.runInterval(tickAutobroadcasts, TICK_INTERVAL);
}
