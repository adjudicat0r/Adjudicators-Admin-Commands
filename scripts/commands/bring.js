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

export const bringCommand = {
  name: "bring",
  minRank: 3, 
  usage: ":bring <selector|player>",
  description: "Teleports target player(s) to you.",
  examples: [":bring greg", ":bring others"],

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

    targets = targets.filter(p => p !== player);

    if (!targets.length) {
      player.sendMessage(`No players matched: ${input}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.teleport(player.location, {
          dimension: player.dimension,
        });
        count++;
      } catch {}
    }

    player.sendMessage(`brought ${count} player(s).`);
  },
};
