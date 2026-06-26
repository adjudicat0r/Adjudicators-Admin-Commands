import { makeNameCommand } from "./name.js";

export const unnameCommand = makeNameCommand({
  name: "unname",
  usage: ":unname <selector>",
  description: "Clears forced nameTags.",
  examples: [":unname me", ":unname others"],
  clearOnly: true,
});

export const nickCommand = makeNameCommand({
  name: "nick",
  usage: ':nick <selector> <name...>  (use "reset" to clear)',
  description: "Alias of :name.",
  examples: [
    ':nick me "§lAdmin"',
    ":nick greg Greg_917",
    ":nick others reset",
  ],
});

export const unnickCommand = makeNameCommand({
  name: "unnick",
  usage: ":unnick <selector>",
  description: "Alias of :unname.",
  examples: [":unnick me", ":unnick others"],
  clearOnly: true,
});
