
import { GameMode, world } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}

function modeToCmd(modeStr) {
  const s = normName(modeStr);
  if (s === "survival") return "survival";
  if (s === "creative") return "creative";
  if (s === "adventure") return "adventure";
  if (s === "spectator") return "spectator";
  return null;
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

function getModeBestEffort(p) {
  
  try {
    if (typeof p.getGameMode === "function") {
      const gm = p.getGameMode();
      
      const s = String(gm ?? "");
      return s.length ? s : null;
    }
  } catch {}
  return null;
}

function setDyn(p, k, v) {
  try { p.setDynamicProperty(k, v); } catch {}
}

function getDynString(p, k) {
  try {
    const v = p.getDynamicProperty(k);
    return typeof v === "string" && v.length ? v : null;
  } catch {
    return null;
  }
}

function runInputPerm(p, enabled) {
  
  
  const state = enabled ? "enabled" : "disabled";

  try {
    p.runCommandAsync?.(`inputpermission set @s movement ${state}`);
    return true;
  } catch {}
  try {
    p.runCommand?.(`inputpermission set @s movement ${state}`);
    return true;
  } catch {}
  return false;
}

export const punishCommand = {
  name: "punish",
  minRank: 3,
  usage: ":punish <selector>",
  description: "Punishes players: spectator + movement disabled (chat still works).",
  examples: [":punish me", ":punish others", ":punish all"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let ok = 0;

    for (const t of targets) {
      try {
        
        if (t.getDynamicProperty("acpunished") !== true) {
          const gm = getModeBestEffort(t);
          if (gm) setDyn(t, "acpunishGm", gm);
        }

        setDyn(t, "acpunished", true);

        
        try {
          const loc = t.location;
          if (loc) {
            setDyn(t, "acpunishX", Number(loc.x));
            setDyn(t, "acpunishY", Number(loc.y));
            setDyn(t, "acpunishZ", Number(loc.z));
            setDyn(t, "acpunishDim", String(t.dimension?.id ?? ""));
          }
        } catch {}

        
        setMode(player, t, "Spectator");
        runInputPerm(t, false);

        ok++;
      } catch {}
    }

    player.sendMessage(`Punished ${ok} player(s).`);
  },
};

export const unpunishCommand = {
  name: "unpunish",
  minRank: 3,
  usage: ":unpunish <selector>",
  description: "Removes punishment: movement enabled + restore saved gamemode (best effort).",
  examples: [":unpunish me", ":unpunish others", ":unpunish all"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let ok = 0;

    for (const t of targets) {
      try {
        
        runInputPerm(t, true);
        t.runCommand("inputpermission set @s movement enabled");
        
        
        const saved = getDynString(t, "acpunishGm");
        let restore = "Survival";
        if (saved) {
          const s = normName(saved);
          if (s.includes("creative")) restore = "Creative";
          else if (s.includes("adventure")) restore = "Adventure";
          else if (s.includes("spectator")) restore = "Spectator";
          else if (s.includes("survival")) restore = "Survival";
        }

        setMode(player, t, restore);

        
        setDyn(t, "acpunished", undefined);
        setDyn(t, "acpunishGm", undefined);
        setDyn(t, "acpunishX", undefined);
        setDyn(t, "acpunishY", undefined);
        setDyn(t, "acpunishZ", undefined);
        setDyn(t, "acpunishDim", undefined);

        ok++;
      } catch {}
    }

    player.sendMessage(`Unpunished ${ok} player(s).`);
  },
};
