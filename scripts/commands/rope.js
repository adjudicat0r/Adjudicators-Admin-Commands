import { selectPlayers } from "../lib/selectors.js";
import { clearRopeState, setRopeState } from "../system/rope.js";

function buildPairs(firstTargets, secondTargets) {
  const pairs = [];
  const seen = new Set();

  for (const first of firstTargets) {
    for (const second of secondTargets) {
      if (!first?.id || !second?.id || first.id === second.id) continue;
      const key = first.id < second.id ? `${first.id}|${second.id}` : `${second.id}|${first.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([first, second]);
    }
  }

  return pairs;
}

export const ropeCommand = {
  name: "rope",
  minRank: 3,
  usage: ":rope <selector1> <selector2> <length>",
  description: "Connects targets with a particle rope that pulls them together when stretched.",
  examples: [
    ":rope me others 6",
    ":rope steve alex 10",
    ":rope entity:cow entity:sheep 4",
  ],

  execute({ player, args }) {
    const rawFirst = String(args[0] ?? "").trim();
    const rawSecond = String(args[1] ?? "").trim();
    const length = Number(args[2]);

    if (!rawFirst || !rawSecond || !Number.isFinite(length) || length <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const firstTargets = selectPlayers(player, rawFirst);
    const secondTargets = selectPlayers(player, rawSecond);

    if (!firstTargets.length) {
      player.sendMessage(`No targets matched: ${rawFirst}`);
      return;
    }
    if (!secondTargets.length) {
      player.sendMessage(`No targets matched: ${rawSecond}`);
      return;
    }

    const pairs = buildPairs(firstTargets, secondTargets);
    if (!pairs.length) {
      player.sendMessage("No valid rope pairs could be created.");
      return;
    }

    let count = 0;
    let appliedLength = length;
    for (const [first, second] of pairs) {
      const result = setRopeState(first, second, length);
      if (!result.ok) continue;
      appliedLength = result.length;
      count++;
    }

    if (!count) {
      player.sendMessage("Failed to create any rope links.");
      return;
    }

    player.sendMessage(`Created ${count} rope link(s) with length ${appliedLength}.`);
  },
};

export const unropeCommand = {
  name: "unrope",
  minRank: 3,
  usage: ":unrope <selector1> [selector2]",
  description: "Removes rope links from targets, or between two target groups.",
  examples: [
    ":unrope me",
    ":unrope steve alex",
    ":unrope entity:cow entity:sheep",
  ],

  execute({ player, args }) {
    const rawFirst = String(args[0] ?? "").trim();
    const rawSecond = String(args[1] ?? "").trim();

    if (!rawFirst) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const firstTargets = selectPlayers(player, rawFirst);
    if (!firstTargets.length) {
      player.sendMessage(`No targets matched: ${rawFirst}`);
      return;
    }

    let count = 0;
    if (!rawSecond) {
      for (const first of firstTargets) {
        count += clearRopeState(first);
      }
    } else {
      const secondTargets = selectPlayers(player, rawSecond);
      if (!secondTargets.length) {
        player.sendMessage(`No targets matched: ${rawSecond}`);
        return;
      }

      for (const [first, second] of buildPairs(firstTargets, secondTargets)) {
        count += clearRopeState(first, second);
      }
    }

    player.sendMessage(`Removed ${count} rope link(s).`);
  },
};
