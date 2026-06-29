import { selectPlayers } from "../lib/selectors.js";
import { clearNoclipState, setNoclipState } from "../system/noclip.js";

function runNoclipToggle({ player, args, enabled, usage }) {
  const selector = args[0] ?? "me";
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    const ok = enabled ? setNoclipState(target, true) : clearNoclipState(target);
    if (ok) count++;
  }

  if (!count) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  player.sendMessage(
    enabled
      ? `Noclip enabled for ${count} target(s).`
      : `Noclip disabled for ${count} target(s).`
  );
}

export const noclipCommand = {
  name: "noclip",
  minRank: 3,
  usage: ":noclip <selector>",
  description: "Lets targets phase through a wall when pressed fully against it.",
  examples: [":noclip me", ":noclip others", ":noclip entity:sheep"],

  execute({ player, args }) {
    runNoclipToggle({ player, args, enabled: true, usage: this.usage });
  },
};

export const clipCommand = {
  name: "clip",
  minRank: 3,
  usage: ":clip <selector>",
  description: "Disables noclip wall phasing for targets.",
  examples: [":clip me", ":clip others", ":clip entity:sheep"],

  execute({ player, args }) {
    runNoclipToggle({ player, args, enabled: false, usage: this.usage });
  },
};
