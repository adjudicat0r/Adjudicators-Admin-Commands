
import { selectPlayers } from "../lib/selectors.js";

export const spectateCommand = {
  name: "spectate",
  minRank: 3, 
  usage: ":spectate <selector>",
  description: "Starts spectating a target (camera is driven by loops.js).",
  examples: [":spectate greg", ":spectate others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector).filter(p => p !== player);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const target = targets[0];
    if (targets.length > 1) {
      player.sendMessage(`Multiple matched; spectating first: ${target.name}`);
    }

    try {
      player.setDynamicProperty("acspectating", true);
      player.setDynamicProperty("acspectateTarget", target.name); 
      player.sendMessage(`Now spectating ${target.name}.`);
    } catch {
      player.sendMessage(`Failed to start spectate.`);
    }
  },
};

export const unspectateCommand = {
  name: "unspectate",
  minRank: 3, 
  usage: ":unspectate",
  description: "Stops spectating.",
  examples: [":unspectate"],

  execute({ player }) {
    try {
      player.setDynamicProperty("acspectating", false);
      player.setDynamicProperty("acspectateTarget", undefined);

      
      try {
        player.runCommand?.(`camera @s clear`);
      } catch {}

      player.sendMessage(`Stopped spectating.`);
    } catch {
      player.sendMessage(`Failed to stop spectate.`);
    }
  },
};
