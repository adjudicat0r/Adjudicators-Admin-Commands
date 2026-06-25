import { selectPlayers } from "../lib/selectors.js";

function findByNameFuzzy(executor, query) {
  const q = String(query ?? "").toLowerCase().trim();
  if (!q) return [];

  const all = selectPlayers(executor, "all");

  
  const exact = all.filter(
    p => (p.name ?? p.nameTag ?? "").toLowerCase() === q
  );
  if (exact.length) return exact;

  
  return all.filter(
    p => (p.name ?? p.nameTag ?? "").toLowerCase().includes(q)
  );
}

export const gotoCommand = {
  name: "goto",
  minRank: 1,
  usage: ":goto <player>",
  description: "Teleports you to a player.",
  examples: [":goto greg"],

  execute({ player, args }) {
    const input = args.join(" ").trim();
    if (!input) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    let targets = selectPlayers(player, input);
    if (!targets.length) {
      targets = findByNameFuzzy(player, input);
    }

    if (!targets.length) {
      player.sendMessage(`No player matched: ${input}`);
      return;
    }

    const target = targets[0];

    try {
      player.teleport(target.location, {
        dimension: target.dimension,
      });
      player.sendMessage(`teleported to ${target.name}`);
    } catch {
      player.sendMessage(`Teleport failed.`);
    }
  },
};
