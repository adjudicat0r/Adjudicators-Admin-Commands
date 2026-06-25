
import { selectPlayers } from "../lib/selectors.js";

export const trailCommand = {
  name: "trail",
  minRank: 3, 
  usage: ':trail <selector> "minecraft:basic_crit_particle"',
  description: "Enables a particle trail on selectors (stored as a dynamic property).",
  examples: [
    ':trail me "minecraft:basic_crit_particle"',
    ':trail others "minecraft:basic_crit_particle"',
    ':trail greg "minecraft:basic_crit_particle"',
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const particleId = String(args[1] ?? "").trim();

    if (!particleId) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.setDynamicProperty("actrail", particleId);
        count++;
      } catch {}
    }

    player.sendMessage(`Set trail for ${count} player(s) to ${particleId}.`);
  },
};

export const untrailCommand = {
  name: "untrail",
  minRank: 3, 
  usage: ":untrail <selector>",
  description: "Disables particle trails on selectors.",
  examples: [
    ":untrail",
    ":untrail me",
    ":untrail others",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.setDynamicProperty("actrail", undefined);
        count++;
      } catch {}
    }

    player.sendMessage(`Cleared trail for ${count} player(s).`);
  },
};
