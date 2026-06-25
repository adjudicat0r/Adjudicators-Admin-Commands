
export const clearlagCommand = {
  name: "clearlag",
  minRank: 3, 
  usage: ":clearlag",
  description: "Removes all dropped items and XP orbs.",
  examples: [":clearlag"],

  async execute({ player }) {
    let items = 0;
    let xp = 0;

    try {
      
      try {
        const res = await player.runCommand?.(`kill @e[type=item]`);
        if (res?.successCount != null) items += res.successCount;
      } catch {}

      
      try {
        const res = await player.runCommand?.(`kill @e[type=xp_orb]`);
        if (res?.successCount != null) xp += res.successCount;
      } catch {}
    } catch {}

    player.sendMessage(
      `Cleared lag: removed ${items} item(s) and ${xp} XP orb(s).`
    );
  },
};
