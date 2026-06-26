import { selectPlayers } from "../lib/selectors.js";
import { jailPlayer } from "../system/jail.js";

export const jailCommand = {
  name: "jail",
  minRank: 3,
  usage: ":jail <selector> <seconds>",
  description: "Teleports players into a temporary obsidian and iron-bar jail.",
  examples: [":jail me 30", ":jail others 120", ":jail name:\"Steve\" 10"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const seconds = args[1];
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const duration = Math.floor(Number(seconds));
    if (!Number.isFinite(duration) || duration <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      const result = jailPlayer(target, duration);
      if (result?.ok) count++;
    }

    if (!count) {
      player.sendMessage("Failed to jail any players.");
      return;
    }

    player.sendMessage(`Jailed ${count} player(s) for ${duration} second(s).`);
  },
};
