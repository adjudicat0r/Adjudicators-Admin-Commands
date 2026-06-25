import { selectPlayers } from "../lib/selectors.js";

export const killCommand = {
  name: "kill",
  minRank: 3, 
  usage: ":kill <selector>",
  description: "Kills selected entities, preserving player gamemodes",
  examples: [
    ":kill",
    ":kill others",
    ":kill random",
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
        if (p.typeId === "minecraft:player") {
          const oldGamemode = p.getGameMode();
          player.sendMessage(`oldGamemode: ${oldGamemode}`);
          p.setGameMode("Survival");
          p.runCommand("kill @s");

          if (oldGamemode) {
            p.setGameMode(oldGamemode);
          }
        } else {
          p.runCommand("damage @s 999999 entity_attack");
        }

        count++;
      } catch {}
    }

    player.sendMessage(`killed ${count} entity(s).`);
  },
};
