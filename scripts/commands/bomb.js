
export const bombCommand = {
  name: "bomb",
  minRank: 4, 
  usage: ":bomb <x> <y> <z> <radius> [fire] [water]",
  description: "Creates an explosion at exact coordinates.",
  examples: [
    ":bomb 0 64 0 6",
    ":bomb 100 70 -30 10 true",
    ":bomb 0 80 0 12 true false",
  ],

  execute({ player, args }) {
    const x = Number(args[0]);
    const y = Number(args[1]);
    const z = Number(args[2]);
    const radius = Number(args[3]);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const causesFire = String(args[4] ?? "false").toLowerCase() === "true";
    const allowUnderwater = String(args[5] ?? "true").toLowerCase() === "true";

    const r = Math.min(Math.floor(radius), 60);

    try {
      player.dimension.createExplosion(
        { x, y, z },
        r,
        {
          breaksBlocks: true,
          causesFire,
          allowUnderwater,
          source: player,
        }
      );

      player.sendMessage(
        `Bomb detonated at ${x} ${y} ${z} (r=${r}, fire=${causesFire}, water=${allowUnderwater}).`
      );
    } catch {
      player.sendMessage(`Explosion failed (invalid location or unloaded chunk).`);
    }
  },
};
