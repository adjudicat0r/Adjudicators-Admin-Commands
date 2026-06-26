import { world } from "@minecraft/server";

const RESPONSES = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
];

export const eightBallCommand = {
  name: "8ball",
  minRank: 0,
  usage: ":8ball <question>",
  description: "Answers with a Magic 8-Ball response.",
  examples: [
    ":8ball will Steve survive?",
  ],

  execute({ player, args }) {
    const question = String(args.join(" ") ?? "").trim();
    if (!question) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    world.sendMessage(`8-Ball for ${player.name}: ${answer}`);
  },
};
