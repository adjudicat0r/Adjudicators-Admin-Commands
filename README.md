# Adjudicators Admin Commands

Admin and utility command pack for Minecraft Bedrock Edition.

This behavior pack adds a large command system, building tools, player utilities, movement helpers, moderation tools, and automation systems for server management.

## Highlights

- Chat-based admin commands with rank gating
- Building tools for data editing, resizing, cloning, and pasting
- Player utilities like teleport, god, heal, blind, spectate, and trail effects
- Moderation helpers for punish, kick, notes, logs, and rank management
- Selector support for players, entities, properties, and proximity queries
- Pathfinding and movement helpers, including `:path`
- Optional combat utilities like `:killaura` and `:crystalaura`
- Persistent world-backed storage for logs, permissions, notes, and more

## Requirements

- Minecraft Bedrock Edition with Script API support
- Manifest target: `@minecraft/server` `2.9.0-beta`
- Manifest target: `@minecraft/server-ui` `2.0.0`

## Install

1. Put the pack in your Bedrock development behavior packs folder.
2. Enable the behavior pack in your world.
3. Make sure Script API experiments are available for your version.
4. Open the world and use `:help` in chat to browse commands.

## Configuration

The main editable owner setting lives in [`scripts/system/config.js`](scripts/system/config.js).

```js
export const owner = {
  nametag: "YourNameHere",
};
```

That nametag is automatically treated as owner rank `6`.

## Selectors

Selectors are how commands decide who or what to target.

### Player selectors

- `me` or `@s` - yourself
- `all` or `@a` - all players
- `others` - all players except you
- `random` or `@r` - one random player
- `random:N` - `N` random players
- `name:"Exact Name"` - exact player name, with nameTag fallback
- `tag:<tag>` - players with a tag
- `rank:<1-6|name>` - players by rank
- `nonrank` - rank 1 players
- `near:<radius>` - players near you
- `near:<radius>:<selector>` - players near you, filtered by another selector
- `gm:<mode>` - players by gamemode
- `hasprop:<key>` - players with a dynamic property
- `prop:<key>=<value>` - players with a matching dynamic property value
- Comma-separated selectors combine results, and `!` in a combined selector excludes matches

### Entity selectors

- `entity:<type>` - entities matching a type name
- `entity:<type1,type2>` - entities matching any of the listed types
- `entity:all` - every loaded entity across overworld, nether, and end
- `entity:others` - every loaded entity except you
- `entity:random` - one random loaded entity
- `entity:random:N` - `N` random loaded entities

### Examples

```text
:tp me 100 64 100
:rank get rank:mod
:whois near:20:tag:staff
:kill entity:all
:kill entity:others
:kill entity:random
:note add steve suspected xray near spawn
```

You can also use the `:selectors` command in game to see this reference.

## Command Reference

### Core Admin

- `:help` - Opens the command browser or shows details for one command.
- `:log` - Shows recent admin command history.
- `:rank` - Gets or sets player ranks.
- `:permission` - Views or changes per-command rank overrides.
- `:note` - Adds, lists, or deletes admin notes on players.
- `:filter` - Manages blocked chat words and phrases with `block`, `scramble`, and `redact` modes, without affecting command usage.
- `:selectors` - Shows selector syntax and usage examples.
- `:script` - Runs an arbitrary command as a delayed script action for owner-level control.
- `:sudo` - Runs a command as selected players.
- `:spawnrate` - Adjusts the server-side spawn multiplier for selected entities.
- `:stresstest` - Sends visual or particle-style stress test output.

### Player Utilities

- `:heal` - Restores health and clears fire if applicable.
- `:god` - Enables godmode for selected players.
- `:ungod` - Disables godmode.
- `:blind` - Applies the blind/fade effect.
- `:unblind` - Clears the blind/fade effect.
- `:trip` - Wacky visuals for selected players.
- `:untrip` - Stops the wacky visuals.
- `:fire` - Sets selected players on fire.
- `:unfire` - Extinguishes selected players.
- `:effect` - Applies a potion effect.
- `:uneffect` - Removes a potion effect.
- `:trail` - Enables a particle trail on selected players.
- `:untrail` - Disables the particle trail.
- `:name` - Forces a custom nameTag on selected players.
- `:unname` - Clears forced nameTags.
- `:nick` - Alias of `:name`.
- `:unnick` - Alias of `:unname`.
- `:whois` - Shows player information, status, and best-effort metadata.
- `:message` - Sends a private message or reply-style conversation.
- `:cmdbar` - Opens a command bar UI for quick command entry.
- `:announce` - Shows a popup announcement to everyone.
- `:kit` - Saves and loads inventory kits.
- `:invsee` - Opens another player's inventory for viewing and editing.

### Movement and Positioning

- `:tp` - Teleports selected players.
- `:goto` - Saves or uses named destinations.
- `:bring` - Brings selected players to you.
- `:pos` - Shows coordinates for selected players.
- `:top` - Moves selected players to the top of their position.
- `:fling` - Applies random directional knockback.
- `:spectate` - Starts spectating a target.
- `:unspectate` - Stops spectating.
- `:path` - Streams a smarter knockback-based path toward coordinates.
- `:lock` - Locks selected players in place.
- `:unlock` - Releases locked players.
- `:jail` - Teleports players into a timed mini jail and restores the replaced blocks after release.

### Combat and World Control

- `:smite` - Strikes selected players with lightning.
- `:kill` - Kills selected players.
- `:time` - Sets the world time to `day`, `night`, `sunrise`, or `sunset`.
- `:weather` - Sets the world weather to `clear`, `rain`, or `thunder`/`thunderstorm`.
- `:bomb` - Creates a destructive blast at selected targets.
- `:boom` - Creates a non-griefing explosion.
- `:explode` - Creates an explosion with optional damage and fire behavior.
- `:clear` - Clears inventories of selected players.
- `:clearlag` - Removes dropped items and experience orbs.
- `:killaura` - Enables nearby entity damage around selected players.
- `:unkillaura` - Disables killaura.
- `:kaura` - Alias of `:killaura`.
- `:unkaura` - Alias of `:unkillaura`.
- `:crystalaura` - Automatically attacks nearby end crystals around selected players.
- `:uncrystalaura` - Disables crystalaura.

### Building and Editing

- `:btools` - Toggles the building tool system.
- `:props` - Opens a dynamic property browser for the world or players.
- `:repair` - Repairs items or all inventory items.
- `:dupe` - Duplicates the held item.
- `:gear` - Gives items to selected players.
- `:enchant` - Applies enchantments to held items or target inventories.
- `:warp` - Teleports to, lists, or uses stored warps.
- `:setwarp` - Creates or updates a warp.
- `:delwarp` - Deletes a warp.
- `:xray` - Highlights or searches for block targets.

### Social and Utility Extras

- `:loop` - Repeats a command on an interval.
- `:cmdqueue` - Queues a command to run later, and supports `list` and `cancel`.
- `:macro` - Saves, lists, runs, edits, and destroys multi-command sequences stored in world data.
- `:autobroadcast` - Configures rotating timed announcements stored in world data.
- `:motd` - Sets or clears the message of the day shown whenever a player spawns.
- `:script` - Owner-level command execution helper.
- `:stresstest` - Diagnostic and testing utilities.

## Building Tools

The pack also includes stick-based building tools:

- Data tool for block and entity editing
- Resize tool for changing selection dimensions
- Clone tool for copying and pasting block regions
- Build tool for shape generation and structure placement
- History tool for undo-style tracking

## Systems

The background systems in `scripts/system/` handle:

- Chat formatting and command dispatch
- Player state loops for blind, god, punish, lock, spectate, and trail behavior
- Spawn-rate adjustments
- Global configuration and owner promotion

## Notes

- Use `:help` for the full live command list.
- Some commands are rank-restricted and may be hidden or locked depending on permissions.
- World data is stored through dynamic properties, so logs, notes, and permission overrides persist with the world.

## Project Structure

- [`scripts/main.js`](scripts/main.js) - bootstrap and event wiring
- [`scripts/commands/`](scripts/commands) - chat commands and the command manager
- [`scripts/buildingtools/`](scripts/buildingtools) - block editing and structure tools
- [`scripts/system/`](scripts/system) - loops, chat formatting, config, and automation
- [`scripts/storage/db.js`](scripts/storage/db.js) - world-backed persistence helpers
- [`scripts/lib/selectors.js`](scripts/lib/selectors.js) - selector parsing and player lookup

