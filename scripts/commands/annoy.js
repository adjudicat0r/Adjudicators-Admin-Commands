import { selectPlayers } from "../lib/selectors.js";
import { clearAnnoyState, setAnnoyState } from "../system/annoy.js";

function normalizeSide(raw) {
  const side = String(raw ?? "back").trim().toLowerCase();
  if (side === "front" || side === "back") return side;
  return null;
}

export const annoyCommand = {
  name: "annoy",
  minRank: 3,
  usage: ":annoy <selector> [front|back]",
  description: "Rapidly teleports you in front of or behind targets while facing them.",
  examples: [
    ":annoy me",
    ":annoy others front",
    ":annoy entity:sheep back",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const side = normalizeSide(args[1] ?? "back");
    if (!side) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector).filter((target) => target?.id !== player.id);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    if (!setAnnoyState(player, targets, side)) {
      player.sendMessage("Failed to start annoy.");
      return;
    }

    player.sendMessage(`Now annoying ${targets.length} target(s) from the ${side}.`);
  },
};

export const unannoyCommand = {
  name: "unannoy",
  minRank: 3,
  usage: ":unannoy",
  description: "Stops the annoy teleport loop.",
  examples: [":unannoy"],

  execute({ player }) {
    const stopped = clearAnnoyState(player);
    player.sendMessage(stopped ? "Stopped annoying." : "You are not currently annoying anyone.");
  },
};
