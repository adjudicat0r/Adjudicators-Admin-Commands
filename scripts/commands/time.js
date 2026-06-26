const TIME_MAP = {
  day: "day",
  night: "night",
  sunrise: "sunrise",
  sunset: "sunset",
};

export const timeCommand = {
  name: "time",
  minRank: 3,
  usage: ":time <day|night|sunrise|sunset>",
  description: "Sets the world time to a named preset.",
  examples: [
    ":time day",
    ":time night",
    ":time sunrise",
    ":time sunset",
  ],

  execute({ player, args }) {
    const mode = String(args[0] ?? "").toLowerCase();
    const preset = TIME_MAP[mode];

    if (!preset) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    try {
      player.runCommand(`time set ${preset}`);
      player.sendMessage(`Set time to ${preset}.`);
    } catch (error) {
      player.sendMessage(`Failed to set time: ${error?.message ?? error}`);
    }
  },
};
