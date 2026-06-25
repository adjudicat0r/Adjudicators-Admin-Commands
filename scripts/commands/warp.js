
import { world } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

const KEY = "acwarps";

function getWarps() {
  try {
    return JSON.parse(world.getDynamicProperty(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveWarps(warps) {
  try {
    world.setDynamicProperty(KEY, JSON.stringify(warps));
  } catch {}
}

function normName(name) {
  return String(name ?? "").toLowerCase().trim();
}

function dimFromId(dimId) {
  const s = String(dimId ?? "").toLowerCase();
  if (s.includes("nether")) return world.getDimension("nether");
  if (s.includes("end")) return world.getDimension("the_end");
  return world.getDimension("overworld");
}

export const warpCommand = {
  name: "warp",
  minRank: 1,
  usage: ":warp <name> [selector] | :warp list",
  description: "Teleports players to a warp, or lists warps.",
  examples: [":warp spawn", ":warp arena others", ":warp list"],

  execute({ player, args }) {
    const sub = normName(args[0]);
    const warps = getWarps();

    if (!sub) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    if (sub === "list") {
      const names = Object.keys(warps);
      if (!names.length) {
        player.sendMessage("No warps set.");
        return;
      }
      player.sendMessage(`Warps (${names.length}): ${names.join(", ")}`);
      return;
    }

    const name = sub;
    const selector = args[1] ?? "me";
    const warp = warps[name];

    if (!warp) {
      player.sendMessage(`Warp "${name}" does not exist.`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const dim = dimFromId(warp.dim);
    let count = 0;

    for (const p of targets) {
      try {
        p.teleport({ x: warp.x, y: warp.y, z: warp.z }, { dimension: dim });
        count++;
      } catch {}
    }

    player.sendMessage(`Warped ${count} player(s) to "${name}".`);
  },
};

export const setwarpCommand = {
  name: "setwarp",
  minRank: 4, 
  usage: ":setwarp <name>",
  description: "Creates or overwrites a warp at your location.",
  examples: [":setwarp spawn"],

  execute({ player, args }) {
    const name = normName(args[0]);
    if (!name) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const warps = getWarps();
    const loc = player.location;

    warps[name] = {
      x: loc.x,
      y: loc.y,
      z: loc.z,
      dim: player.dimension.id,
    };

    saveWarps(warps);
    player.sendMessage(`Warp "${name}" set.`);
  },
};

export const delwarpCommand = {
  name: "delwarp",
  minRank: 4, 
  usage: ":delwarp <name>",
  description: "Deletes a warp.",
  examples: [":delwarp spawn"],

  execute({ player, args }) {
    const name = normName(args[0]);
    if (!name) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const warps = getWarps();
    if (!warps[name]) {
      player.sendMessage(`Warp "${name}" does not exist.`);
      return;
    }

    delete warps[name];
    saveWarps(warps);
    player.sendMessage(`Warp "${name}" deleted.`);
  },
};
