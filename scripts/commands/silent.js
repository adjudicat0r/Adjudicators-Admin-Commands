export const silentCommand = {
  name: "silent",
  minRank: 3,
  usage: ":silent <command...>",
  description: "Runs another command without showing its normal chat feedback.",
  examples: [
    ":silent health me 5",
    ":silent skydive others",
    ":silent time night",
  ],

  execute({ player, args, manager }) {
    const commandText = String(args.join(" ") ?? "").trim();
    if (!commandText) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    manager.runFromSystem(player, `:${commandText}`, { silent: true });
  },
};
