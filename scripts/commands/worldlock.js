import { isWorldLocked, setWorldLocked } from "../storage/db.js";

export const worldlockCommand = {
  name: "worldlock",
  minRank: 4,
  usage: ":worldlock",
  description: "Prevents players and explosions from changing the map.",
  examples: [
    ":worldlock",
  ],

  execute({ player }) {
    if (isWorldLocked()) {
      player.sendMessage("Worldlock is already enabled.");
      return;
    }

    setWorldLocked(true);
    player.sendMessage("Worldlock enabled.");
  },
};

export const unworldlockCommand = {
  name: "unworldlock",
  minRank: 4,
  usage: ":unworldlock",
  description: "Allows block changes and explosions again.",
  examples: [
    ":unworldlock",
  ],

  execute({ player }) {
    if (!isWorldLocked()) {
      player.sendMessage("Worldlock is already disabled.");
      return;
    }

    setWorldLocked(false);
    player.sendMessage("Worldlock disabled.");
  },
};
