
import { selectPlayers } from "../lib/selectors.js";

export const tpCommand = {
  name: "tp",
  minRank: 3, 
  usage: ":tp <selector> <x> <y> <z>",
  description: "Teleports selectors to exact coordinates.",
  examples: [
    ":tp me 0 100 0",
    ":tp greg 123 64 -45",
    ":tp others ~ ~10 ~",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const rawX = args[1];
    const rawY = args[2];
    const rawZ = args[3];

    if (rawX == null || rawY == null || rawZ == null) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    function parseCoord(raw, base) {
      if (raw === "~") return base;
      if (typeof raw === "string" && raw.startsWith("~")) {
        const off = Number(raw.slice(1));
        return base + (Number.isFinite(off) ? off : 0);
      }
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }

    let count = 0;
    for (const p of targets) {
      try {
        const base = p.location;
        const x = parseCoord(rawX, base.x);
        const y = parseCoord(rawY, base.y);
        const z = parseCoord(rawZ, base.z);

        if (x == null || y == null || z == null) continue;

        p.teleport(
          { x, y, z },
          { dimension: p.dimension }
        );
        count++;
      } catch {}
    }

    if (count === 0) {
      player.sendMessage(`Invalid coordinates.`);
    } else {
      player.sendMessage(`Teleported ${count} player(s).`);
    }
  },
};
