export const selectorsCommand = {
  name: "selectors",
  minRank: 0,
  usage: ":selectors",
  description: "Explains selector syntax and supported shortcuts.",
  examples: [":selectors"],

  execute({ player }) {
    const lines = [
      "Selector reference:",
      "me / @s - yourself",
      "all / @a - all players",
      "others - all players except you",
      "random or random:N - random player(s)",
      "name:\"Exact Name\" - exact player name or nameTag fallback",
      "tag:<tag> - players with a tag",
      "rank:<1-6|name> - players at a rank",
      "nonrank - players with rank 1",
      "near:<radius>[:<selector>] - players near you, optionally filtered",
      "gm:<mode> - players by gamemode",
      "hasprop:<key> - players with a dynamic property",
      "prop:<key>=<value> - players with a property value",
      "entity:<type[,type...]> - matching entities across loaded dimensions",
      "entity:all - every loaded entity across overworld, nether, and end",
      "Selectors can be combined with commas, and prefixed with ! for exclusion.",
      "Examples:",
      ":tp me 100 64 100",
      ":rank get rank:mod",
      ":whois near:20:tag:staff",
      ":kill entity:all",
    ];

    for (const line of lines) {
      player.sendMessage(line);
    }
  },
};
