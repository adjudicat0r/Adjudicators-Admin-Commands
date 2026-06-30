import { selectPlayers } from "../lib/selectors.js";

export const skydiveCommand = {
  name: "skydive",
  minRank: 3,
  usage: ":skydive <selector>",
  description: "Teleports targets 1000 blocks upward from their current position.",
  examples: [
    ":skydive me",
    ":skydive others",
    ":skydive entity:rabbit",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      try {
        const loc = target.location;
        target.teleport(
          {
            x: loc.x,
            y: loc.y + 1000,
            z: loc.z,
          },
          { dimension: target.dimension }
        );
        count++;
      } catch {}
    }

    if (!count) {
      player.sendMessage("Failed to skydive any targets.");
      return;
    }

    player.sendMessage(`Sent ${count} target(s) skydiving.`);
  },
};
