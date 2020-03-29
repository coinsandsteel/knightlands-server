const CharacterStat = {
    Health: "health",
    Attack: "attack",
    RaidDamage: "raidDamage",
    CriticalChance: "criticalChance",
    CriticalDamage: "criticalDamage",
    Defense: "defense",
    Energy: "energy",
    Stamina: "stamina",
    Luck: "luck",
    Dodge: "dodge",
    HitRating: "hitRating",
    ExtraGold: "extraGold",
    ExtraExp: "extraExp",
    ExtraDkt: "extraDkt"
};

export default CharacterStat;

let conversions = {};
conversions[CharacterStat.Attack] = 1;
conversions[CharacterStat.Defense] = 1;
conversions[CharacterStat.Health] = 20;
conversions[CharacterStat.Energy] = 1;
conversions[CharacterStat.Stamina] = 1;
conversions[CharacterStat.Luck] = 1;
conversions[CharacterStat.CriticalChance] = 1;
conversions[CharacterStat.Honor] = 1;

export const StatConversions = conversions;

let _DefaultStats = {}
_DefaultStats[CharacterStat.Health] = 50;
_DefaultStats[CharacterStat.Attack] = 5;
_DefaultStats[CharacterStat.CriticalChance] = 2;
_DefaultStats[CharacterStat.Energy] = 30;
_DefaultStats[CharacterStat.CriticalDamage] = 50;
_DefaultStats[CharacterStat.Stamina] = 5;
_DefaultStats[CharacterStat.Luck] = 0;
_DefaultStats[CharacterStat.Defense] = 0;
_DefaultStats[CharacterStat.ExtraDkt] = 0;
_DefaultStats[CharacterStat.ExtraExp] = 0;
_DefaultStats[CharacterStat.ExtraGold] = 0;
_DefaultStats[CharacterStat.RaidDamage] = 0;
_DefaultStats[CharacterStat.Dodge] = 0;
_DefaultStats[CharacterStat.HitRating] = 0;

export const DefaultStats = _DefaultStats; 