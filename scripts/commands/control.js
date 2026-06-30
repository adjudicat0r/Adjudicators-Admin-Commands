import { selectPlayers } from "../lib/selectors.js";
import { clearControlForController, setControlState } from "../system/control.js";

export const controlCommand = {
  name: "control",
  minRank: 3,
  usage: ":control <selector>",
  description: "Lets you take over one player or entity at a time.",
  examples: [
    ":control steve",
    ":control entity:rabbit",
    ":control entity:iron_golem",
  ],

  execute({ player, args }) {
    const selector = String(args[0] ?? "").trim();
    if (!selector) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector).filter((target) => target?.id !== player.id);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const target = targets[0];
    if (targets.length > 1) {
      try {
        player.sendMessage("Multiple matched; controlling first target.");
      } catch {}
    }

    const result = setControlState(player, target);
    if (!result.ok) {
      if (result.error === "already-controlled") {
        player.sendMessage("That target is already being controlled.");
        return;
      }

      player.sendMessage("Failed to start control.");
      return;
    }

    const label = String(target.nameTag ?? target.name ?? target.typeId ?? "target");
    player.sendMessage(`Now controlling ${label}.`);
  },
};

export const uncontrolCommand = {
  name: "uncontrol",
  minRank: 3,
  usage: ":uncontrol",
  description: "Stops controlling your current target.",
  examples: [
    ":uncontrol",
  ],

  execute({ player }) {
    if (!clearControlForController(player)) {
      player.sendMessage("You are not controlling anything.");
      return;
    }

    player.sendMessage("Stopped controlling target.");
  },
};
