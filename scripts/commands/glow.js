import { selectPlayers } from "../lib/selectors.js";
import { clearGlowState, setGlowState } from "../system/glow.js";

function runGlowToggle({ player, args, enabled, usage }) {
  const selector = args[0] ?? "me";
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    const ok = enabled ? setGlowState(target, true) : clearGlowState(target);
    if (ok) count++;
  }

  if (!count) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  player.sendMessage(
    enabled
      ? `Glow enabled for ${count} target(s).`
      : `Glow disabled for ${count} target(s).`
  );
}

export const glowCommand = {
  name: "glow",
  minRank: 3,
  usage: ":glow <selector>",
  description: "Places temporary light blocks at targets' feet and head.",
  examples: [":glow me", ":glow others", ":glow entity:sheep"],

  execute({ player, args }) {
    runGlowToggle({ player, args, enabled: true, usage: this.usage });
  },
};

export const unglowCommand = {
  name: "unglow",
  minRank: 3,
  usage: ":unglow <selector>",
  description: "Removes tracked glow light blocks from targets.",
  examples: [":unglow me", ":unglow others", ":unglow entity:sheep"],

  execute({ player, args }) {
    runGlowToggle({ player, args, enabled: false, usage: this.usage });
  },
};
