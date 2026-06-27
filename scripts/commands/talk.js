import { selectPlayers } from "../lib/selectors.js";
import { sendChatAsPlayer } from "../system/chats.js";

function runTalk({ player, args, usage }) {
  const selector = args[0] ?? "me";
  const message = String(args.slice(1).join(" ") ?? "").trim();

  if (!message) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  const targets = selectPlayers(player, selector);
  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    try {
      sendChatAsPlayer(target, message);
      count++;
    } catch {}
  }

  player.sendMessage(`Forced ${count} target(s) to speak.`);
}

export const talkCommand = {
  name: "talk",
  minRank: 3,
  usage: ":talk <selector> <message...>",
  description: "Forces selected targets to send a chat message.",
  examples: [
    ":talk Steve hello there",
    ":talk others follow me",
  ],

  execute({ player, args }) {
    runTalk({ player, args, usage: this.usage });
  },
};

export const chatCommand = {
  name: "chat",
  minRank: 3,
  usage: ":chat <selector> <message...>",
  description: "Alias of :talk.",
  examples: [
    ":chat Steve hello there",
    ":chat others follow me",
  ],

  execute({ player, args }) {
    runTalk({ player, args, usage: this.usage });
  },
};
