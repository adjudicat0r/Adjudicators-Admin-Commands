const WEATHER_MAP = {
  clear: "clear",
  rain: "rain",
  thunder: "thunder",
  thunderstorm: "thunder",
};

export const weatherCommand = {
  name: "weather",
  minRank: 3,
  usage: ":weather <clear|rain|thunder|thunderstorm>",
  description: "Sets the world weather state.",
  examples: [
    ":weather clear",
    ":weather rain",
    ":weather thunder",
    ":weather thunderstorm",
  ],

  execute({ player, args }) {
    const mode = String(args[0] ?? "").toLowerCase();
    const preset = WEATHER_MAP[mode];

    if (!preset) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    try {
      player.runCommand(`weather ${preset}`);
      player.sendMessage(`Set weather to ${preset}.`);
    } catch (error) {
      player.sendMessage(`Failed to set weather: ${error?.message ?? error}`);
    }
  },
};
