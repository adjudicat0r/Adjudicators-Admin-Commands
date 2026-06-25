import { selectPlayers } from "../lib/selectors.js";

export const effectCommand = {
  name: "effect",
  minRank: 3, 
  usage: ":effect <selector> <effect> <durationSeconds> [amplifier] [hideParticles]",
  description: "Applies a status effect to selected players",
  examples: [
    ":effect me speed 10",
    ":effect others strength 30 1",
    ":effect random regeneration 15 2 true",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const effect = args[1];
    const durationSeconds = Number(args[2]);
    const amplifier = args[3] != null ? Number(args[3]) : 0;
    const hideParticles =
      args[4] != null ? String(args[4]).toLowerCase() === "true" : false;

    if (!effect || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    if (args[3] != null && (!Number.isFinite(amplifier) || amplifier < 0)) {
      player.sendMessage(`Invalid amplifier: ${args[3]}`);
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
        p.runCommand(
          `effect @s ${effect} ${Math.floor(durationSeconds)} ${Math.floor(
            amplifier
          )} ${hideParticles}`
        );
        count++;
      } catch {}
    }

    player.sendMessage(
      `applied ${effect} for ${Math.floor(durationSeconds)}s to ${count} player(s).`
    );
  },
};
