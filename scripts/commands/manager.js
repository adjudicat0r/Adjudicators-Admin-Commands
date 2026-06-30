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
    const prefix = String(rawMessage ?? "").startsWith(";") ? ";" : this.prefix;
    if (!String(rawMessage ?? "").startsWith(prefix)) return null;
    const text = rawMessage.slice(prefix.length).trim();
    if (!text) return null;
    const parts = text.split(/\s+/);
    const name = (parts.shift() ?? "").toLowerCase();
    return { name, args: parts, text, prefix };
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

  suggestCommandName(input) {
    const raw = String(input ?? "").trim().toLowerCase();
    if (!raw) return null;

    let bestName = null;
    let bestScore = Infinity;

    for (const cmd of this.commands.values()) {
      const candidate = String(cmd?.name ?? "").toLowerCase();
      if (!candidate) continue;

      const score = levenshteinDistance(raw, candidate);
      if (score < bestScore) {
        bestScore = score;
        bestName = candidate;
      }
    }

    if (bestName == null) return null;

    const length = raw.length;
    const threshold = length <= 4 ? 1 : length <= 7 ? 2 : 3;
    if (bestScore > threshold) return null;

    return bestName;
  }

  runFromChat(player, rawMessage, options = {}) {
    const silent = options?.silent === true;
    const parsed = this.parse(rawMessage);
    if (!parsed) return;

    const cmd = this.commands.get(parsed.name);
    if (!cmd) {
      if (!silent) {
        const suggestion = this.suggestCommandName(parsed.name);
        if (suggestion && suggestion !== parsed.name) {
          player.sendMessage(`Unknown command: ${parsed.name}. Did you mean :${suggestion}?`);
        } else {
          player.sendMessage(`Unknown command: ${parsed.name}`);
        }
      }
      return;
    }

    const need = this.getEffectiveMinRank(cmd);
    if (!this.canRun(player, cmd)) {
      if (!silent) {
        player.sendMessage(`No permission (need rank ${need}+).`);
      }
      return;
    }

    pushAdminLog({
      t: Date.now(),
      by: player.name,
      rank: getPlayerRank(player),
      cmd: `${parsed.prefix ?? this.prefix}${parsed.text}`,
    });

    const ctxPlayer = silent ? createSilentPlayerProxy(player) : player;
    const ctx = {
      manager: this,
      player: ctxPlayer,
      raw: rawMessage,
      name: parsed.name,
      args: parsed.args,
      runCommand: (line) => this.runFromSystem(player, line, { silent }),
      getEffectiveMinRank: (commandName) => {
        const c = this.commands.get(String(commandName).toLowerCase());
        if (!c) return null;
        return this.getEffectiveMinRank(c);
      },
    };

    try {
      cmd.execute(ctx);
    } catch (e) {
      if (!silent) {
        player.sendMessage(`Command error: ${e?.message ?? e}`);
      }
    }
  }

  runFromSystem(player, rawMessage, options = {}) {
    this.runFromChat(player, rawMessage, options);
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

function createSilentPlayerProxy(player) {
  return new Proxy(player, {
    get(target, prop, receiver) {
      if (prop === "sendMessage") {
        return () => {};
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function levenshteinDistance(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const rows = left.length + 1;
  const cols = right.length + 1;

  const table = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let row = 0; row < rows; row++) table[row][0] = row;
  for (let col = 0; col < cols; col++) table[0][col] = col;

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      table[row][col] = Math.min(
        table[row - 1][col] + 1,
        table[row][col - 1] + 1,
        table[row - 1][col - 1] + cost,
      );
    }
  }

  return table[rows - 1][cols - 1];
}
