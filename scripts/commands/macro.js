import { system } from "@minecraft/server";
import {
  addMacroCommand,
  createMacro,
  deleteMacroCommand,
  destroyMacro,
  getMacro,
  listMacros,
} from "../storage/db.js";

function normalizeStoredLine(manager, text) {
  const line = String(text ?? "").trim();
  if (!line) return null;
  if (line.startsWith(":") || line.startsWith(";")) return line;
  return `${manager.prefix}${line}`;
}

function showUsage(player) {
  player.sendMessage("Usage:");
  player.sendMessage(":macro create <name>");
  player.sendMessage(":macro add <name> <command...>");
  player.sendMessage(":macro run <name>");
  player.sendMessage(":macro list [name]");
  player.sendMessage(":macro delete <name> <command...>");
  player.sendMessage(":macro destroy <name>");
}

export const macroCommand = {
  name: "macro",
  minRank: 5,
  usage: ":macro <create|add|run|list|delete|destroy> ...",
  description: "Saves multi-command sequences in world dynamic storage.",
  examples: [
    ":macro create resetarena",
    ":macro add resetarena kit load all sword",
    ":macro add resetarena bring all",
    ":macro run resetarena",
    ":macro list",
    ":macro list resetarena",
    ":macro delete resetarena bring all lobby",
    ":macro destroy resetarena",
  ],

  execute({ player, args, manager }) {
    const sub = String(args[0] ?? "").toLowerCase();
    const name = String(args[1] ?? "").trim();

    if (sub === "create") {
      if (!name) return showUsage(player);
      if (!createMacro(name)) {
        player.sendMessage("Failed to create macro.");
        return;
      }
      player.sendMessage(`Created macro ${name}.`);
      return;
    }

    if (sub === "add") {
      const line = String(args.slice(2).join(" ") ?? "").trim();
      if (!name || !line) return showUsage(player);
      if (!addMacroCommand(name, line)) {
        player.sendMessage(`Failed to add command to macro ${name}.`);
        return;
      }
      player.sendMessage(`Added command to macro ${name}: ${line}`);
      return;
    }

    if (sub === "run") {
      if (!name) return showUsage(player);
      const commands = getMacro(name);
      if (!commands) {
        player.sendMessage(`Macro not found: ${name}`);
        return;
      }
      if (!commands.length) {
        player.sendMessage(`Macro ${name} is empty.`);
        return;
      }

      let index = 0;
      const runNext = () => {
        if (index >= commands.length) return;
        const line = normalizeStoredLine(manager, commands[index]);
        index++;
        if (line) manager.runFromSystem(player, line);
        system.runTimeout(runNext, 1);
      };
      runNext();
      player.sendMessage(`Running macro ${name} (${commands.length} command(s)).`);
      return;
    }

    if (sub === "list") {
      if (!name) {
        const names = listMacros();
        if (!names.length) {
          player.sendMessage("No saved macros.");
          return;
        }
        player.sendMessage(`Macros: ${names.join(", ")}`);
        return;
      }

      const commands = getMacro(name);
      if (!commands) {
        player.sendMessage(`Macro not found: ${name}`);
        return;
      }
      if (!commands.length) {
        player.sendMessage(`Macro ${name} is empty.`);
        return;
      }

      player.sendMessage(`Macro ${name}:`);
      for (const [index, line] of commands.entries()) {
        player.sendMessage(`${index + 1}. ${line}`);
      }
      return;
    }

    if (sub === "delete") {
      const line = String(args.slice(2).join(" ") ?? "").trim();
      if (!name || !line) return showUsage(player);
      if (!deleteMacroCommand(name, line)) {
        player.sendMessage(`Command not found in macro ${name}: ${line}`);
        return;
      }
      player.sendMessage(`Deleted command from macro ${name}: ${line}`);
      return;
    }

    if (sub === "destroy") {
      if (!name) return showUsage(player);
      if (!destroyMacro(name)) {
        player.sendMessage(`Macro not found: ${name}`);
        return;
      }
      player.sendMessage(`Destroyed macro ${name}.`);
      return;
    }

    showUsage(player);
  },
};
