
import { selectPlayers } from "../lib/selectors.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const boomCommand = {
  name: "boom",
  minRank: 3, 
  usage: ":boom <selector> <radius>",
  description: "Creates a non-griefing explosion at selectors (no block break).",
  examples: [":boom me 4", ":boom others 6"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const radius = num(args[1]);

    if (radius == null || radius <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const r = Math.min(Math.floor(radius), 30);

    let count = 0;
    for (const p of targets) {
      try {
        let px = p.location.x;
        let py = p.location.y + 1;
        let pz = p.location.z;
        p.dimension.createExplosion(
          { x: px, y: py, z: pz },
          r,
          {
            breaksBlocks: false,
            causesFire: false,
            allowUnderwater: true,
            source: player,
          }
        );
        count++;
      } catch {}
    }

    player.sendMessage(`Boomed ${count} player(s) (r=${r}, no grief).`);
  },
};

export const explodeCommand = {
  name: "explode",
  minRank: 4, 
  usage: ":explode <selector> <radius> [breaksBlocks] [causesFire] [allowUnderwater]",
  description: "Creates an explosion at selectors (optional grief/fire/underwater).",
  examples: [
    ":explode me 4",
    ":explode others 8 true false true",
    ":explode greg 6 true true",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const radius = num(args[1]);

    if (radius == null || radius <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const r = Math.min(Math.floor(radius), 60);

    const breaksBlocks = String(args[2] ?? "false").toLowerCase() === "true";
    const causesFire = String(args[3] ?? "false").toLowerCase() === "true";
    const allowUnderwater = String(args[4] ?? "true").toLowerCase() === "true";

    let count = 0;
    for (const p of targets) {
        let px = p.location.x;
        let py = p.location.y + 1;
        let pz = p.location.z;
      try {
        p.dimension.createExplosion(
          { x: px, y: py, z: pz },
          r,
          {
            breaksBlocks,
            causesFire,
            allowUnderwater,
            source: player,
          }
        );
        count++;
      } catch {}
    }

    player.sendMessage(
      `Exploded ${count} player(s) (r=${r}, breaksBlocks=${breaksBlocks}, fire=${causesFire}, underwater=${allowUnderwater}).`
    );
  },
};
