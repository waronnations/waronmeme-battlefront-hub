import { defineMcp } from "@lovable.dev/mcp-js";
import battlefield from "./tools/get-battlefield-state";
import dominance from "./tools/get-sector-dominance";
import vault from "./tools/get-vault-status";
import apocalypse from "./tools/get-apocalypse-timer";

export default defineMcp({
  name: "remix-of-waronmeme",
  title: "Remix of Waronmeme",
  version: "0.1.0",
  instructions:
    "Read-only War On Memes battlefield intel. Use get_sector_dominance for faction volume, get_battlefield_state for radiation and combat, get_apocalypse_timer for the Doomsday clock and survivors, get_vault_status for prize pools. No player data is exposed.",
  tools: [battlefield, dominance, vault, apocalypse],
});
