import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { getPlayerRank, rankName } from "../storage/db.js";

const S = "\u00A7";

export const helpCommand = {
  name: "help",
  minRank: 0,
  usage: ":help [command]",
  description: "Lists commands and usage",
  examples: [":help", ":help log", ":help smite"],

  async execute({ player, args, manager }) {
    try {
      const target = (args?.[0] ?? "").toLowerCase();
      const nav = createNavigator(player);

      if (target) {
        const cmd = manager?.commands?.get?.(target);
        if (!cmd) {
          player.sendMessage(`Unknown command "${target}".`);
          return;
        }
        await nav.push(screenCommandDetail(nav, manager, cmd));
        return;
      }

      await nav.push(screenCommandList(nav, manager));
    } catch (e) {
      player.sendMessage(`UI error: ${e?.message ?? e}`);
    }
  },
};

function forceOpen(player, form) {
  return new Promise((resolve) => {
    const tryShow = () => {
      system.run(() => {
        form
          .show(player)
          .then((res) => {
            if (res?.canceled && isUserBusy(res)) {
              system.runTimeout(tryShow, 2);
              return;
            }
            resolve(res);
          })
          .catch((error) => {
            console.warn("Error showing form:", error);
            resolve(undefined);
          });
      });
    };

    tryShow();
  });
}

function isUserBusy(res) {
  const r = res?.cancelationReason;

  if (r === FormCancelationReason?.userBusy) return true;
  if (r === FormCancelationReason?.UserBusy) return true;

  if (typeof r === "string") {
    const s = r.toLowerCase();
    return s === "userbusy" || s === "user_busy";
  }

  return false;
}

function createNavigator(player) {
  const stack = [];
  return {
    player,
    async push(screenFn) {
      stack.push(screenFn);
      await screenFn();
    },
    async back() {
      stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) await prev();
    },
    canBack() {
      return stack.length > 1;
    },
  };
}

function screenCommandList(nav, manager) {
  const state = {
    page: 0,
    pageSize: 10,
    showLocked: true,
  };

  return async function run() {
    const all = safeListCommands(manager).sort((a, b) => a.name.localeCompare(b.name));
    const cmds = state.showLocked ? all : all.filter((c) => canRun(manager, nav.player, c));

    if (!cmds.length) {
      nav.player.sendMessage("No commands available.");
      return;
    }

    const pageCount = Math.max(1, Math.ceil(cmds.length / state.pageSize));
    state.page = clamp(state.page, 0, pageCount - 1);

    const start = state.page * state.pageSize;
    const pageCmds = cmds.slice(start, start + state.pageSize);

    const form = new ActionFormData()
      .title("Help")
      .body(
        [
          `Commands: ${cmds.length}${state.showLocked ? " (including locked)" : ""}`,
          `Page: ${state.page + 1}/${pageCount}`,
          buildRankLine(nav.player, 0),
          "",
          "Pick a command to view details.",
          "Tip: :help <command> opens details directly.",
        ].join("\n")
      );

    for (const c of pageCmds) {
      const ok = canRun(manager, nav.player, c);
      const required = Number.isFinite(c?.minRank) ? c.minRank : 0;
      const icon = ok ? `${S}2${S}r` : `${S}c${S}r`;
      const name = ok ? `${S}2:${c.name}${S}r` : `${S}c:${c.name}${S}r`;
      const desc = c?.description ?? "No description.";
      form.button(`${icon} ${name}\n${S}0${desc}${S}r\n${buildRequiredLine(required)}`);
    }

    if (pageCount > 1) {
      form.button("Prev page");
      form.button("Next page");
    }

    form.button(state.showLocked ? "Hide locked" : "Show locked");

    if (nav.canBack()) form.button("Back");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    let idx = res.selection;

    if (idx < pageCmds.length) {
      const cmd = pageCmds[idx];
      return nav.push(screenCommandDetail(nav, manager, cmd));
    }
    idx -= pageCmds.length;

    if (pageCount > 1) {
      if (idx === 0) {
        state.page--;
        return run();
      }
      if (idx === 1) {
        state.page++;
        return run();
      }
      idx -= 2;
    }

    if (idx === 0) {
      state.showLocked = !state.showLocked;
      state.page = 0;
      return run();
    }
    idx -= 1;

    if (nav.canBack() && idx === 0) return nav.back();
  };
}

function screenCommandDetail(nav, manager, cmd) {
  return async function run() {
    const ok = canRun(manager, nav.player, cmd);
    const required = Number.isFinite(cmd?.minRank) ? cmd.minRank : 0;
    const usage = cmd?.usage ?? `:${cmd?.name ?? "?"}`;
    const desc = cmd?.description ?? "No description.";
    const examples = Array.isArray(cmd?.examples) ? cmd.examples : [];
    const rankLine = buildRankLine(nav.player, required);

    const header = [
      `${ok ? `${S}aAllowed${S}r` : `${S}cLocked${S}r`}  ${buildRequiredLine(required)}`,
      rankLine,
      "",
      `${S}f${usage}${S}r`,
      "",
      desc,
      "",
      examples.length ? "Examples:" : "",
      ...examples.map((x) => `  ${S}7${x}${S}r`),
    ]
      .filter(Boolean)
      .join("\n");

    const form = new ActionFormData().title(`:${cmd?.name ?? "?"}`).body(header);

    form.button("Copy usage to chat");
    form.button("List all commands");

    if (nav.canBack()) form.button("Back");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    if (res.selection === 0) {
      nav.player.sendMessage(`${ok ? `${S}a[+]${S}r` : `${S}c[Locked]${S}r`} :${cmd.name}  ${buildRequiredLine(required)}`);
      nav.player.sendMessage(`${S}fUsage:${S}r ${usage}`);
      if (desc) nav.player.sendMessage(`${S}7${desc}${S}r`);
      if (examples.length) {
        nav.player.sendMessage(`${S}fExamples:${S}r`);
        for (const ex of examples) nav.player.sendMessage(`  ${S}7${ex}${S}r`);
      }
      return;
    }

    if (res.selection === 1) {
      return nav.push(screenCommandList(nav, manager));
    }

    if (nav.canBack()) return nav.back();
  };
}

function safeListCommands(manager) {
  try {
    const list = manager?.listCommands?.();
    if (Array.isArray(list)) return list.slice();
  } catch {}

  try {
    const map = manager?.commands;
    if (map && typeof map.values === "function") return Array.from(map.values());
  } catch {}

  return [];
}

function canRun(manager, player, cmd) {
  try {
    return !!manager?.canRun?.(player, cmd);
  } catch {
    return false;
  }
}

function buildRankLine(player, requiredMinRank) {
  const you = tryGetPlayerRank(player);
  if (you === undefined) return `${S}8Your rank: Unknown${S}r`;
  const ok = you >= requiredMinRank;
  return `${ok ? `${S}a` : `${S}c`}Your rank: ${formatRank(you)}${S}r`;
}

function tryGetPlayerRank(player) {
  try {
    const rank = getPlayerRank(player);
    return Number.isFinite(rank) ? rank : undefined;
  } catch {
    return undefined;
  }
}

function buildRequiredLine(requiredRank) {
  return `${rankColor(requiredRank)}(Required: ${formatRank(requiredRank)})${S}r`;
}

function formatRank(rank) {
  const safeRank = Number.isFinite(rank) ? rank : 0;
  return `${rankLabel(safeRank)}[${safeRank}]`;
}

function rankLabel(rank) {
  const raw = rankName(rank);
  return String(raw ?? "unknown")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function rankColor(rank) {
  switch (Number(rank)) {
    case 6: return `${S}6`;
    case 5: return `${S}5`;
    case 4: return `${S}c`;
    case 3: return `${S}3`;
    case 2: return `${S}b`;
    default: return `${S}7`;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
