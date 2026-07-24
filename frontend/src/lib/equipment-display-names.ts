/**
 * Equipment display name mappings derived from wiki data + APK extraction.
 * Maps catalog equipment IDs to human-readable names with tier suffixes.
 */
const EQUIPMENT_NAMES: Record<number, string> = {
  // Moneymaker Gloves (Common/Rare/Epic?)
  11011: "Moneymaker Gloves",
  11012: "Moneymaker Gloves",
  11013: "Moneymaker Gloves",
  // Fortune Sneakers (Common/Rare/Epic)
  11021: "Fortune Sneakers",
  11022: "Fortune Sneakers",
  // Investor Earpiece
  11031: "Investor Earpiece",
  // Limitless Drive (Common/Rare)
  11041: "Limitless Drive",
  11042: "Limitless Drive",
  // Trendsetter Slacks (Common/Rare)
  11051: "Trendsetter Slacks",
  11052: "Trendsetter Slacks",
  // Frontier Claw
  11063: "Frontier Claw",
  // Umbrella (Common/Rare/Epic)
  11071: "Umbrella",
  11072: "Umbrella",
  // Warm Wool Hat (Rare/Epic)
  11081: "Warm Wool Hat",
  11082: "Warm Wool Hat",
  // Timeless Scarf (Rare/Epic)
  11091: "Timeless Scarf",
  11092: "Timeless Scarf",
  // Watering Can
  13001: "Watering Can",
  // Frontier Helmet
  14021: "Frontier Helmet",
  14022: "Frontier Helmet",
  14023: "Frontier Helmet",
  // Fluffy Earmuffs (Rare/Epic)
  14071: "Fluffy Earmuffs",
  14072: "Fluffy Earmuffs",
  // Cash King Shirt (Epic only)
  14081: "Cash King Shirt",
  14082: "Cash King Shirt",
  14083: "Cash King Shirt",
  // Santa's Hat (Epic only? Actually has two entries...)
  14091: "Santa's Hat",
  14092: "Santa's Hat",
  // Bunny Ears (Epic only)
  15001: "Bunny Ears",
  // Straw Hat (Rare/Epic)
  16001: "Straw Hat",
  16002: "Straw Hat",
  16003: "Straw Hat",
  // Pineapple Sunglasses (Common/Rare/Epic)
  16011: "Pineapple Sunglasses",
  16012: "Pineapple Sunglasses",
  // Edger Floatie (Epic only)
  16021: "Edger Floatie",
  // Eighth equipment name
  17001: "???",
};

const TIER_SUFFIX: Record<number, string> = {
  1: " (C)", 2: " (R)", 3: " (E)",
};

export function equipmentDisplayName(equipmentId: number): string {
  const name = EQUIPMENT_NAMES[equipmentId];
  if (!name) return `Equipment ${equipmentId}`;
  // Derive tier from last digit: xx1 = Common, xx2 = Rare, xx3 = Epic
  const lastDigit = equipmentId % 10;
  const tier = TIER_SUFFIX[lastDigit] ?? "";
  return name + tier;
}
