import { selectPlayers } from "../lib/selectors.js";

function parseRange(value, fallback = 3) {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function setAuraState(player, enabled, range) {
  try {
    player.setDynamicProperty("accrystalaura", enabled);
    if (enabled) player.setDynamicProperty("accrystalauraRange", range);
    else player.setDynamicProperty("accrystalauraRange", undefined);
  } catch {}
}

function runAuraCommand({ player, args, enabled }) {
  const selector = args[0] ?? "me";
  const range = parseRange(args[1], 3);
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    try {
      setAuraState(target, enabled, range);
      count++;
    } catch {}
  }

  player.sendMessage(
    enabled
      ? `Enabled crystalaura for ${count} player(s) at ${range} block(s).`
      : `Disabled crystalaura for ${count} player(s).`
  );
}

export const crystalauraCommand = {
  name: "crystalaura",
  minRank: 3,
  usage: ":crystalaura <selector> [range]",
  description: "Automatically attacks nearby end crystals in range.",
  examples: [":crystalaura me 5", ":crystalaura others 3"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: true });
  },
};

export const uncrystalauraCommand = {
  name: "uncrystalaura",
  minRank: 3,
  usage: ":uncrystalaura <selector>",
  description: "Stops crystalaura on selected players.",
  examples: [":uncrystalaura me", ":uncrystalaura others"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: false });
  },
};
