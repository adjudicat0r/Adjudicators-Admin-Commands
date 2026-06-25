import { system } from "@minecraft/server";
import { getPlayerRank, pushAdminLog, getCommandMinRank } from "../storage/db.js";

export class CommandManager {
  constructor({ prefix = ":" } = {}) {
    this.prefix = prefix;
    this.commands = new Map();
  }

  register(cmd) {
    this.commands.set(cmd.name.toLowerCase(), cmd);
  }

  parse(rawMessage) {
    const text = rawMessage.slice(this.prefix.length).trim();
    if (!text) return null;
    const parts = text.split(/\s+/);
    const name = (parts.shift() ?? "").toLowerCase();
    return { name, args: parts, text };
  }

  getEffectiveMinRank(cmd) {
    const def = cmd.minRank ?? 1;
    return getCommandMinRank(cmd.name, def);
  }

  canRun(player, cmd) {
    const need = this.getEffectiveMinRank(cmd);
    const have = getPlayerRank(player);
    return have >= need;
  }

  runFromChat(player, rawMessage) {
    const parsed = this.parse(rawMessage);
    if (!parsed) return;

    const cmd = this.commands.get(parsed.name);
    if (!cmd) {
      player.sendMessage(`Unknown command: ${parsed.name}`);
      return;
    }

    const need = this.getEffectiveMinRank(cmd);
    if (!this.canRun(player, cmd)) {
      player.sendMessage(`No permission (need rank ${need}+).`);
      return;
    }

    pushAdminLog({
      t: Date.now(),
      by: player.name,
      rank: getPlayerRank(player),
      cmd: `${this.prefix}${parsed.text}`,
    });

    const ctx = {
      manager: this,
      player,
      raw: rawMessage,
      name: parsed.name,
      args: parsed.args,
      runCommand: (line) => this.runFromSystem(player, line),
      getEffectiveMinRank: (commandName) => {
        const c = this.commands.get(String(commandName).toLowerCase());
        if (!c) return null;
        return this.getEffectiveMinRank(c);
      },
    };

    try {
      cmd.execute(ctx);
    } catch (e) {
      player.sendMessage(`Command error: ${e?.message ?? e}`);
    }
  }

  runFromSystem(player, rawMessage) {
    this.runFromChat(player, rawMessage);
  }

  loop(player, times, intervalTicks, commandLine) {
    let i = 0;
    const tick = () => {
      if (i >= times) return;
      i++;
      this.runFromSystem(player, commandLine);
      system.runTimeout(tick, intervalTicks);
    };
    tick();
  }

  listCommands() {
    return [...this.commands.values()];
  }
}
