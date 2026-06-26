import { selectPlayers } from "../lib/selectors.js";

function parseRange(value, fallback = 3) {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(32, Math.floor(n)));
}

function setAuraState(player, enabled, range) {
  try {
    player.setDynamicProperty("ackillaura", enabled);
    if (enabled) player.setDynamicProperty("ackillauraRange", range);
    else player.setDynamicProperty("ackillauraRange", undefined);
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
      ? `Enabled killaura for ${count} player(s) at ${range} block(s).`
      : `Disabled killaura for ${count} player(s).`
  );
}

export const killauraCommand = {
  name: "killaura",
  minRank: 3,
  usage: ":killaura <selector> [range]",
  description: "Automatically damages nearby entities in range.",
  examples: [":killaura me 5", ":killaura others 3"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: true });
  },
};

export const unkillauraCommand = {
  name: "unkillaura",
  minRank: 3,
  usage: ":unkillaura <selector>",
  description: "Stops killaura on selected players.",
  examples: [":unkillaura me", ":unkillaura others"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: false });
  },
};

export const kauraCommand = {
  name: "kaura",
  minRank: 3,
  usage: ":kaura <selector> [range]",
  description: "Alias of :killaura.",
  examples: [":kaura me 5", ":kaura others 3"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: true });
  },
};

export const unkauraCommand = {
  name: "unkaura",
  minRank: 3,
  usage: ":unkaura <selector>",
  description: "Alias of :unkillaura.",
  examples: [":unkaura me", ":unkaura others"],

  execute({ player, args }) {
    runAuraCommand({ player, args, enabled: false });
  },
};
