
export const xrayCommand = {
  name: "xray",
  minRank: 3, 
  usage: ':xray <blockId> <maxDistance>',
  description: "Scans around you for a block and faces it when found.",
  examples: [
    ":xray minecraft:diamond_ore 32",
    ":xray diamond_ore 32",
    ":xray ancient_debris 64",
  ],

  execute({ player, args }) {
    let blockId = String(args[0] ?? "").trim();
    const maxDistance = Number(args[1]);

    if (!blockId || !Number.isFinite(maxDistance) || maxDistance <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    if (!blockId.includes(":")) blockId = "minecraft:" + blockId;

    const max = Math.min(Math.floor(maxDistance), 96);
    const dim = player.dimension;

    const ox = Math.floor(player.location.x);
    const oy = Math.floor(player.location.y);
    const oz = Math.floor(player.location.z);

    let found = null;

    
    for (let r = 1; r <= max && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dz = -r; dz <= r && !found; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;

            const pos = { x: ox + dx, y: oy + dy, z: oz + dz };

            try {
              const block = dim.getBlock(pos);
              if (block && block.typeId === blockId) {
                found = pos;
              }
            } catch {}
          }
        }
      }
    }

    if (!found) {
      player.sendMessage(`No ${blockId} found within ${max} blocks.`);
      return;
    }

    const fx = found.x + 0.5;
    const fy = found.y - 1;
    const fz = found.z + 0.5;

    const cmd = `tp @s ~~~ facing ${fx} ${fy} ${fz}`;

    
    try {
      if (player.runCommand) {
        player.runCommand(cmd);
      } else {
        dim.runCommand(cmd);
      }
      player.sendMessage(`Found ${blockId} at ${found.x} ${found.y} ${found.z}.`);
    } catch {
      player.sendMessage(`Found ${blockId}, but failed to face it.`);
    }
  },
};
