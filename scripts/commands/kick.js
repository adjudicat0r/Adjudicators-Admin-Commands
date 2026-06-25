
import { selectPlayers } from "../lib/selectors.js";

function joinReason(args, start) {
  return args.slice(start).join(" ").trim();
}

function formatKickMessage(kicker, reason) {
  return `Kicked by ${kicker}: ${reason}`;
}


function kickPlayer(target, message) {
  
  try {
    target.runCommand?.(`kick @s "${message.replace(/"/g, '\\"')}"`);
    return true;
  } catch {}

  try {
    target.runCommand?.(`kick @s "${message.replace(/"/g, '\\"')}"`);
    return true;
  } catch {}

  return false;
}

export const kickCommand = {
  name: "kick",
  minRank: 3, 
  usage: ":kick <selector> <reason...>",
  description: "Kicks players with a reason",
  examples: [
    ":kick me testing",
    ":kick others Stop that",
    ":kick all Server restarting",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const reason = joinReason(args, 1) || "No reason specified.";

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const msg = formatKickMessage(player.name, reason);

    let count = 0;
    for (const t of targets) {
      try {
        if (kickPlayer(t, msg)) count++;
      } catch {}
    }

    player.sendMessage(`Kicked ${count} player(s).`);
  },
};
