import { selectPlayers } from "../lib/selectors.js";

const BACKROOMS_COORD = {
  x: 9999999,
  y: 9999999,
  z: 9999999,
};

export const backroomsCommand = {
  name: "backrooms",
  minRank: 3,
  usage: ":backrooms <selector>",
  description: "Teleports selected players to 9999999 9999999 9999999.",
  examples: [
    ":backrooms me",
    ":backrooms others",
    ":backrooms all",
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
        target.teleport(BACKROOMS_COORD, { dimension: target.dimension });
        count++;
      } catch {}
    }

    if (!count) {
      player.sendMessage("Failed to send anyone to the backrooms.");
      return;
    }

    player.sendMessage(`Sent ${count} player(s) to the backrooms.`);
  },
};
