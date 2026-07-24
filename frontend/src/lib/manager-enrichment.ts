/**
 * Stable master-data enrichment captured from idle-miners.com/api/sm-data.
 *
 * The verified catalog remains the source of identity and release metadata.
 * This file fills presentation fields when an APK catalog export omits
 * sprites/descriptions/passive values. Refresh it when the upstream game data
 * changes and review the resulting catalog package before publishing.
 */
export interface ManagerEnrichment {
  gameId: number;
  name: string;
  sprite: string;
  activeL1?: number;
  activeL100?: number;
  cooldown?: number;
  duration?: number;
  descriptionLong?: string;
  elements: Array<{ element: string; effectiveness: string; rankReq: number }>;
  passives: Array<{ type: string; value?: number | null; promoReq: number }>;
}

export const MANAGER_ENRICHMENT: ManagerEnrichment[] = [
  {
    "gameId": 10061,
    "name": "Asterion",
    "sprite": "Asterion",
    "activeL1": 15,
    "activeL100": 60,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Worker capacity and mining speed are increased to match the deepest mineshaft's base income, then multiplied by {0}",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSB",
        "value": 6.08,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10086,
    "name": "Belle Snowdrop",
    "sprite": "BelleSnowdrop",
    "activeL1": 0.25,
    "activeL100": 0.5,
    "cooldown": 300,
    "duration": 60,
    "descriptionLong": "Belle freezes the resources in the Elevator building and gains {0} of the total frozen amount every {1} seconds without deducting it from the Elevator building.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10109,
    "name": "Cervina",
    "sprite": "Cervina",
    "activeL1": 5,
    "activeL100": 7,
    "cooldown": 600,
    "duration": 90,
    "descriptionLong": "A Reindeer takes {0} resources brought by the workers & sends them to the Warehouse. Every Mineshaft they pass increases the delivery by {1} (max {2} at 500 Mineshafts).",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "WMSB",
        "value": 3.952,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10113,
    "name": "Chance Goldshell",
    "sprite": "ChanceGoldshell",
    "activeL1": 6.61,
    "activeL100": 18,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Multiplies & stores resources in an Easter Egg. Multiplier starts at {0} and increases by {1} every time resources are stored, up to a maximum of {2}. Stored resources become Instant Cash when the effect ends.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 3.269333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 5.26,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10082,
    "name": "Count Lucius",
    "sprite": "CountLucius",
    "activeL1": 13.5,
    "activeL100": 70,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Bats help transmit {0} of Mineshaft production directly to the Warehouse",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10108,
    "name": "Drethos",
    "sprite": "Drethos",
    "activeL1": 0.22,
    "activeL100": 0.3,
    "cooldown": 600,
    "duration": 30,
    "descriptionLong": "Copies & stores {0} of the Elevator resources every {2} seconds. Once the effect ends, the stored amount is multiplied by {1} & unloaded as Instant Cash.",
    "elements": [
      {
        "element": "chaos",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10091,
    "name": "Eivor",
    "sprite": "Eivor",
    "activeL1": 12.5,
    "activeL100": 27,
    "cooldown": 60,
    "duration": 30,
    "descriptionLong": "Eivor extracts resources and sends them to the Elevator Building, with an initial multiplier of {0}. Each activation applies a separate multiplier: {1} first, {2} second, {3} third. At the end of the effect, the crate's resources are multiplied by {0} and sent to Elevator Building.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10055,
    "name": "Ember",
    "sprite": "Ember",
    "activeL1": 12,
    "activeL100": 20,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "{0} Mining Speed and Worker Capacity in the assigned Mineshaft, and {1} in 2 Mineshafts above and 2 below.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": 1.45,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10069,
    "name": "Eternity",
    "sprite": "Eternity",
    "activeL1": 7,
    "activeL100": 7.5,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "An orb flies up the Mine, emptying every crate and taking {0} the resources (except Mineshaft 1). It will then drop the resources in the first Mineshaft.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": 1.59,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10114,
    "name": "Harumi",
    "sprite": "Harumi",
    "activeL1": 10,
    "activeL100": 20,
    "cooldown": 900,
    "duration": 65,
    "descriptionLong": "Removes the workers & stores all Instant Cash produced by other Super Managers in a Cherry Blossom Tree. Unloads {0} Instant Cash at the end of the effect.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10084,
    "name": "King Orekk",
    "sprite": "KingOrekk",
    "activeL1": 6.5,
    "activeL100": 30.2,
    "cooldown": 900,
    "duration": 90,
    "descriptionLong": "Spawns {3} dwarfs with {0} Mining Speed Boost & Infinite Worker Capacity. The number of dwarfs increases by {1} for each additional Light Super Manager assigned in the mine (max {2} total).",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10088,
    "name": "Lei Na",
    "sprite": "LeiNa",
    "activeL1": 0.19,
    "activeL100": 0.72,
    "cooldown": 900,
    "duration": 150,
    "descriptionLong": "A snake spawns at the bottom and ascends to collect {0} more resources from the Elevator. These are then multiplied by {1} and sent to the Warehouse.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 3.269333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 5.26,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10051,
    "name": "Lord Beiroth",
    "sprite": "LordBeiroth",
    "activeL1": 17,
    "activeL100": 25,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "{0} of your mined resources fly to the Elevator building on top of regular production.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSB",
        "value": 5.04,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 36.1,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10100,
    "name": "Lorelei",
    "sprite": "Lorelei",
    "activeL1": 6.1,
    "activeL100": 12.9,
    "cooldown": 1200,
    "duration": 150,
    "descriptionLong": "Increases Elevator Movement and Loading speed by {1}. Increases Elevator load by {2}, then beams {0} of the collected resources to the Warehouse.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MLSB",
        "value": 3.269333333333328,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10015,
    "name": "Luna and Stella",
    "sprite": "LunaandStella",
    "activeL1": 3.4,
    "activeL100": 5.1,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Collect {0} mined resources with an additional elevator then beam these to the Warehouse",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 1.3,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 66.5,
        "promoReq": 3
      },
      {
        "type": "EBEAM",
        "value": 0.27,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10077,
    "name": "Om'nix",
    "sprite": "Omnix",
    "activeL1": 1.2,
    "activeL100": 1.42,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Increase the mining speed of all mineshaft workers in the mine by {0}",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 36.1,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10074,
    "name": "Poseidon",
    "sprite": "Poseidon",
    "activeL1": 12.1,
    "activeL100": 15.2,
    "cooldown": 1200,
    "duration": 90,
    "descriptionLong": "Warehouse workers deliver {0} resources to the Warehouse. The amount increases by {1} for each additional Water Super Manager assigned in the mine, up to {2} max total.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10017,
    "name": "Professor Impossible",
    "sprite": "ProfessorImpossible",
    "activeL1": 5.95,
    "activeL100": 7.65,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Conveyor speeds {0} resources to the warehouse",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": 1.3,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 66.5,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10111,
    "name": "Remedy Rose",
    "sprite": "RemedyRose",
    "activeL1": 0.35,
    "activeL100": 0.41,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Gives {1} Movement Speed to workers, multiplies the resources they drop by {2}, and applies a one-time {0} reduction to the cooldown of the inactive Super Manager in the deepest Mineshaft, Elevator, and Warehouse (max {3}).",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10038,
    "name": "Samantha Reiss",
    "sprite": "SamanthaReiss",
    "activeL1": 3,
    "activeL100": 4,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Elevator, Warehouse, and assigned Mineshaft are boosted by {0}.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10105,
    "name": "Selena Amanita",
    "sprite": "SelenaAmanita",
    "activeL1": 37,
    "activeL100": 79,
    "cooldown": 1200,
    "duration": 120,
    "descriptionLong": "{0} Worker Capacity, Mining & Walking Speed. Activating Mineshaft Super Manager: {1} Instant Cash generated every {2}s based on activated Mineshaft Total Production. Activating Elevator Super Manager: {1} Instant Cash generated every {2}s based on activated Elevator Transportation. Activating Warehouse Super Manager: {1} Instant Cash generated every {2}s based on Warehouse Total Transportation.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10106,
    "name": "Sir Axiom",
    "sprite": "SirAxiom",
    "activeL1": 4,
    "activeL100": 8,
    "cooldown": 600,
    "duration": 180,
    "descriptionLong": "When the Elevator unloads, gain {0} of that value and transform it into Instant Cash. Instant Cash from Super Managers in the mine is boosted by {1}.",
    "elements": [
      {
        "element": "order",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 3.269333333333328,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": 5.26,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.22,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10013,
    "name": "Sir Lorenzo",
    "sprite": "SirLorenzo",
    "activeL1": 10.2,
    "activeL100": 17,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Transmit {0} of Mineshaft production directly to the Warehouse",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSB",
        "value": 5.04,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10060,
    "name": "Urca",
    "sprite": "Urca",
    "activeL1": 2.7,
    "activeL100": 4.4,
    "cooldown": 1200,
    "duration": 120,
    "descriptionLong": "Gives the Elevator, Warehouse and the deepest Mineshaft a {0} Walking, Loading, Movement and Mining Speed Boost.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 66.5,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 5.26,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10042,
    "name": "Ut'ux",
    "sprite": "Utux",
    "activeL1": 20,
    "activeL100": 30,
    "cooldown": 1800,
    "duration": 90,
    "descriptionLong": "Store mined resources in the Hive. Unload {0} split between the Warehouse and the Crate at the end of the Effect.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSB",
        "value": 5.54,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10095,
    "name": "Vulcan",
    "sprite": "Vulcan",
    "activeL1": 7.5,
    "activeL100": 15,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Multiplies the resources brought or beamed to the Warehouse by {0}.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": 3.269333333333328,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10102,
    "name": "Yasuke",
    "sprite": "Yasuke",
    "activeL1": 5.1,
    "activeL100": 8.6,
    "cooldown": 1800,
    "duration": 45,
    "descriptionLong": "Transported resources from the infinite boulders are multiplied by {0}. Every {1} sec, smashed rocks increase the multiplier by {2} (max {3} hits).",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "WWLSB",
        "value": 3.269333333333328,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10098,
    "name": "Zenthor",
    "sprite": "Zenthor",
    "activeL1": 41,
    "activeL100": 95,
    "cooldown": 900,
    "duration": 120,
    "descriptionLong": "Constantly extracts resources by multiplying them by {0} and sending them directly to the Warehouse. At the end of the effect, makes a copy of the resources from his and neighboring crates, and sends them to the Warehouse.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 52.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.6,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10078,
    "name": "Abeo Meremikwu",
    "sprite": "AbeoMeremikwu",
    "activeL1": 8.5,
    "activeL100": 45,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Multiplies resources dropped into the crate by {0}. The multiplier increases up to max {1} as the plants grow.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 23,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 22,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10107,
    "name": "Adamantus",
    "sprite": "Adamantus",
    "activeL1": 3,
    "activeL100": 8,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Multiplies unloaded Elevator resources by {0} & again by {1}. The {1} depends on the number of unlocked Mineshafts (max {4}). Increases Elevator Capacity & Loading Speed by {2}. If Drethos is active at the same time, Adamantus gains {2} Movement Speed & his Elevator Capacity, Movement & Loading Speed are further boosted by {3}.",
    "elements": [
      {
        "element": "order",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "EMSB",
        "value": 6.672,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10053,
    "name": "Afi",
    "sprite": "Afi",
    "activeL1": 4.1,
    "activeL100": 8.8,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Afi begins to dance and one of three Mineshafts with the highest production is selected, giving the Miners a {0} Mining & Walking Speed Boost. The selected Mineshaft changes every {1} seconds.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10065,
    "name": "Amora",
    "sprite": "Amora",
    "activeL1": 6,
    "activeL100": 12.5,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Loading & Movement Speed Boost. Increases the effect duration of all other active Super Managers in the Mine by {1} seconds. While she is in cooldown but still boosting other Super Managers, switching mines makes the extra boost disappear.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 43.7,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10103,
    "name": "Archibald",
    "sprite": "Archibald",
    "activeL1": 5.4,
    "activeL100": 26.8,
    "cooldown": 900,
    "duration": 70,
    "descriptionLong": "{0} Mining Speed Boost & Infinite Worker Capacity",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "BUCR",
        "value": 31.46666666666672,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 1.98,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10099,
    "name": "Aric Swiftstrike",
    "sprite": "AricSwiftstrike",
    "activeL1": 3.3,
    "activeL100": 8.7,
    "cooldown": 1200,
    "duration": 30,
    "descriptionLong": "Shoots up to 3 arrows every {1} seconds, one for his and each neighboring Mineshaft. Each arrow that hits gives {0} of that Mineshaft's production as Instant Cash.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "WMSB",
        "value": 3.269333333333328,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10093,
    "name": "Astra and Curt",
    "sprite": "AstraAndCurt",
    "activeL1": 24,
    "activeL100": 29,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Every {1} seconds, Astra's crate gains an extra {0} total Mineshaft extraction from its own and neighboring Mineshafts.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": 3.269333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 1.98,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10081,
    "name": "Bam Bam",
    "sprite": "BamBam",
    "activeL1": 1.4,
    "activeL100": 4.55,
    "cooldown": 1800,
    "duration": 600,
    "descriptionLong": "Gain {0} your Elevator Transportation every {1} seconds as Instant Cash. The amount increases by {2} for every Mineshaft (max {3}). Bamboo spawns according to the number of mineshafts unlocked.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10040,
    "name": "Beiro",
    "sprite": "Beiro",
    "activeL1": 12,
    "activeL100": 18,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "{0} of your mined resources fly to the Elevator building on top of regular production.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 22,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10110,
    "name": "Chef Bearnard",
    "sprite": "ChefBearnard",
    "activeL1": 21,
    "activeL100": 30,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Resources brought by the workers are multiplied by {0}, then half are sent to the Elevator & half to the Warehouse.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSUCR",
        "value": 11.9,
        "promoReq": 1
      },
      {
        "type": "WMSB",
        "value": 3.269333333333328,
        "promoReq": 3
      },
      {
        "type": "BUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10056,
    "name": "Cliff Walker",
    "sprite": "CliffWalker",
    "activeL1": 13,
    "activeL100": 20,
    "cooldown": 900,
    "duration": 30,
    "descriptionLong": "Stores all mined resources from current Mineshaft and {1} of the Mineshafts directly above and below in a Backpack. Unloads {0} Instant Cash at the end of the effect.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10076,
    "name": "Dave Riptide",
    "sprite": "DaveRiptide",
    "activeL1": 10.5,
    "activeL100": 22.75,
    "cooldown": 600,
    "duration": 150,
    "descriptionLong": "The crab dives to the deepest Mineshaft. Loads {0} the total mine extraction to the Elevator building.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 43.7,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10008,
    "name": "Dr. Lilly",
    "sprite": "DrLilly",
    "activeL1": 2.55,
    "activeL100": 4.25,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Beam {0} of collected resources to the Warehouse",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "EBEAM",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10032,
    "name": "Dr. Nova",
    "sprite": "DrNova",
    "activeL1": 3.4,
    "activeL100": 5.1,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Warehouse Transportation. Gets higher based on the total active Boost (up to max. {1}).",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10003,
    "name": "Dr. Steiner",
    "sprite": "DrSteiner",
    "activeL1": 2.55,
    "activeL100": 4.25,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Beam {0} of your mined resources to the Warehouse",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "MSBEAM",
        "value": 0.18,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10058,
    "name": "Erica Quill",
    "sprite": "EricaQuill",
    "activeL1": 6.5,
    "activeL100": 13,
    "cooldown": 1200,
    "duration": 60,
    "descriptionLong": "Gain {0} Instant Cash every {1} seconds. Each additional active Super Manager in the assigned mine increases the Cash gained by {2}, up to {3} max. in total.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 1
      },
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10097,
    "name": "Everett Bloomfield",
    "sprite": "EverettBloomfield",
    "activeL1": 1.5,
    "activeL100": 5,
    "cooldown": 1200,
    "duration": 120,
    "descriptionLong": "Multiplies all resources coming to the Elevator by {0}, plus an extra {1} for each unlocked continent.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "BUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10019,
    "name": "Ezio Auditore",
    "sprite": "EzioAuditore",
    "activeL1": 8.5,
    "activeL100": 12.75,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Leap to deepest Mineshaft to gain {0} total Mine extraction in the form of Instant Cash",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10037,
    "name": "Floating Agatha",
    "sprite": "FloatingAgatha",
    "activeL1": 24,
    "activeL100": 48,
    "cooldown": 1800,
    "duration": 30,
    "descriptionLong": "Ghost cats mine and store resources on top of regular production. Unload {0} at the end of the effect in the form of Instant Cash",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10075,
    "name": "Freesia",
    "sprite": "Freesia",
    "activeL1": 12,
    "activeL100": 25,
    "cooldown": 900,
    "duration": 120,
    "descriptionLong": "An extra worker mines {1} faster and multiplies {0} resources, instantly beaming resources to the Elevator building.",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSUCR",
        "value": 8.9,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10046,
    "name": "Glimmer",
    "sprite": "Glimmer",
    "activeL1": 10,
    "activeL100": 17,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "{0} Mining Speed and Worker Capacity in the assigned Mineshaft, and {1} in the Mineshafts directly above and below.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10034,
    "name": "Green Idler",
    "sprite": "GreenIdler",
    "activeL1": 8.5,
    "activeL100": 12.75,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Gain {0} of Mineshaft production as Instant Cash on top of regular production.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10089,
    "name": "H4V0C",
    "sprite": "H4V0C",
    "activeL1": 30,
    "activeL100": 75,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Every {1} times a worker deposits resources in the crate, those resources are multiplied by {0} and beamed to the Warehouse.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSUCR",
        "value": 14.4,
        "promoReq": 1
      },
      {
        "type": "MSB",
        "value": 6.672,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10083,
    "name": "Hatori",
    "sprite": "Hatori",
    "activeL1": 7.59,
    "activeL100": 13.25,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "{0} Warehouse Load per Transporter & Loading Speed. Additional active Super Managers in the assigned mine increase the multiplier by {1} (up to {2} max total).",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10085,
    "name": "Iggy Ignite",
    "sprite": "IggyIgnite",
    "activeL1": 1.3,
    "activeL100": 2.5,
    "cooldown": 210,
    "duration": 40,
    "descriptionLong": "A firecracker is dropped every time the Elevator stops at the top (up to {1} times). Once it falls, gain {0} your maximum Elevator load as Instant Cash",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10057,
    "name": "Jackal",
    "sprite": "Jackal",
    "activeL1": 6,
    "activeL100": 8.5,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "An extra worker mines {0} faster and multiplies {0} resources, instantly flinging resources back to the crate.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10030,
    "name": "Jade Kim",
    "sprite": "JadeKim",
    "activeL1": 2.55,
    "activeL100": 4.25,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Instantly beam {0} of lifted resources to the Warehouse",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10063,
    "name": "Krampus",
    "sprite": "Krampus",
    "activeL1": 3.8,
    "activeL100": 6.1,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Elevator transforms {0} of Mineshaft's resources into yule logs",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 43.7,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10096,
    "name": "Lauany",
    "sprite": "Lauany",
    "activeL1": 6.5,
    "activeL100": 11.2,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Gain {0} resources from Warehouse workers. Walking Speed gradually increases from {1} at the start to {2} at the end of the effect.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "WWLSB",
        "value": 2.949333333333328,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10067,
    "name": "Lavender Wick",
    "sprite": "LavenderWick",
    "activeL1": 12.4,
    "activeL100": 15,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Speed up workers by {1}. Beam {0} of mined resources to the Elevator building.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "IC",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 26.4,
        "promoReq": 3
      },
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10094,
    "name": "Lavernia Pascal",
    "sprite": "LaverniaPascal",
    "activeL1": 3.8,
    "activeL100": 5.5,
    "cooldown": 600,
    "duration": 300,
    "descriptionLong": "During her activation time, she boosts: the current Mineshaft (Walking Speed by {1}, Worker Capacity and Mining Speed by {0}) as well as the Elevator (Movement Speed by {1}, the Loading Capacity and Loading Speed by {0}).",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 31.46666666666672,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10087,
    "name": "Lila Starborne",
    "sprite": "LilaStarborne",
    "activeL1": 1.95,
    "activeL100": 2.8,
    "cooldown": 1200,
    "duration": 74,
    "descriptionLong": "Lila starts an Elevator concert and transports {0} the musical notes from the speakers with infinite resources.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 1.98,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10039,
    "name": "Luxario",
    "sprite": "Luxario",
    "activeL1": 15,
    "activeL100": 25,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Gain {0} resources from Warehouse workers.",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10059,
    "name": "Mad Eye Drake",
    "sprite": "MadEyeDrake",
    "activeL1": 8,
    "activeL100": 15,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Every {1} times a worker deposits resources at the Warehouse, gain {0} the deposited Cash.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10043,
    "name": "Marrena",
    "sprite": "Marrena",
    "activeL1": 9,
    "activeL100": 13,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Gain {0} Instant Cash every {1} seconds. Each additional Super Manager in the assigned mine increases the Cash gained by {2}, up to {3} max. in total.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10072,
    "name": "Maya Gelata",
    "sprite": "MayaGelata",
    "activeL1": 1.2,
    "activeL100": 2.2,
    "cooldown": 240,
    "duration": 40,
    "descriptionLong": "Warehouse workers transport {0} the ice cream from the underground storage with infinite resources.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 26.4,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10044,
    "name": "Melody Rivers",
    "sprite": "MelodyRivers",
    "activeL1": 11,
    "activeL100": 13,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "{0} of Elevator Transportation gets sent from the fullest crate to the Elevator Building every second.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10090,
    "name": "Mr. Edmund",
    "sprite": "MrEdmund",
    "activeL1": 3.3,
    "activeL100": 4.5,
    "cooldown": 900,
    "duration": 120,
    "descriptionLong": "Mr. Edmund digs into the ground all the way to the deepest corridor and brings {0} the total Mineshaft extraction in cash.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10101,
    "name": "Naoe",
    "sprite": "Naoe",
    "activeL1": 8,
    "activeL100": 20,
    "cooldown": 900,
    "duration": 180,
    "descriptionLong": "Selects 1 of {3} top-producing Mineshafts & gives it {1} Walking Speed & Loading Capacity. Collects {0} its production as Instant Cash. Switches Mineshaft every {2} seconds. Like in the Mineshaft, Naoe boosts the Warehouse if Yasuke is active & also gives {1} Loading Speed for his duration.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 1.98,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10036,
    "name": "Octavia De Vere",
    "sprite": "OctaviaDeVere",
    "activeL1": 10,
    "activeL100": 14.25,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Gain {0} Instant Cash every {1} seconds",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10071,
    "name": "Ore-sama Daichi",
    "sprite": "OresamaDaichi",
    "activeL1": 1.05,
    "activeL100": 1.2,
    "cooldown": 900,
    "duration": 45,
    "descriptionLong": "{0} the resources collected from their Mineshaft plus 1 above and below are stored during the effect, then deposited in the crate at the end of the effect.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10047,
    "name": "Pebble",
    "sprite": "Pebble",
    "activeL1": 3.2,
    "activeL100": 8,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Miners mine {0} faster, instantly flinging and storing resources back at Pebble. Unload {1} in the crate at the end of the Effect.",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10079,
    "name": "Phineas Cogsmith",
    "sprite": "PhineasCogsmith",
    "activeL1": 2.5,
    "activeL100": 4,
    "cooldown": 1500,
    "duration": 60,
    "descriptionLong": "When the Elevator takes resources from the mineshaft, the crate is refilled by {0} of what the Elevator took from it.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSUCR",
        "value": 19,
        "promoReq": 1
      },
      {
        "type": "MSB",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10033,
    "name": "Professor Maple",
    "sprite": "ProfessorMaple",
    "activeL1": 2.04,
    "activeL100": 3.06,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Warehouse workers transport {0} leaves from the Money tree with infinite resources.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10026,
    "name": "Queen Aurora",
    "sprite": "QueenAurora",
    "activeL1": 5.95,
    "activeL100": 10.2,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Fling {0} of collected resources to the Warehouse",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10068,
    "name": "R.bit",
    "sprite": "RBit",
    "activeL1": 2,
    "activeL100": 4.6,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Multiplies resources. Starting from {1} and gradually increasing to {2} at the end of the effect.",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 43.7,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10025,
    "name": "Rabbid Blingsley",
    "sprite": "RabbitBlingsley",
    "activeL1": 2.55,
    "activeL100": 4.25,
    "cooldown": 900,
    "duration": 150,
    "descriptionLong": "Gain {0} of current Mine production every second in the form of Instant Cash",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10073,
    "name": "Ray Rift",
    "sprite": "RayRift",
    "activeL1": 2.2,
    "activeL100": 3.5,
    "cooldown": 300,
    "duration": 105,
    "descriptionLong": "Increases Elevator load by 5x. Multiplies collected resources from the crates by {0} and sends half of them to the Warehouse",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10049,
    "name": "Rayman",
    "sprite": "Rayman",
    "activeL1": 12,
    "activeL100": 15,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Collects and multiplies resources by {0} with every punch. Charging and punching gets {2} faster with each additional Super Manager active at the same time, up to {1} max in total.",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10041,
    "name": "Sam Fisher",
    "sprite": "SamFisher",
    "activeL1": 12,
    "activeL100": 18,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Extract additional {0} of mined resources from each Mineshaft.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10018,
    "name": "Santa 2020",
    "sprite": "Santa2020",
    "activeL1": 3.4,
    "activeL100": 5.1,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Warehouse workers transform {0} of elevator resources into presents",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10016,
    "name": "Santa Claus",
    "sprite": "SantaClaus",
    "activeL1": 3.4,
    "activeL100": 5.1,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Warehouse workers transform {0} of elevator resources into presents",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CIF",
        "value": 1.44,
        "promoReq": 3
      },
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10112,
    "name": "Sporewick",
    "sprite": "Sporewick",
    "activeL1": 2.6,
    "activeL100": 9.42,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Increases Warehouse Load per Transporter & Loading Speed by {0}. Gain an extra bonus for each unlocked barrier, scaled by {1} up to {2}, with smaller increases the more barriers are unlocked. Adds {3} Walking & Mining Speed to Mineshaft workers.",
    "elements": [
      {
        "element": "chaos",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 31.46666666666672,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10062,
    "name": "Thalia",
    "sprite": "Thalia",
    "activeL1": 7.5,
    "activeL100": 12,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} of your mined resources fly to the Elevator building on top of regular production.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 26.4,
        "promoReq": 3
      },
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10050,
    "name": "Ula Galvani",
    "sprite": "UlaGalvani",
    "activeL1": 7,
    "activeL100": 17,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Multiplies resources dropped into the crate by {0}. Walking & Mining Speed gradually increases from {1} at the start to {2} at the end of the effect.",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "MSUCR",
        "value": 31.4,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10031,
    "name": "Violet Evergreen",
    "sprite": "VioletEvergreen",
    "activeL1": 8.5,
    "activeL100": 12.75,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Gain {0} of your Elevator Transportation as Instant Cash every {1} seconds",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10080,
    "name": "Whisker Twirl",
    "sprite": "WhiskerTwirl",
    "activeL1": 20,
    "activeL100": 35,
    "cooldown": 900,
    "duration": 90,
    "descriptionLong": "Resources collected from transporters have a {1} probability of being multiplied by {0}.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": 3.67,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10024,
    "name": "Wolfgang Clawson",
    "sprite": "WolfgangClawson",
    "activeL1": 5.95,
    "activeL100": 10.2,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Werewolf miners mine {0} faster, instantly flinging resources back to the crate.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.5,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10104,
    "name": "Wyatt Earn",
    "sprite": "WyattEarn",
    "activeL1": 14,
    "activeL100": 29.7,
    "cooldown": 900,
    "duration": 300,
    "descriptionLong": "Pulls a cash bag from deep within the mine to the Elevator building, worth {0} the best mineshaft's production. A warehouse worker must then transport it.",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": 2.949333333333328,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "EBEAM",
        "value": 0.18,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10052,
    "name": "Zephyria",
    "sprite": "Zephyria",
    "activeL1": 3.5,
    "activeL100": 6.5,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Increases Elevator Movement and Loading speed by {1}, then beams {0} of the collected resources to the Warehouse",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 52.6,
        "promoReq": 3
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10064,
    "name": "Zoe_365",
    "sprite": "Zoe365",
    "activeL1": 2,
    "activeL100": 4,
    "cooldown": 1800,
    "duration": 180,
    "descriptionLong": "Beam {0} of your mined resources to the Warehouse, plus +12% for each unlocked Mineshaft in her assigned Mine.",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 1.98,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10054,
    "name": "1DL3",
    "sprite": "1DL3",
    "activeL1": 3.5,
    "activeL100": 7,
    "cooldown": 900,
    "duration": 90,
    "descriptionLong": "Mines the resources and multiplies them by {0} converting them into Instant Cash",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MIF",
        "value": 1.44,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10066,
    "name": "Al Titude",
    "sprite": "AlTitude",
    "activeL1": 4.5,
    "activeL100": 13,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "Gain {0} resources from Warehouse workers.",
    "elements": [
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 29.7,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10005,
    "name": "Blingsley",
    "sprite": "Blingsley",
    "activeL1": 8.5,
    "activeL100": 12.75,
    "cooldown": 1800,
    "duration": 60,
    "descriptionLong": "Gain {0} Instant Cash every {1} seconds",
    "elements": [
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 35.7,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10045,
    "name": "Chris Capella",
    "sprite": "ChrisCapella",
    "activeL1": 5.95,
    "activeL100": 10.2,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Loading & Walking Speed Boost",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WWLSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": null,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10029,
    "name": "Damian Jones",
    "sprite": "DamianJones",
    "activeL1": 5.95,
    "activeL100": 10.2,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Loading & Movement Speed Boost",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 35.7,
        "promoReq": 1
      },
      {
        "type": "MIF",
        "value": 1.44,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10070,
    "name": "Jeff",
    "sprite": "Jeff",
    "activeL1": 1.5,
    "activeL100": 3,
    "cooldown": 1800,
    "duration": 150,
    "descriptionLong": "Resources collected in the Elevator are multiplied by {0}. Gain a +10% bonus for each Super Manager currently in the Mine (max {1}).",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 29.7,
        "promoReq": 1
      },
      {
        "type": "MSUCR",
        "value": 12.2,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10006,
    "name": "Mr. Turner",
    "sprite": "MrTurner",
    "activeL1": 8.5,
    "activeL100": 17,
    "cooldown": 900,
    "duration": 30,
    "descriptionLong": "Store mined resources in a Piggy Bank. Unload {0} at the end of the effect in the form of Instant Cash",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MIF",
        "value": 1.44,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10010,
    "name": "Ranger Sue",
    "sprite": "RangerSue",
    "activeL1": 5.1,
    "activeL100": 25.5,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "{0} Mining Speed Boost & Infinite Worker Capacity",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MIF",
        "value": 1.44,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10092,
    "name": "Sigurd",
    "sprite": "Sigurd",
    "activeL1": 2.5,
    "activeL100": 17.2,
    "cooldown": 900,
    "duration": 90,
    "descriptionLong": "Sigurd blows his horn, granting workers a {1} Loading and {2} Walking Speed Boost while multiplying resources by {0}.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 42.66666666666672,
        "promoReq": 1
      },
      {
        "type": "IC",
        "value": 2.86,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10011,
    "name": "Sir Henry",
    "sprite": "SirHenry",
    "activeL1": 8.59,
    "activeL100": 17.09,
    "cooldown": 900,
    "duration": 30,
    "descriptionLong": "Store mined resources in a Magic Safe. Unload {0} at the end of the effect in the form of Instant Cash",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": 2.17,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10048,
    "name": "Sojo",
    "sprite": "Sojo",
    "activeL1": 7.5,
    "activeL100": 18,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "Increases Elevator Capacity and Loading Speed by {0}.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 19.2,
        "promoReq": 1
      },
      {
        "type": "MLSB",
        "value": null,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10035,
    "name": "Zi Galvani",
    "sprite": "ZiGalvani",
    "activeL1": 8.5,
    "activeL100": 12.75,
    "cooldown": 900,
    "duration": 60,
    "descriptionLong": "Beam {0} of mined resources to the Elevator building",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": null,
        "promoReq": 1
      },
      {
        "type": "MIF",
        "value": 1.44,
        "promoReq": 3
      }
    ]
  },
  {
    "gameId": 10014,
    "name": "Chester",
    "sprite": "Chester",
    "activeL1": 4.25,
    "activeL100": 8.5,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Mining & Walking Speed Boost",
    "elements": [
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 23.4,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10012,
    "name": "Goodman Jr.",
    "sprite": "GoodmanJr",
    "activeL1": 0.89,
    "activeL100": 0.94,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Upgrade Cost",
    "elements": [
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10004,
    "name": "Gordon",
    "sprite": "Gordon",
    "activeL1": 4.25,
    "activeL100": 8.5,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Mining & Walking Speed Boost",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "MSUCR",
        "value": 14.7,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10001,
    "name": "Lee Vatori",
    "sprite": "LeeVatori",
    "activeL1": 4.25,
    "activeL100": 8.5,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Loading & Movement Speed Boost",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "EMSB",
        "value": null,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10007,
    "name": "Mark",
    "sprite": "Mark",
    "activeL1": 4.25,
    "activeL100": 8.5,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Loading & Walking Speed Boost",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "GWSB",
        "value": null,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10002,
    "name": "Mr. Goodman",
    "sprite": "MrGoodman",
    "activeL1": 0.89,
    "activeL100": 0.94,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Upgrade Cost",
    "elements": [
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10009,
    "name": "Mrs. Goodman",
    "sprite": "MrsGoodman",
    "activeL1": 0.89,
    "activeL100": 0.94,
    "cooldown": 1800,
    "duration": 300,
    "descriptionLong": "{0} Upgrade Cost",
    "elements": [
      {
        "element": "sand",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "BUCR",
        "value": null,
        "promoReq": 1
      }
    ]
  },
  {
    "gameId": 10115,
    "name": "Don Emiliano",
    "sprite": "DonEmiliano",
    "activeL1": 13.25,
    "activeL100": 22,
    "cooldown": 1800,
    "duration": 120,
    "descriptionLong": "A turtle spawns hearts that give {0} Mineshaft Production as Instant Cash. Chance for a heart to spawn: {1} per {3} seconds, up to {2} as the reef heals.",
    "elements": [
      {
        "element": "water",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "dark",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "sand",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "WMSB",
        "value": 3.269,
        "promoReq": 1
      },
      {
        "type": "CR",
        "value": 59.2,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.504,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10116,
    "name": "Celestia",
    "sprite": "Celestia",
    "activeL1": 5,
    "activeL100": 15,
    "cooldown": 1200,
    "duration": 180,
    "descriptionLong": "Adds {0} of the Warehouse Total Transportation to the Mineshaft Production of both Mineshafts with the highest and lowest Total Production simultaneously. Additionally, she gains {1} Cash from Warehouse Transporters.",
    "elements": [
      {
        "element": "order",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "frost",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "flame",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "wind",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "WWLSB",
        "value": 3.269333333333328,
        "promoReq": 3
      },
      {
        "type": "CIF",
        "value": 1.602666666666672,
        "promoReq": 5
      }
    ]
  },
  {
    "gameId": 10117,
    "name": "Meridia",
    "sprite": "Meridia",
    "activeL1": 6.3,
    "activeL100": 21.5,
    "cooldown": 1200,
    "duration": 150,
    "descriptionLong": "Hits the Elevator with force, granting it infinite Capacity as it rapidly descends through the Mine, copying resources from all Mineshaft crates it passes. The Elevator then returns at normal speed and unloads the copied resources into its stockpile, multiplying them by {0}.",
    "elements": [
      {
        "element": "flame",
        "effectiveness": "SE",
        "rankReq": 0
      },
      {
        "element": "nature",
        "effectiveness": "SE",
        "rankReq": 1
      },
      {
        "element": "light",
        "effectiveness": "SE",
        "rankReq": 3
      },
      {
        "element": "wind",
        "effectiveness": "SE",
        "rankReq": 5
      },
      {
        "element": "sand",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "dark",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "order",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "chaos",
        "effectiveness": "PE",
        "rankReq": 0
      },
      {
        "element": "frost",
        "effectiveness": "NVE",
        "rankReq": 0
      },
      {
        "element": "water",
        "effectiveness": "NVE",
        "rankReq": 0
      }
    ],
    "passives": [
      {
        "type": "CR",
        "value": 84.8,
        "promoReq": 1
      },
      {
        "type": "BUCR",
        "value": 52.26666666666672,
        "promoReq": 3
      },
      {
        "type": "MIF",
        "value": 2.229333333333328,
        "promoReq": 5
      }
    ]
  }
];

