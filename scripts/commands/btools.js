
import { ItemStack } from "@minecraft/server";
export const btoolsCommand = {
  name: "btools",
  minRank: 2, 
  usage: ":btools",
  description: "Gives the player builder tools.",
  examples: [":btools"],

  execute({ player }) {

    function giveItem(player, itemId, name, slot = null) {
      let newItem = new ItemStack(itemId, 1);
      newItem.nameTag = `§r${name}`;

      const playerContainer = player.getComponent('inventory')?.container;
      if (!playerContainer) return;

      if (slot !== null && slot >= 0 && slot < playerContainer.size) {
        playerContainer.setItem(slot, newItem);
      } else {
        playerContainer.addItem(newItem);
      }
    }

    giveItem(player, "minecraft:stick", "data tool");
    giveItem(player, "minecraft:stick", "build tool");
    giveItem(player, "minecraft:stick", "resize tool");
    giveItem(player, "minecraft:stick", "history tool");
    giveItem(player, "minecraft:stick", "clone tool");

    player.sendMessage("Builder tools given.");
  },
};
