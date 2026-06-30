import { selectPlayers } from "../lib/selectors.js";
import { clearMorphForPlayer, setMorphState } from "../system/morph.js";

export const morphCommand = {
  name: "morph",
  minRank: 3,
  usage: ":morph <selector> <entity>",
  description: "Turns players invisible and mirrors them through a spawned entity morph.",
  examples: [
    ":morph me iron_golem",
    ":morph others zombie",
    ":morph steve minecraft:cow",
  ],

  execute({ player, args }) {
    const selector = String(args[0] ?? "").trim();
    const entityId = String(args[1] ?? "").trim();

    if (!selector || !entityId) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      const result = setMorphState(target, entityId);
      if (!result.ok) continue;
      count++;
    }

    if (!count) {
      player.sendMessage(`Failed to morph any player into ${entityId}.`);
      return;
    }

    player.sendMessage(`Morphed ${count} player(s) into ${entityId}.`);
  },
};

export const unmorphCommand = {
  name: "unmorph",
  minRank: 3,
  usage: ":unmorph <selector>",
  description: "Stops morphing players and removes their active morph entity.",
  examples: [
    ":unmorph me",
    ":unmorph others",
    ":unmorph steve",
  ],

  execute({ player, args }) {
    const selector = String(args[0] ?? "").trim();
    if (!selector) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      if (clearMorphForPlayer(target)) count++;
    }

    player.sendMessage(`Unmorphed ${count} player(s).`);
  },
};
