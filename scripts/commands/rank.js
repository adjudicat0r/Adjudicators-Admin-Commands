import { selectPlayers } from "../lib/selectors.js";
import { getPlayerRank, setPlayerRank, rankName } from "../storage/db.js";

export const rankCommand = {
  name: "rank",
  minRank: 3, 
  usage: ":rank <get|set> <selector> [rank(1-6|name)]",
  description: "Gets or sets player ranks. Mod+ can view ranks; only the owner can set ranks.",
  examples: [
    ":rank get me",
    ":rank get @s",
    ":rank get @a",
    ":rank get adjudic4t0r",
    ":rank set me owner",
    ":rank set @p admin",
    ":rank set @a[team=staff] 4",
  ],


  execute({ player, args }) {
    const sub = (args[0] ?? "").toLowerCase();
    const selector = args[1] ?? "me";

    if (sub !== "get" && sub !== "set") {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    
    if (sub === "get") {
      if (targets.length === 1) {
        const t = targets[0];
        const r = getPlayerRank(t);
        player.sendMessage(`${t.name} rank: ${r} (${rankName(r)})`);
      } else {
        const counts = new Map();
        for (const t of targets) {
          const r = getPlayerRank(t);
          counts.set(r, (counts.get(r) ?? 0) + 1);
        }
        const parts = [...counts.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([r, c]) => `${r}(${rankName(r)}):${c}`);
        player.sendMessage(
          `Ranks for ${targets.length} player(s): ${parts.join("  ")}`
        );
      }
      return;
    }

    
    const isRankOwner = getPlayerRank(player) >= 6;

    if (!isRankOwner) {
      player.sendMessage("No permission. Only the owner can set ranks.");
      return;
    }

    const rawRank = args[2];
    const newRank = parseRank(rawRank);

    if (newRank == null) {
      player.sendMessage(
        "Bad rank. Use 1-6 or member/vip/mod/admin/headadmin/owner"
      );
      return;
    }

    if (newRank < 1 || newRank > 6) {
      player.sendMessage("Rank out of range (1..6).");
      return;
    }

    for (const t of targets) {
      setPlayerRank(t, newRank);
    }

    player.sendMessage(
      `Set rank to ${newRank} (${rankName(newRank)}) for ${targets.length} player(s).`
    );
  },
};

function parseRank(val) {
  if (val == null) return null;

  const n = Number(val);
  if (Number.isFinite(n) && n >= 1 && n <= 6) return n;

  const s = String(val).toLowerCase();
  if (s === "member") return 1;
  if (s === "vip") return 2;
  if (s === "mod") return 3;
  if (s === "admin") return 4;
  if (s === "headadmin" || s === "head") return 5;
  if (s === "owner") return 6;

  return null;
}
