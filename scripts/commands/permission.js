import { parseRank, setCommandMinRank, resetCommandMinRank, getPermissionOverrides } from "../storage/db.js";

export const permissionCommand = {
  name: "permission",
  minRank: 6, 
  usage: ":permission <get|set|reset|list> [command] [rank required]",
  description: "Manages per-command minimum rank overrides",
  examples: [
    ":permission list",
    ":permission get log",
    ":permission set loop headadmin",
    ":permission set props 4",
    ":permission reset loop",
  ],


  execute({ player, args, manager }) {
    const sub = (args[0] ?? "").toLowerCase();

    if (sub === "list") {
      const perms = getPermissionOverrides();
      const entries = Object.entries(perms).sort((a, b) => a[0].localeCompare(b[0]));
      if (entries.length === 0) {
        player.sendMessage("No permission overrides set.");
        return;
      }
      player.sendMessage("Permission overrides:");
      for (const [cmd, lvl] of entries) {
        player.sendMessage(`- ${cmd}: ${lvl}`);
      }
      return;
    }

    if (sub === "get") {
      const cmdName = (args[1] ?? "").toLowerCase();
      if (!cmdName) {
        player.sendMessage("Usage: :permission get <command>");
        return;
      }
      const cmd = manager.listCommands().find(c => c.name.toLowerCase() === cmdName);
      if (!cmd) {
        player.sendMessage(`Unknown command: ${cmdName}`);
        return;
      }
      const eff = manager.getEffectiveMinRank(cmd);
      player.sendMessage(`${cmdName} requires rank ${eff}+`);
      return;
    }

    if (sub === "reset") {
      const cmdName = (args[1] ?? "").toLowerCase();
      if (!cmdName) {
        player.sendMessage("Usage: :permission reset <command>");
        return;
      }
      resetCommandMinRank(cmdName);
      player.sendMessage(`Reset permission override for ${cmdName}.`);
      return;
    }

    if (sub === "set") {
      const cmdName = (args[1] ?? "").toLowerCase();
      const lvlRaw = args[2];

      if (!cmdName || lvlRaw == null) {
        player.sendMessage("Usage: :permission set <command> <rank(1-6|name)>");
        return;
      }

      const lvl = parseRank(lvlRaw);
      if (lvl == null) {
        player.sendMessage("Bad rank. Use 1-6 or member/vip/mod/admin/headadmin/owner");
        return;
      }

      
      if (lvl < 1 || lvl > 6) {
        player.sendMessage("Rank out of range (1..6).");
        return;
      }

      
      const cmd = manager.listCommands().find(c => c.name.toLowerCase() === cmdName);
      if (!cmd) {
        player.sendMessage(`Unknown command: ${cmdName}`);
        return;
      }

      setCommandMinRank(cmdName, lvl);
      player.sendMessage(`Set ${cmdName} permission to rank ${lvl}+.`);
      return;
    }

    player.sendMessage("Usage:");
    player.sendMessage(":permission list");
    player.sendMessage(":permission get <command>");
    player.sendMessage(":permission set <command> <rank>");
    player.sendMessage(":permission reset <command>");
  },
};
