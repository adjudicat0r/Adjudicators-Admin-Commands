
import { GameMode, world } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}

function parseGamemode(v) {
  const s = normName(v);

  
  if (s === "0" || s === "s" || s === "survival") return "Survival";
  if (s === "1" || s === "c" || s === "creative") return "Creative";
  if (s === "2" || s === "a" || s === "adventure") return "Adventure";
  if (s === "3" || s === "sp" || s === "spec" || s === "spectator") return "Spectator";

  return null;
}

function modeToCmd(modeStr) {
  const s = normName(modeStr);
  if (s === "survival") return "survival";
  if (s === "creative") return "creative";
  if (s === "adventure") return "adventure";
  if (s === "spectator") return "spectator";
  return null;
}

function getTargets(executor, selectorRaw) {
  const sel = normName(selectorRaw);

  
  if (!sel || sel === "me" || sel === "self" || sel === "@s") return [executor];

  
  return selectPlayers(executor, selectorRaw);
}

function setMode(executor, target, modeStr) {
  
  try {
    if (typeof target.setGameMode === "function") {
      
      
      try {
        target.setGameMode(modeStr);
        return true;
      } catch {}

      const enumVal = GameMode?.[modeStr]; 
      if (enumVal != null) {
        target.setGameMode(enumVal);
        return true;
      }
    }
  } catch {}

  
  const gm = modeToCmd(modeStr);
  if (!gm) return false;

  try {
    if (typeof target.runCommandAsync === "function") {
      target.runCommandAsync(`gamemode ${gm} @s`);
      return true;
    }
  } catch {}
  try {
    if (typeof target.runCommand === "function") {
      target.runCommand(`gamemode ${gm} @s`);
      return true;
    }
  } catch {}

  
  
  try {
    const name = String(target.name ?? "").replace(/"/g, '\\"');
    if (!name) return false;

    if (typeof executor.runCommandAsync === "function") {
      executor.runCommandAsync(`gamemode ${gm} "${name}"`);
      return true;
    }
  } catch {}
  try {
    const name = String(target.name ?? "").replace(/"/g, '\\"');
    if (!name) return false;

    if (typeof executor.runCommand === "function") {
      executor.runCommand(`gamemode ${gm} "${name}"`);
      return true;
    }
  } catch {}

  try {
    const name = String(target.name ?? "").replace(/"/g, '\\"');
    if (!name) return false;

    const dim = executor.dimension ?? world.getDimension("overworld");
    if (typeof dim.runCommandAsync === "function") {
      dim.runCommandAsync(`gamemode ${gm} "${name}"`);
      return true;
    }
  } catch {}

  return false;
}

function runGamemodeChange(executor, selector, modeStr, label) {
  const targets = getTargets(executor, selector);

  if (!targets.length) {
    executor.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let ok = 0;
  for (const t of targets) {
    try {
      if (setMode(executor, t, modeStr)) ok++;
    } catch {}
  }

  executor.sendMessage(`Set gamemode to ${label} for ${ok} player(s).`);
}

export const gamemodeCommand = {
  name: "gamemode",
  minRank: 3, 
  usage: ":gamemode <selector> <mode>  (mode: s|c|a|sp or 0-3)",
  description: "Sets a player's gamemode.",
  examples: [":gamemode me c", ":gamemode all survival", ":gmc", ":gms all"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const modeStr = parseGamemode(args[1]);

    if (!modeStr) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    runGamemodeChange(player, selector, modeStr, normName(args[1]));
  },
};



export const gmsCommand = {
  name: "gms",
  minRank: 3,
  usage: ":gms [selector]",
  description: "Gamemode survival.",
  examples: [":gms", ":gms all"],
  execute({ player, args }) {
    runGamemodeChange(player, args[0] ?? "me", "Survival", "survival");
  },
};

export const gmcCommand = {
  name: "gmc",
  minRank: 3,
  usage: ":gmc [selector]",
  description: "Gamemode creative.",
  examples: [":gmc", ":gmc all"],
  execute({ player, args }) {
    runGamemodeChange(player, args[0] ?? "me", "Creative", "creative");
  },
};

export const gmaCommand = {
  name: "gma",
  minRank: 3,
  usage: ":gma [selector]",
  description: "Gamemode adventure.",
  examples: [":gma", ":gma all"],
  execute({ player, args }) {
    runGamemodeChange(player, args[0] ?? "me", "Adventure", "adventure");
  },
};

export const gmspCommand = {
  name: "gmsp",
  minRank: 3,
  usage: ":gmsp [selector]",
  description: "Gamemode spectator.",
  examples: [":gmsp", ":gmsp all"],
  execute({ player, args }) {
    runGamemodeChange(player, args[0] ?? "me", "Spectator", "spectator");
  },
};
