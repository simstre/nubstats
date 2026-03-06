// Map internal weapon class names to display names
const WEAPON_MAP: Record<string, string> = {
  // ARs
  WeapAK47_C: "AKM",
  WeapGroza_C: "Groza",
  WeapM16A4_C: "M16A4",
  WeapHK416_C: "M416",
  WeapSCAR_C: "SCAR-L",
  WeapAUG_C: "AUG A3",
  WeapBerylM762_C: "Beryl M762",
  WeapG36C_C: "G36C",
  WeapQBZ95_C: "QBZ95",
  WeapACE32_C: "ACE32",
  WeapM762_C: "Beryl M762",
  WeapK2_C: "K2",
  WeapFAMAS_C: "FAMAS",
  WeapMk47Mutant_C: "Mk47 Mutant",

  // DMRs
  WeapSKS_C: "SKS",
  WeapMini14_C: "Mini 14",
  WeapSLR_C: "SLR",
  WeapQBU88_C: "QBU88",
  WeapMk12_C: "Mk12",
  WeapMk14_C: "Mk14",
  WeapVSS_C: "VSS",
  WeapDragunov_C: "Dragunov",

  // SRs
  WeapKar98k_C: "Kar98k",
  WeapM24_C: "M24",
  WeapAWM_C: "AWM",
  WeapWin94_C: "Win94",
  WeapMosinNagant_C: "Mosin-Nagant",
  WeapL6_C: "Lynx AMR",

  // SMGs
  WeapUMP_C: "UMP45",
  WeapUZI_C: "Micro UZI",
  WeapVector_C: "Vector",
  WeapBizonPP19_C: "Bizon",
  WeapMP5K_C: "MP5K",
  WeapThompson_C: "Tommy Gun",
  WeapP90_C: "P90",
  WeapMP9_C: "MP9",

  // LMGs
  WeapDP12_C: "DP-28",
  WeapDP28_C: "DP-28",
  WeapM249_C: "M249",
  WeapMG3_C: "MG3",

  // Shotguns
  WeapSaiga12_C: "S12K",
  WeapWinchester_C: "S1897",
  WeapBeretta686_C: "S686",
  WeapDP9A_C: "DBS",
  WeapSawedoff_C: "Sawed-off",

  // Pistols
  WeapP92_C: "P92",
  WeapP18C_C: "P18C",
  WeapNagantR_C: "R1895",
  WeapP1911_C: "P1911",
  WeapRhino_C: "R45",
  WeapDesertEagle_C: "Deagle",
  WeapM9_C: "M9",
  WeapVz61Skorpion_C: "Skorpion",

  // Melee & throwables
  WeapPan_C: "Pan",
  WeapMachete_C: "Machete",
  WeapCrowbar_C: "Crowbar",
  WeapSickle_C: "Sickle",
  WeapGrenade_C: "Frag Grenade",
  WeapMolotov_C: "Molotov",
  WeapC4_C: "C4",
  WeapStickyGrenade_C: "Sticky Bomb",
  WeapFlashBang_C: "Flash Grenade",
  WeapSmokeBomb_C: "Smoke Grenade",

  // Crossbow
  WeapCrossbow_1_C: "Crossbow",

  // Special
  WeapPanzerFaust100M_C: "Panzerfaust",
  WeapM79_C: "M79",
  WeapMortar_C: "Mortar",
  WeapJammer_C: "EMT Gear",
};

export function getWeaponName(raw: string): string {
  if (!raw) return "Unknown";

  // Direct match
  if (WEAPON_MAP[raw]) return WEAPON_MAP[raw];

  // Try stripping prefix/suffix patterns
  const stripped = raw.replace(/^Weap/, "").replace(/_C$/, "");
  for (const [key, val] of Object.entries(WEAPON_MAP)) {
    if (key.includes(stripped) || stripped.includes(key.replace(/^Weap|_C$/g, ""))) {
      return val;
    }
  }

  // Vehicle damage
  if (raw.includes("Dacia") || raw.includes("UAZ") || raw.includes("Buggy") || raw.includes("PickupTruck") || raw.includes("Mirado") || raw.includes("Motorcycle") || raw.includes("Bus") || raw.includes("Boat") || raw.includes("Aqua") || raw.includes("Snowmobile") || raw.includes("Snowbike") || raw.includes("Pony") || raw.includes("Coupe") || raw.includes("Scooter") || raw.includes("Tuk")) {
    return "Vehicle";
  }

  // Bluezone
  if (raw.includes("BlueZone") || raw.includes("Bluezone")) return "Blue Zone";
  if (raw.includes("RedZone") || raw.includes("Redzone")) return "Red Zone";

  // Player (fist/melee)
  if (raw.includes("PlayerMale") || raw.includes("PlayerFemale")) return "Fists";

  // Fallback: clean up the name
  return raw.replace(/^(Weap|BP_)/, "").replace(/_C$/, "").replace(/_/g, " ");
}

export function isActualWeapon(damageCauserName: string, damageTypeCategory: string): boolean {
  if (!damageCauserName || !damageTypeCategory) return false;
  if (damageTypeCategory === "Damage_VehicleCrashHit") return false;
  if (damageTypeCategory === "Damage_Instant_Fall") return false;
  if (damageTypeCategory === "Damage_BlueZone") return false;
  if (damageTypeCategory === "Damage_Drown") return false;
  if (damageCauserName.includes("PlayerMale") || damageCauserName.includes("PlayerFemale")) return false;
  if (damageCauserName.includes("BlueZone") || damageCauserName.includes("RedZone")) return false;
  return true;
}
