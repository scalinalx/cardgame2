/* =====================================================================
 * CONQUEST OF ERATHIA — The Card Game
 * data.js : resources, tags, the three Dominion tracks, the nine Towns,
 *           the card deck, deeds, honors and Astrologers' proclamations.
 *
 * Mechanics & structure are Terraforming Mars; every name, number and
 * scrap of flavour is Heroes of Might & Magic III.
 *
 *  TM  ->  HOMM3 mapping
 *  ----------------------
 *  MegaCredits  -> Gold        Oxygen      -> Realm    (towns rising)
 *  Steel        -> Wood/Ore    Temperature -> Sorcery  (the Mage Guilds)
 *  Titanium     -> Crystal     Ocean       -> Frontier (the map cleared)
 *  Plants       -> Recruits    Generation  -> Week
 *  Heat         -> Mercury     Terraform R.-> Renown
 *
 * Effect vocabulary (engine.applyEffects):
 *   {gain:{gold,wood,ore,crystal,recruits,mercury}}  immediate stock (+/-)
 *   {prod:{...}}                                      change production (+/-)
 *   {global:{realm,sorcery,frontier}}                advance a Dominion track
 *   {renown:n} {draw:n} {vpNow:n} {store:n}
 *   {gainPerTag:{tag,res,per}}  {prodPerTag:{tag,res,per}}
 *   {addTrigger:{type,tag?,param?,effect:[...]}}      onPlayTag|onRaiseGlobal|onDiscard
 *   {addAction:{cost:{...},effect:[...],desc}}        once-per-week ability
 *   {attackProd:{res,n}}  {attackRes:{res,n}}         strike an opponent
 * Card requirements: {realmMin,realmMax,sorceryMin,sorceryMax,frontierMin,
 *   frontierMax, tags:{creature:2}, prod:{ore:1}}
 * ===================================================================== */
(function (global) {
  'use strict';

  const RES = ['gold', 'wood', 'ore', 'crystal', 'recruits', 'mercury'];
  const RES_INFO = {
    gold:     { name: 'Gold',     icon: '🪙', color: '#e8c34a' },
    wood:     { name: 'Wood',     icon: '🪵', color: '#9c6b3c' },
    ore:      { name: 'Ore',      icon: '🪨', color: '#b06a4a' },
    crystal:  { name: 'Crystal',  icon: '💎', color: '#6fd3e0' },
    recruits: { name: 'Recruits', icon: '⚔️', color: '#c0504d' },
    mercury:  { name: 'Mercury',  icon: '⚗️', color: '#a779e0' },
  };

  const T = {
    BUILDING: 'building', CREATURE: 'creature', MAGIC: 'magic', MIGHT: 'might',
    DRAGON: 'dragon', UNDEAD: 'undead', BEAST: 'beast', WEALTH: 'wealth', HERO: 'hero',
  };
  const TAG_INFO = {
    building: { name: 'Building', icon: '🏛️' },
    creature: { name: 'Creature', icon: '🐾' },
    magic:    { name: 'Magic',    icon: '🔮' },
    might:    { name: 'Might',    icon: '🛡️' },
    dragon:   { name: 'Dragon',   icon: '🐉' },
    undead:   { name: 'Undead',   icon: '💀' },
    beast:    { name: 'Beast',    icon: '🐗' },
    wealth:   { name: 'Wealth',   icon: '👑' },
    hero:     { name: 'Hero',     icon: '🎖️' },
  };

  // The three tracks of Dominion. Maxing all three ends the conquest.
  const GLOBALS = {
    realm:    { name: 'Realm',    icon: '🏰', max: 14, abbr: 'REALM',
      blurb: 'Towns and forts rising across the land' },
    sorcery:  { name: 'Sorcery',  icon: '🔮', max: 14, abbr: 'SORC',
      blurb: 'The Mage Guilds and the weave of magic' },
    frontier: { name: 'Frontier', icon: '🗺️', max: 9,  abbr: 'FRONT',
      blurb: 'The wild map charted and its monsters cleared' },
  };

  /* ----------------------------- TOWNS ------------------------------ */
  // All nine HOMM3 towns. Each player drafts one. Provides starting state,
  // a passive, sometimes a once-per-week ability.
  const FACTIONS = [
    {
      id: 'castle', name: 'Castle', align: 'good',
      blurb: 'Knights, Cavaliers and Archangels of Erathia — order and stone.',
      desc: 'Start: 47 Gold, +1 Recruit production. Town & Dwelling (Building) cards cost 2 Gold less.',
      start: { res: { gold: 47 }, prod: { recruits: 1 } }, discounts: { building: 2 },
    },
    {
      id: 'rampart', name: 'Rampart', align: 'good',
      blurb: 'Centaurs, Dwarves, Unicorns and Dragons of the deep forests.',
      desc: 'Start: 44 Gold, Sawmill 1 (Building cards cost 2 less) & +1 Recruit production. Mustering a Town costs only 6 Recruits.',
      start: { res: { gold: 44 }, prod: { wood: 1, recruits: 1 } }, settlementCost: 6,
    },
    {
      id: 'tower', name: 'Tower', align: 'good',
      blurb: 'Wizards of Bracada, Genies, Nagas and Titans.',
      desc: 'Start: 40 Gold, 3 Mercury, Mana Vault 1 (Magic cards cost 2 less) & Magic cards cost a further 3 Gold less. Ability: pay 1 Mercury → draw a card.',
      start: { res: { gold: 40, mercury: 3 }, prod: { crystal: 1 } }, discounts: { magic: 3 },
      action: { desc: 'Pay 1 Mercury → draw a card', cost: { mercury: 1 }, effect: [{ draw: 1 }] },
    },
    {
      id: 'inferno', name: 'Inferno', align: 'chaotic',
      blurb: 'Imps, Pit Fiends, Efreeti and the Devils of Eeofol.',
      desc: 'Start: 43 Gold, +1 Mercury production. Whenever you advance Sorcery, gain 2 Gold.',
      start: { res: { gold: 43 }, prod: { mercury: 1 } },
      triggers: [{ type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { gold: 2 } }] }],
    },
    {
      id: 'necropolis', name: 'Necropolis', align: 'chaotic',
      blurb: 'Skeletons, Vampires, Liches and Dread Knights — death given purpose.',
      desc: 'Start: 38 Gold, 4 Recruits, +1 Recruit production. Necromancy: whenever you discard a card, gain 1 Recruit.',
      start: { res: { gold: 38, recruits: 4 }, prod: { recruits: 1 } },
      triggers: [{ type: 'onDiscard', effect: [{ gain: { recruits: 1 } }] }],
    },
    {
      id: 'dungeon', name: 'Dungeon', align: 'chaotic',
      blurb: 'Warlocks of Nighon, Beholders, Manticores and Black Dragons.',
      desc: 'Start: 50 Gold. Dragon & Creature cards cost 3 Gold less. Ability: pay 4 Gold → gain 1 Mercury.',
      start: { res: { gold: 50 } }, discounts: { dragon: 3, creature: 3 },
      action: { desc: 'Pay 4 Gold → gain 1 Mercury', cost: { gold: 4 }, effect: [{ gain: { mercury: 1 } }] },
    },
    {
      id: 'stronghold', name: 'Stronghold', align: 'neutral',
      blurb: 'Goblins, Cyclopes and Behemoths of Krewlod — strength above all.',
      desc: 'Start: 46 Gold, +1 Ore production. Creature cards cost 2 Gold less. When you play a Might card, gain 3 Gold.',
      start: { res: { gold: 46 }, prod: { ore: 1 } }, discounts: { creature: 2 },
      triggers: [{ type: 'onPlayTag', tag: 'might', effect: [{ gain: { gold: 3 } }] }],
    },
    {
      id: 'fortress', name: 'Fortress', align: 'neutral',
      blurb: 'Gnolls, Basilisks, Gorgons and Hydras of the Tatalian swamps.',
      desc: 'Start: 42 Gold, +1 Ore & +1 Recruit production. Beast cards cost 3 Gold less; playing a Beast gains 1 Recruit.',
      start: { res: { gold: 42 }, prod: { ore: 1, recruits: 1 } }, discounts: { beast: 3 },
      triggers: [{ type: 'onPlayTag', tag: 'beast', effect: [{ gain: { recruits: 1 } }] }],
    },
    {
      id: 'conflux', name: 'Conflux', align: 'neutral',
      blurb: 'Elementals, Sprites and the immortal Phoenix.',
      desc: 'Start: 41 Gold, 2 Mercury, +1 Mercury production. Whenever you advance Sorcery, draw a card.',
      start: { res: { gold: 41, mercury: 2 }, prod: { mercury: 1 } },
      triggers: [{ type: 'onRaiseGlobal', param: 'sorcery', effect: [{ draw: 1 }] }],
    },
  ];

  /* ----------------------------- CARDS ------------------------------ */
  // type: 'auto' = Structure (Town building / creature dwelling — plays & stays,
  // passive), 'active' = Power (Hero / Artifact / active institution — stays, has
  // an ability or trigger), 'event' = Spell (cast once, then discarded).
  // NB: the display label is separate from the 🏛️ 'building' TAG.
  const CARDS = [
    /* ============ TOWN BUILDINGS — resource economy ============ */
    { id: 'sawmill', name: 'Sawmill', type: 'auto', tags: ['building'], cost: 5,
      effects: [{ prod: { wood: 1 } }], text: '+1 Sawmill — your Building cards cost 2 Gold less.' },
    { id: 'ore_pit', name: 'Ore Pit', type: 'auto', tags: ['building'], cost: 5,
      effects: [{ prod: { ore: 1 } }], text: '+1 Ore production.' },
    { id: 'alchemist_lab', name: "Alchemist's Lab", type: 'auto', tags: ['building', 'magic'], cost: 8,
      effects: [{ prod: { mercury: 1 } }, { gain: { gold: 2 } }], text: '+1 Mercury production. Gain 2 Gold.' },
    { id: 'crystal_cavern', name: 'Crystal Cavern', type: 'auto', tags: ['building', 'magic'], cost: 12,
      req: { sorceryMin: 3 }, vp: 1, effects: [{ prod: { crystal: 1 } }, { gain: { mercury: 1 } }],
      text: 'Requires Sorcery 3+. +1 Mana Vault (Magic cards cost 2 less). Gain 1 Mercury.' },
    { id: 'mystic_pond', name: 'Mystic Pond', type: 'auto', tags: ['building', 'magic'], cost: 7,
      effects: [{ prod: { crystal: 1 } }], text: '+1 Mana Vault — your Magic cards cost 2 Gold less.' },
    { id: 'marketplace', name: 'Marketplace', type: 'auto', tags: ['building', 'wealth'], cost: 8,
      effects: [{ prod: { gold: 1 } }, { draw: 1 }], text: '+1 Gold production. Draw a card.' },
    { id: 'blacksmith', name: 'Blacksmith', type: 'auto', tags: ['building'], cost: 7,
      effects: [{ prod: { ore: 1 } }, { gain: { gold: 4 } }], text: '+1 Ore production. Gain 4 Gold.' },
    { id: 'tavern', name: 'Tavern', type: 'auto', tags: ['building', 'wealth'], cost: 3,
      effects: [{ gain: { gold: 3 } }, { prod: { gold: 1 } }], text: 'Gain 3 Gold. +1 Gold production.' },
    { id: 'town_hall', name: 'Town Hall', type: 'auto', tags: ['building', 'wealth'], cost: 10,
      effects: [{ prod: { gold: 2 } }], text: '+2 Gold production.' },
    { id: 'city_hall', name: 'City Hall', type: 'auto', tags: ['building', 'wealth'], cost: 18,
      req: { realmMin: 5 }, vp: 1, effects: [{ prod: { gold: 3 } }], text: 'Requires Realm 5+. +3 Gold production.' },
    { id: 'capitol', name: 'Capitol', type: 'auto', tags: ['building', 'wealth'], cost: 28,
      req: { realmMin: 6 }, vp: 3, effects: [{ prod: { gold: 5 } }], text: 'Requires Realm 6+. +5 Gold production.' },
    { id: 'resource_silo', name: 'Resource Silo', type: 'auto', tags: ['building'], cost: 6,
      effects: [{ gain: { ore: 4 } }], text: 'Gain 4 Ore.' },
    { id: 'mage_guild', name: 'Mage Guild', type: 'auto', tags: ['building', 'magic'], cost: 9,
      effects: [{ prod: { mercury: 1 } }, { draw: 1 }], text: '+1 Mercury production. Draw a card.' },
    { id: 'great_library', name: 'Great Library', type: 'active', tags: ['building', 'magic'], cost: 13,
      vp: 1, effects: [{ addTrigger: { type: 'onRaiseGlobal', effect: [{ draw: 1 }] } }],
      text: 'When you advance any Dominion track, draw a card.' },
    { id: 'wizards_academy', name: 'Wizards Academy', type: 'auto', tags: ['building', 'magic'], cost: 17,
      req: { tags: { magic: 2 } }, vp: 1, effects: [{ prod: { mercury: 1 } }, { gainPerTag: { tag: 'magic', res: 'mercury', per: 2 } }],
      text: 'Requires 2 Magic tags. +1 Mercury production. Gain 1 Mercury per 2 Magic tags.' },
    { id: 'warlords_hall', name: "Warlord's Hall", type: 'auto', tags: ['building', 'might'], cost: 16,
      vp: 1, effects: [{ prodPerTag: { tag: 'creature', res: 'gold', per: 3 } }, { gain: { gold: 2 } }],
      text: '+1 Gold production per 3 Creature tags. Gain 2 Gold.' },
    { id: 'fort', name: 'Fort', type: 'auto', tags: ['building', 'might'], cost: 4,
      effects: [{ prod: { recruits: 1 } }], text: '+1 Recruit production.' },
    { id: 'citadel', name: 'Citadel', type: 'auto', tags: ['building', 'might'], cost: 6,
      vp: 1, effects: [{ gain: { ore: 2 } }, { prod: { recruits: 1 } }], text: 'Gain 2 Ore. +1 Recruit production.' },
    { id: 'lighthouse', name: 'Lighthouse', type: 'auto', tags: ['building', 'wealth'], cost: 7,
      effects: [{ prod: { gold: 1 } }, { gain: { gold: 2 } }], text: '+1 Gold production. Gain 2 Gold.' },
    { id: 'adventurers_guild', name: 'Adventurers Guild', type: 'active', tags: ['building'], cost: 9,
      effects: [{ addTrigger: { type: 'onPlayTag', tag: 'creature', effect: [{ gain: { gold: 2 } }] } }],
      text: 'When you play a Creature card, gain 2 Gold.' },
    { id: 'bracada_bazaar', name: 'Bracada Bazaar', type: 'active', tags: ['building', 'wealth'], cost: 8,
      effects: [{ addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { gold: 2 } }] } }],
      text: 'When you play a Magic card, gain 2 Gold.' },
    { id: 'necromancy_amp', name: 'Necromancy Amplifier', type: 'auto', tags: ['building', 'magic', 'undead'], cost: 14,
      req: { tags: { undead: 1 } }, vp: 1, effects: [{ prodPerTag: { tag: 'undead', res: 'recruits', per: 2 } }],
      text: 'Requires 1 Undead tag. +1 Recruit production per 2 Undead tags.' },
    { id: 'grail_sanctuary', name: 'Sanctuary of the Grail', type: 'auto', tags: ['building', 'magic', 'wealth'], cost: 30,
      req: { realmMin: 10, sorceryMin: 8 }, vp: 5, effects: [{ prod: { gold: 3 } }, { global: { realm: 1 } }, { global: { sorcery: 1 } }],
      text: 'Requires Realm 10+ and Sorcery 8+. +3 Gold production. Advance Realm and Sorcery 1 each. (5 VP)' },

    /* ============ CREATURE DWELLINGS ============ */
    { id: 'pikeman_barracks', name: 'Pikeman Barracks', type: 'auto', tags: ['creature', 'might'], cost: 4,
      effects: [{ prod: { recruits: 1 } }], text: '+1 Recruit production.' },
    { id: 'goblin_huts', name: 'Goblin Huts', type: 'auto', tags: ['creature', 'might'], cost: 3,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 2 } }], text: '+1 Recruit production. Gain 2 Gold.' },
    { id: 'gnoll_hut', name: 'Gnoll Hut', type: 'auto', tags: ['creature', 'beast'], cost: 4,
      effects: [{ prod: { recruits: 1 } }, { gain: { ore: 1 } }], text: '+1 Recruit production. Gain 1 Ore.' },
    { id: 'centaur_stables', name: 'Centaur Stables', type: 'auto', tags: ['creature', 'beast'], cost: 4,
      effects: [{ prod: { recruits: 1 } }, { gain: { ore: 1 } }], text: '+1 Recruit production. Gain 1 Ore.' },
    { id: 'imp_crucible', name: 'Imp Crucible', type: 'auto', tags: ['creature'], cost: 5,
      effects: [{ prod: { recruits: 1 } }, { gain: { mercury: 1 } }], text: '+1 Recruit production. Gain 1 Mercury.' },
    { id: 'troglodyte_burrow', name: 'Troglodyte Burrow', type: 'auto', tags: ['creature'], cost: 4,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 1 } }], text: '+1 Recruit production. Gain 1 Gold.' },
    { id: 'gremlin_workshop', name: 'Gremlin Workshop', type: 'auto', tags: ['creature', 'magic'], cost: 6,
      effects: [{ prod: { recruits: 1 } }, { gain: { ore: 2 } }], text: '+1 Recruit production. Gain 2 Ore.' },
    { id: 'skeleton_crypt', name: 'Skeleton Crypt', type: 'auto', tags: ['creature', 'undead'], cost: 6,
      effects: [{ prod: { recruits: 1 } }, { gain: { recruits: 2 } }], text: '+1 Recruit production. Gain 2 Recruits.' },
    { id: 'archers_tower', name: "Archers' Tower", type: 'auto', tags: ['creature'], cost: 7,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 4 } }], text: '+1 Recruit production. Gain 4 Gold.' },
    { id: 'wolf_pickets', name: 'Wolf Raider Pickets', type: 'auto', tags: ['creature', 'beast', 'might'], cost: 8,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 3 } }], text: '+1 Recruit production. Gain 3 Gold.' },
    { id: 'harpy_loft', name: 'Harpy Loft', type: 'auto', tags: ['creature', 'beast'], cost: 7,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 3 } }], text: '+1 Recruit production. Gain 3 Gold.' },
    { id: 'dendroid_arches', name: 'Dendroid Arches', type: 'auto', tags: ['creature', 'beast'], cost: 9,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { wood: 1 } }], text: '+1 Recruit production & +1 Sawmill (Building cards cost 2 less).' },
    { id: 'pegasus_glade', name: 'Pegasus Glade', type: 'auto', tags: ['creature', 'beast', 'magic'], cost: 10,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }], text: '+1 Recruit & +1 Mercury production.' },
    { id: 'medusa_lair', name: 'Medusa Lair', type: 'auto', tags: ['creature', 'magic'], cost: 10,
      effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }], text: '+1 Recruit & +1 Mercury production.' },
    { id: 'griffin_tower', name: 'Griffin Tower', type: 'auto', tags: ['creature', 'beast'], cost: 11,
      vp: 1, effects: [{ prod: { recruits: 2 } }], text: '+2 Recruit production.' },
    { id: 'minotaur_maze', name: 'Minotaur Labyrinth', type: 'auto', tags: ['creature', 'might'], cost: 10,
      vp: 1, effects: [{ prod: { recruits: 2 } }], text: '+2 Recruit production.' },
    { id: 'pit_fiend_pit', name: 'Pit Fiend Pit', type: 'auto', tags: ['creature'], cost: 11,
      effects: [{ prod: { recruits: 2 } }], text: '+2 Recruit production.' },
    { id: 'ogre_fort', name: 'Ogre Fort', type: 'auto', tags: ['creature', 'might'], cost: 9,
      effects: [{ prod: { recruits: 2 } }, { gain: { ore: 1 } }], text: '+2 Recruit production. Gain 1 Ore.' },
    { id: 'basilisk_pit', name: 'Basilisk Pit', type: 'auto', tags: ['creature', 'beast'], cost: 8,
      req: { frontierMin: 2 }, vp: 1, effects: [{ prod: { recruits: 2 } }], text: 'Requires Frontier 2+. +2 Recruit production.' },
    { id: 'gorgon_lair', name: 'Gorgon Lair', type: 'auto', tags: ['creature', 'beast'], cost: 12,
      vp: 1, effects: [{ prod: { recruits: 2 } }, { gain: { ore: 2 } }], text: '+2 Recruit production. Gain 2 Ore.' },
    { id: 'wyvern_nest', name: 'Wyvern Nest', type: 'auto', tags: ['creature', 'beast'], cost: 11,
      req: { frontierMin: 3 }, vp: 1, effects: [{ prod: { recruits: 2 } }], text: 'Requires Frontier 3+. +2 Recruit production.' },
    { id: 'cavalier_stable', name: 'Cavalier Stable', type: 'auto', tags: ['creature', 'might'], cost: 13,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { gold: 1 } }], text: '+1 Recruit & +1 Gold production.' },
    { id: 'naga_bank', name: 'Naga Bank', type: 'auto', tags: ['creature', 'magic'], cost: 13,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { crystal: 1 } }], text: '+1 Recruit production & +1 Mana Vault (Magic cards cost 2 less).' },
    { id: 'cyclops_cave', name: 'Cyclops Cave', type: 'auto', tags: ['creature', 'might'], cost: 12,
      vp: 1, effects: [{ prod: { recruits: 2 } }, { gain: { ore: 2 } }], text: '+2 Recruit production. Gain 2 Ore.' },
    { id: 'thunderbird_aerie', name: 'Thunderbird Aerie', type: 'auto', tags: ['creature', 'beast'], cost: 13,
      req: { frontierMin: 3 }, vp: 2, effects: [{ prod: { recruits: 2 } }], text: 'Requires Frontier 3+. +2 Recruit production. (2 VP)' },
    { id: 'genie_lamp', name: 'Genie Lamp', type: 'auto', tags: ['creature', 'magic'], cost: 12,
      vp: 1, effects: [{ prod: { mercury: 1 } }, { draw: 1 }], text: '+1 Mercury production. Draw a card.' },
    { id: 'efreet_cells', name: 'Efreet Cells', type: 'auto', tags: ['creature', 'magic'], cost: 12,
      req: { sorceryMin: 3 }, vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }],
      text: 'Requires Sorcery 3+. +1 Recruit & +1 Mercury production.' },
    { id: 'storm_conflux', name: 'Storm Elemental Conflux', type: 'auto', tags: ['creature', 'magic'], cost: 10,
      effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }], text: '+1 Recruit & +1 Mercury production.' },
    { id: 'vampire_mansion', name: 'Vampire Mansion', type: 'active', tags: ['creature', 'undead'], cost: 10,
      vp: { perStore: 2 }, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }],
      text: 'When you discard a card, raise a Vampire here. 1 VP per 2 Vampires.' },
    { id: 'lich_tower', name: 'Lich Tower', type: 'active', tags: ['creature', 'undead', 'magic'], cost: 12,
      vp: 1, effects: [{ prod: { mercury: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'undead', effect: [{ gain: { mercury: 2 } }] } }],
      text: '+1 Mercury production. When you play an Undead card, gain 2 Mercury.' },
    { id: 'behemoth_lair', name: 'Behemoth Lair', type: 'auto', tags: ['creature', 'beast', 'might'], cost: 17,
      vp: 2, effects: [{ prod: { recruits: 2 } }, { gain: { ore: 3 } }], text: '+2 Recruit production. Gain 3 Ore.' },
    { id: 'hydra_pond', name: 'Hydra Pond', type: 'auto', tags: ['creature', 'beast'], cost: 9,
      req: { frontierMin: 2 }, vp: 1, effects: [{ prod: { recruits: 2 } }, { prod: { ore: -1 } }],
      text: 'Requires Frontier 2+. +2 Recruit production, -1 Ore production.' },
    { id: 'dread_knight_crypt', name: 'Dread Knight Crypt', type: 'auto', tags: ['creature', 'undead', 'might'], cost: 16,
      req: { realmMin: 4 }, vp: 2, effects: [{ prod: { recruits: 2 } }, { gain: { recruits: 2 } }],
      text: 'Requires Realm 4+. +2 Recruit production. Gain 2 Recruits. (2 VP)' },

    /* ---- Top-tier creatures (iconic) ---- */
    { id: 'angel_spire', name: 'Archangel Spire', type: 'auto', tags: ['creature', 'might'], cost: 22,
      req: { realmMin: 8 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { global: { realm: 1 } }],
      text: 'Requires Realm 8+. +2 Recruit production. Advance Realm 1 step. (3 VP)' },
    { id: 'titan_hall', name: "Titan's Hall", type: 'auto', tags: ['creature', 'magic'], cost: 22,
      req: { sorceryMin: 7 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { prod: { crystal: 1 } }],
      text: 'Requires Sorcery 7+. +2 Recruit production & +1 Mana Vault (Magic cards cost 2 less). (3 VP)' },
    { id: 'devils_gate', name: "Devil's Gate", type: 'auto', tags: ['creature'], cost: 20,
      req: { sorceryMin: 6 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { gain: { gold: 4 } }],
      text: 'Requires Sorcery 6+. +2 Recruit production. Gain 4 Gold. (3 VP)' },
    { id: 'phoenix_roost', name: 'Phoenix Roost', type: 'auto', tags: ['creature', 'magic'], cost: 18,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { prod: { mercury: 1 } }],
      text: 'Requires Sorcery 5+. +2 Recruit & +1 Mercury production. (3 VP)' },

    /* ============ DRAGONS ============ */
    { id: 'green_dragon_glade', name: 'Green Dragon Glade', type: 'auto', tags: ['creature', 'dragon'], cost: 14,
      req: { sorceryMin: 3 }, vp: 2, effects: [{ prod: { recruits: 1 } }, { gain: { gold: 5 } }],
      text: 'Requires Sorcery 3+. +1 Recruit production. Gain 5 Gold from the dragon hoard. (2 VP)' },
    { id: 'gold_dragon_vault', name: 'Gold Dragon Vault', type: 'auto', tags: ['creature', 'dragon', 'wealth'], cost: 18,
      req: { sorceryMin: 4 }, vp: 2, effects: [{ prod: { gold: 3 } }], text: 'Requires Sorcery 4+. +3 Gold production. (2 VP)' },
    { id: 'red_dragon_cave', name: 'Red Dragon Cave', type: 'auto', tags: ['creature', 'dragon', 'magic'], cost: 16,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }],
      text: 'Requires Sorcery 5+. +1 Recruit & +1 Mercury production. (3 VP)' },
    { id: 'black_dragon_cave', name: 'Black Dragon Cave', type: 'auto', tags: ['creature', 'dragon', 'magic'], cost: 21,
      req: { sorceryMin: 7 }, vp: 4, effects: [{ prod: { recruits: 2 } }, { gain: { mercury: 2 } }],
      text: 'Requires Sorcery 7+. +2 Recruit production. Gain 2 Mercury. (4 VP)' },
    { id: 'bone_dragon_crypt', name: 'Bone Dragon Crypt', type: 'auto', tags: ['creature', 'dragon', 'undead'], cost: 15,
      req: { sorceryMin: 4 }, vp: 2, effects: [{ prod: { recruits: 2 } }], text: 'Requires Sorcery 4+. +2 Recruit production. (2 VP)' },
    { id: 'crystal_dragon_lair', name: 'Crystal Dragon Lair', type: 'auto', tags: ['creature', 'dragon'], cost: 17,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { crystal: 1 } }, { prod: { recruits: 1 } }],
      text: 'Requires Sorcery 5+. +1 Mana Vault (Magic cards cost 2 less) & +1 Recruit production. (3 VP)' },
    { id: 'faerie_dragon_glade', name: 'Faerie Dragon Glade', type: 'active', tags: ['creature', 'dragon', 'magic'], cost: 14,
      req: { sorceryMin: 3 }, vp: 1, effects: [{ prodPerTag: { tag: 'dragon', res: 'mercury', per: 1 } }],
      text: 'Requires Sorcery 3+. +1 Mercury production per Dragon tag (including this).' },

    /* ============ HEROES ============ */
    { id: 'hero_mullich', name: 'Sir Mullich', type: 'active', tags: ['hero', 'might'], cost: 8,
      vp: 1, effects: [{ addAction: { desc: 'Pay 2 Ore → gain 6 Gold', cost: { ore: 2 }, effect: [{ gain: { gold: 6 } }] } }],
      text: 'Ability: pay 2 Ore → gain 6 Gold.' },
    { id: 'hero_solmyr', name: 'Solmyr', type: 'active', tags: ['hero', 'magic'], cost: 11,
      vp: 1, effects: [{ prod: { mercury: 1 } }, { addAction: { desc: 'Pay 2 Mercury → draw 2 cards', cost: { mercury: 2 }, effect: [{ draw: 2 }] } }],
      text: '+1 Mercury production. Ability: pay 2 Mercury → draw 2 cards.' },
    { id: 'hero_crag_hack', name: 'Crag Hack', type: 'active', tags: ['hero', 'might', 'creature'], cost: 9,
      vp: 1, effects: [{ gain: { recruits: 2 } }, { addAction: { desc: 'Pay 3 Gold → gain 3 Recruits', cost: { gold: 3 }, effect: [{ gain: { recruits: 3 } }] } }],
      text: 'Gain 2 Recruits. Ability: pay 3 Gold → gain 3 Recruits.' },
    { id: 'hero_sandro', name: 'Sandro', type: 'active', tags: ['hero', 'magic', 'undead'], cost: 12,
      vp: 1, effects: [{ addAction: { desc: 'Pay 1 Mercury → gain 2 Recruits', cost: { mercury: 1 }, effect: [{ gain: { recruits: 2 } }] } }],
      text: 'The necromancer. Ability: pay 1 Mercury → gain 2 Recruits.' },
    { id: 'hero_gelu', name: 'Gelu', type: 'active', tags: ['hero', 'creature'], cost: 10,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { addAction: { desc: 'Pay 4 Recruits → advance Frontier', cost: { recruits: 4 }, effect: [{ global: { frontier: 1 } }] } }],
      text: '+1 Recruit production. Ability: pay 4 Recruits → advance Frontier.' },
    { id: 'hero_gem', name: 'Gem', type: 'active', tags: ['hero', 'magic'], cost: 9,
      vp: 1, effects: [{ addAction: { desc: 'Pay 5 Gold → +1 Mercury production', cost: { gold: 5 }, effect: [{ prod: { mercury: 1 } }] } }],
      text: 'Ability: pay 5 Gold → +1 Mercury production.' },
    { id: 'hero_mutare', name: 'Mutare Drake', type: 'active', tags: ['hero', 'magic', 'dragon'], cost: 12,
      vp: 1, effects: [{ addTrigger: { type: 'onPlayTag', tag: 'dragon', effect: [{ gain: { gold: 3 } }] } }],
      text: 'When you play a Dragon card, gain 3 Gold.' },
    { id: 'hero_tazar', name: 'Tazar', type: 'active', tags: ['hero', 'might', 'beast'], cost: 10,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { addAction: { desc: 'Pay 2 Ore → gain 3 Recruits', cost: { ore: 2 }, effect: [{ gain: { recruits: 3 } }] } }],
      text: '+1 Recruit production. Ability: pay 2 Ore → gain 3 Recruits.' },
    { id: 'hero_luna', name: 'Luna', type: 'active', tags: ['hero', 'magic'], cost: 13,
      vp: 1, effects: [{ addAction: { desc: 'Pay 9 Gold → advance Sorcery', cost: { gold: 9 }, effect: [{ global: { sorcery: 1 } }] } }],
      text: 'Ability: pay 9 Gold → advance Sorcery 1 step.' },

    /* ============ ARTIFACTS ============ */
    { id: 'art_spellbinders_hat', name: "Spellbinder's Hat", type: 'active', tags: ['magic', 'wealth'], cost: 9,
      effects: [{ addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ draw: 1 }] } }],
      text: 'When you advance Sorcery, draw a card.' },
    { id: 'art_orb_of_fire', name: 'Orb of Tempestuous Fire', type: 'active', tags: ['magic'], cost: 13,
      vp: 1, effects: [{ prod: { mercury: 1 } }, { addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { mercury: 1 } }] } }],
      text: '+1 Mercury production. When you advance Sorcery, gain 1 Mercury.' },
    { id: 'art_cornucopia', name: 'Cornucopia', type: 'active', tags: ['wealth'], cost: 11,
      vp: 1, effects: [{ addTrigger: { type: 'onPlayTag', tag: 'wealth', effect: [{ gain: { gold: 3 } }] } }],
      text: 'When you play a Wealth card, gain 3 Gold.' },
    { id: 'art_endless_bag', name: 'Endless Bag of Gold', type: 'active', tags: ['wealth'], cost: 12,
      effects: [{ prod: { gold: 3 } }], text: '+3 Gold production.' },
    { id: 'art_endless_sack', name: 'Endless Sack of Gold', type: 'active', tags: ['wealth'], cost: 20,
      vp: 1, effects: [{ prod: { gold: 4 } }], text: '+4 Gold production.' },
    { id: 'art_vial_mercury', name: 'Everpouring Vial of Mercury', type: 'active', tags: ['magic'], cost: 8,
      vp: 1, effects: [{ prod: { mercury: 1 } }], text: '+1 Mercury production. (1 VP)' },
    { id: 'art_crystal_cloak', name: 'Everflowing Crystal Cloak', type: 'active', tags: ['magic', 'wealth'], cost: 9,
      vp: 1, effects: [{ prod: { crystal: 1 } }], text: '+1 Mana Vault — your Magic cards cost 2 Gold less. (1 VP)' },
    { id: 'art_cloak_undead_king', name: 'Cloak of the Undead King', type: 'active', tags: ['magic', 'undead'], cost: 10,
      vp: 1, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { recruits: 1 } }] } }],
      text: 'When you discard a card, gain 1 Recruit.' },
    { id: 'art_sandals_saint', name: 'Sandals of the Saint', type: 'active', tags: ['wealth'], cost: 8,
      vp: 2, effects: [{ gain: { gold: 3 } }], text: 'Gain 3 Gold. (2 VP)' },
    { id: 'art_shield_dwarven', name: 'Shield of the Dwarven Lords', type: 'active', tags: ['might'], cost: 5,
      vp: 1, protect: true, effects: [], text: 'Your resources & production cannot be reduced by opponents. (1 VP)' },
    { id: 'art_tome_fire', name: 'Tome of Fire Magic', type: 'active', tags: ['magic'], cost: 12,
      req: { sorceryMin: 3 }, vp: 1, effects: [{ addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { mercury: 1 } }] } }],
      text: 'Requires Sorcery 3+. When you play a Magic card, gain 1 Mercury.' },
    { id: 'art_statesmans_medal', name: "Statesman's Medal", type: 'active', tags: ['wealth'], cost: 7,
      vp: 1, effects: [{ gain: { gold: 4 } }, { prod: { gold: 1 } }], text: 'Gain 4 Gold. +1 Gold production. (1 VP)' },

    /* ============ SPELLS (events) ============ */
    { id: 'spell_town_portal', name: 'Town Portal', type: 'event', tags: ['magic'], cost: 4,
      effects: [{ gain: { gold: 9 } }], text: 'Gain 9 Gold.' },
    { id: 'spell_town_gate', name: 'Town Gate', type: 'event', tags: ['magic'], cost: 3,
      effects: [{ gain: { gold: 6 } }], text: 'Gain 6 Gold.' },
    { id: 'spell_dimension_door', name: 'Dimension Door', type: 'event', tags: ['magic'], cost: 10,
      effects: [{ global: { realm: 1 } }], text: 'Advance Realm 1 step.' },
    { id: 'spell_summon_boat', name: 'Summon Boat', type: 'event', tags: ['magic'], cost: 8,
      effects: [{ global: { frontier: 1 } }], text: 'Advance Frontier 1 step.' },
    { id: 'spell_view_earth', name: 'View Earth', type: 'event', tags: ['magic'], cost: 4,
      effects: [{ draw: 2 }], text: 'Draw 2 cards.' },
    { id: 'spell_fly', name: 'Fly', type: 'event', tags: ['magic'], cost: 6,
      effects: [{ draw: 3 }], text: 'Draw 3 cards.' },
    { id: 'spell_meteor', name: 'Meteor Shower', type: 'event', tags: ['magic'], cost: 12,
      effects: [{ global: { sorcery: 2 } }], text: 'Advance Sorcery 2 steps.' },
    { id: 'spell_prayer', name: 'Prayer', type: 'event', tags: ['magic'], cost: 7,
      effects: [{ gain: { gold: 4, ore: 2, mercury: 1 } }], text: 'Gain 4 Gold, 2 Ore, 1 Mercury.' },
    { id: 'spell_resurrection', name: 'Resurrection', type: 'event', tags: ['magic', 'undead'], cost: 5,
      effects: [{ gain: { recruits: 4 } }], text: 'Gain 4 Recruits.' },
    { id: 'spell_animate_dead', name: 'Animate Dead', type: 'event', tags: ['magic', 'undead'], cost: 6,
      effects: [{ gain: { recruits: 3 } }], text: 'Gain 3 Recruits.' },
    { id: 'spell_summon_elem', name: 'Summon Elementals', type: 'event', tags: ['magic'], cost: 9,
      effects: [{ gain: { recruits: 2, mercury: 2 } }], text: 'Gain 2 Recruits and 2 Mercury.' },
    { id: 'spell_earthquake', name: 'Earthquake', type: 'event', tags: ['magic'], cost: 9,
      effects: [{ attackProd: { res: 'ore', n: 1 } }, { gain: { ore: 2 } }], text: 'Each opponent: -1 Ore production. Gain 2 Ore.' },
    { id: 'spell_implosion', name: 'Implosion', type: 'event', tags: ['magic'], cost: 11,
      effects: [{ attackRes: { res: 'gold', n: 8 } }, { gain: { mercury: 1 } }], text: 'Each opponent loses 8 Gold. Gain 1 Mercury.' },
    { id: 'spell_slow', name: 'Slow', type: 'event', tags: ['magic'], cost: 6,
      effects: [{ attackRes: { res: 'gold', n: 6 } }], text: 'Each opponent loses 6 Gold.' },
    { id: 'spell_berserk', name: 'Berserk', type: 'event', tags: ['magic'], cost: 8,
      effects: [{ attackProd: { res: 'recruits', n: 1 } }, { gain: { gold: 3 } }], text: 'Each opponent: -1 Recruit production. Gain 3 Gold.' },
    { id: 'spell_armageddon', name: 'Armageddon', type: 'event', tags: ['magic'], cost: 16,
      effects: [{ attackProd: { res: 'recruits', n: 1 } }, { global: { sorcery: 1 } }, { gain: { mercury: 2 } }],
      text: 'Each opponent: -1 Recruit production. Advance Sorcery 1 step. Gain 2 Mercury.' },

    /* ============ FRONTIER CARDS (public — reward charting the map) ============ */
    { id: 'outpost', name: 'Frontier Outpost', type: 'auto', tags: ['building', 'might'], cost: 7,
      req: { frontierMin: 1 }, vp: 1, effects: [{ prod: { recruits: 1 } }], text: 'Requires Frontier 1+. +1 Recruit production.' },
    { id: 'trading_post', name: 'Trading Post', type: 'auto', tags: ['building', 'wealth'], cost: 11,
      req: { frontierMin: 2 }, vp: 1, effects: [{ prod: { gold: 2 } }], text: 'Requires Frontier 2+. +2 Gold production.' },
    { id: 'rangers_guild', name: "Rangers' Guild", type: 'auto', tags: ['creature', 'beast'], cost: 10,
      req: { frontierMin: 2 }, vp: 1, effects: [{ prod: { recruits: 2 } }], text: 'Requires Frontier 2+. +2 Recruit production.' },
    { id: 'cartographers', name: "Cartographers' Guild", type: 'auto', tags: ['building', 'magic'], cost: 12,
      req: { frontierMin: 2 }, vp: 1, effects: [{ prod: { mercury: 1 } }, { draw: 1 }], text: 'Requires Frontier 2+. +1 Mercury production. Draw a card.' },
    { id: 'caravan', name: 'Trade Caravan', type: 'auto', tags: ['building', 'wealth'], cost: 9,
      req: { frontierMin: 2 }, effects: [{ gain: { gold: 4 } }, { gainPerTile: { tile: 'region', res: 'gold', per: 1, mult: 2 } }],
      text: 'Requires Frontier 2+. Gain 4 Gold, +2 Gold per Region you hold.' },
    { id: 'border_citadel', name: 'Border Citadel', type: 'auto', tags: ['building', 'might'], cost: 15,
      req: { frontierMin: 3 }, vp: 2, effects: [{ prod: { recruits: 1 } }, { prod: { gold: 1 } }, { gain: { ore: 2 } }],
      text: 'Requires Frontier 3+. +1 Recruit & +1 Gold production. Gain 2 Ore.' },
    { id: 'conquerors_monument', name: "Conqueror's Monument", type: 'auto', tags: ['building', 'wealth'], cost: 16,
      req: { frontierMin: 4 }, vp: { perTile: { tile: 'region', per: 1 } }, effects: [{ prod: { gold: 1 } }],
      text: 'Requires Frontier 4+. +1 Gold production. Worth 1 VP per Region you hold.' },
    { id: 'colossus_marches', name: 'Colossus of the Marches', type: 'auto', tags: ['creature', 'might'], cost: 19,
      req: { frontierMin: 5 }, vp: 3, effects: [{ prod: { recruits: 3 } }], text: 'Requires Frontier 5+. +3 Recruit production.' },
    { id: 'scout_riders', name: 'Scout Riders', type: 'auto', tags: ['creature', 'beast'], cost: 8,
      req: { frontierMin: 1 }, effects: [{ prod: { recruits: 1 } }, { gain: { gold: 3 } }], text: 'Requires Frontier 1+. +1 Recruit production. Gain 3 Gold.' },

    /* ============ TOWN-SIGNATURE CARDS (only your Town can field these) ============ */
    { id: 'cas_crusaders', name: 'Crusader Barracks', type: 'auto', faction: 'castle', tags: ['creature', 'might'], cost: 9,
      vp: 1, effects: [{ prod: { recruits: 2 } }], text: '+2 Recruit production.' },
    { id: 'cas_monastery', name: 'Monastery', type: 'auto', faction: 'castle', tags: ['building', 'magic'], cost: 11,
      effects: [{ prod: { mercury: 1 } }, { prod: { gold: 1 } }], text: '+1 Mercury & +1 Gold production.' },
    { id: 'ram_unicorn', name: 'Unicorn Glade', type: 'auto', faction: 'rampart', tags: ['creature', 'beast', 'magic'], cost: 12,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }], text: '+1 Recruit & +1 Mercury production.' },
    { id: 'tow_golem', name: 'Golem Factory', type: 'auto', faction: 'tower', tags: ['creature', 'might'], cost: 10,
      vp: 1, effects: [{ prod: { recruits: 2 } }, { gain: { ore: 2 } }], text: '+2 Recruit production. Gain 2 Ore.' },
    { id: 'dun_beholder', name: 'Beholder Roost', type: 'auto', faction: 'dungeon', tags: ['creature', 'magic'], cost: 10,
      effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }], text: '+1 Recruit & +1 Mercury production.' },
    { id: 'for_serpent', name: 'Serpent Fly Nest', type: 'auto', faction: 'fortress', tags: ['creature', 'beast'], cost: 7,
      effects: [{ prod: { recruits: 1 } }, { gain: { gold: 3 } }], text: '+1 Recruit production. Gain 3 Gold.' },
    { id: 'con_magma', name: 'Magma Elemental Conflux', type: 'auto', faction: 'conflux', tags: ['creature', 'magic'], cost: 11,
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { ore: 1 } }], text: '+1 Recruit & +1 Ore production.' },
    { id: 'con_psychic', name: 'Magic Elemental Conflux', type: 'auto', faction: 'conflux', tags: ['creature', 'magic'], cost: 13,
      vp: 1, effects: [{ prod: { mercury: 1 } }, { draw: 1 }], text: '+1 Mercury production. Draw a card.' },
    { id: 'hero_xeron', name: 'Xeron', type: 'active', faction: 'inferno', tags: ['hero', 'might'], cost: 9,
      vp: 1, effects: [{ addAction: { desc: 'Pay 2 Mercury → gain 6 Gold', cost: { mercury: 2 }, effect: [{ gain: { gold: 6 } }] } }],
      text: 'Ability: pay 2 Mercury → gain 6 Gold.' },
  ];

  /* ----------------- HERO POOL (8 named heroes per Town) ----------- */
  // Sixteen ability "loadouts" rotated across Towns and dressed with real
  // HOMM3 hero names. Each hero is a faction-locked Power worth 1 VP.
  const A = (desc, cost, effect) => ({ addAction: { desc, cost, effect } });
  // A large, diverse pool of hero abilities — generated so EVERY hero is unique (no two share a loadout),
  // with a full family of distinct input→output production boosts. (A() = once-per-week action helper.)
  const HERO_LOADOUTS = (function () {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const RN = { gold: 'Gold', ore: 'Ore', recruits: 'Recruits', mercury: 'Mercury', wood: 'Sawmill', crystal: 'Mana Vault' };
    const PRODN = { gold: 'Gold', ore: 'Ore', recruits: 'Recruit', mercury: 'Mercury' };
    const prodTxt = k => (k === 'wood' ? '+1 Sawmill (Building cards cost 2 less)'
      : k === 'crystal' ? '+1 Mana Vault (Magic cards cost 2 less)' : '+1 ' + PRODN[k] + ' production');
    const VAL = { gold: 1, ore: 2, recruits: 2, mercury: 2.5 };
    const PAY = { gold: 5, ore: 2, recruits: 3, mercury: 2 };
    const SPEND = ['gold', 'ore', 'recruits', 'mercury'];
    const PRODS = ['gold', 'ore', 'recruits', 'mercury', 'wood', 'crystal'];
    const tagOf = { gold: 'wealth', ore: 'might', recruits: 'might', mercury: 'magic', wood: 'might', crystal: 'magic' };
    const fam = { boost: [], convert: [], passive: [], trigger: [], instant: [], draw: [], track: [], gain: [] };

    // 1) Action → boost production: pay an input → +1 of an output production (every distinct pair)
    for (const inp of SPEND) for (const out of PRODS) {
      if (inp === out) continue;
      const pay = PAY[inp];
      fam.boost.push({ tags: [tagOf[out]], cost: 9,
        text: `Action: pay ${pay} ${RN[inp]} → ${prodTxt(out)}.`,
        effects: () => [A(`Pay ${pay} ${RN[inp]} → ${prodTxt(out)}`, { [inp]: pay }, [{ prod: { [out]: 1 } }])] });
    }
    // 2) Action → convert resources: pay an input → gain a different resource (slight profit)
    for (const inp of SPEND) for (const out of SPEND) {
      if (inp === out) continue;
      const pay = PAY[inp], get = Math.max(2, Math.round(pay * VAL[inp] / VAL[out]) + 1);
      fam.convert.push({ tags: [tagOf[inp] === 'magic' ? 'magic' : 'wealth'], cost: 9,
        text: `Action: pay ${pay} ${RN[inp]} → gain ${get} ${RN[out]}.`,
        effects: () => [A(`Pay ${pay} ${RN[inp]} → gain ${get} ${RN[out]}`, { [inp]: pay }, [{ gain: { [out]: get } }])] });
    }
    // 3) Passive: flat production & production combos
    [['recruits', 2], ['gold', 1], ['ore', 1], ['mercury', 1], ['wood', 1], ['crystal', 1]].forEach(([out, n]) =>
      fam.passive.push({ tags: [tagOf[out]], cost: 9,
        text: (out === 'wood' || out === 'crystal') ? prodTxt(out) + '.' : `+${n} ${PRODN[out]} production.`,
        effects: () => [{ prod: { [out]: n } }] }));
    fam.passive.push({ tags: ['wealth'], cost: 10, text: '+1 Gold production. Gain 3 Gold.', effects: () => [{ prod: { gold: 1 } }, { gain: { gold: 3 } }] });
    fam.passive.push({ tags: ['might', 'creature'], cost: 11, text: '+1 Recruit & +1 Ore production.', effects: () => [{ prod: { recruits: 1 } }, { prod: { ore: 1 } }] });
    fam.passive.push({ tags: ['magic'], cost: 11, text: '+1 Mercury production & +1 Mana Vault.', effects: () => [{ prod: { mercury: 1 } }, { prod: { crystal: 1 } }] });
    fam.passive.push({ tags: ['might'], cost: 11, text: '+1 Recruit production & +1 Sawmill.', effects: () => [{ prod: { recruits: 1 } }, { prod: { wood: 1 } }] });
    // 4) Passive trigger: when you play a [tag] / advance a track
    [['might', 'gold', 2], ['magic', 'mercury', 1], ['creature', 'recruits', 1], ['dragon', 'gold', 3], ['beast', 'recruits', 1], ['undead', 'recruits', 1], ['building', 'gold', 1], ['wealth', 'gold', 2]].forEach(([tag, res, n]) =>
      fam.trigger.push({ tags: [(tag === 'magic' || tag === 'undead') ? 'magic' : (tag === 'wealth' || tag === 'building') ? 'wealth' : 'might'], cost: 10,
        text: `When you play a ${cap(tag)} card, gain ${n} ${RN[res]}.`,
        effects: () => [{ addTrigger: { type: 'onPlayTag', tag, effect: [{ gain: { [res]: n } }] } }] }));
    fam.trigger.push({ tags: ['magic'], cost: 9, text: 'When you advance Sorcery, gain 2 Gold.', effects: () => [{ addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { gold: 2 } }] } }] });
    fam.trigger.push({ tags: ['magic'], cost: 10, text: 'When you advance any track, draw a card.', effects: () => [{ addTrigger: { type: 'onRaiseGlobal', effect: [{ draw: 1 }] } }] });
    // 5) Instant boon + a small permanent edge
    [['gold', 8, 'recruits'], ['ore', 4, 'gold'], ['recruits', 4, 'gold'], ['mercury', 3, 'mercury'], ['gold', 6, 'ore'], ['recruits', 3, 'wood'], ['mercury', 2, 'crystal'], ['ore', 3, 'recruits'], ['gold', 5, 'mercury'], ['recruits', 5, 'gold']].forEach(([res, n, pres]) =>
      fam.instant.push({ tags: [tagOf[pres]], cost: 9,
        text: `Gain ${n} ${RN[res]}. ${prodTxt(pres)}.`,
        effects: () => [{ gain: { [res]: n } }, { prod: { [pres]: 1 } }] }));
    // 6) Action → draw cards
    [['gold', 4, 1], ['gold', 7, 2], ['mercury', 1, 2], ['mercury', 2, 2], ['ore', 3, 1], ['recruits', 3, 1]].forEach(([inp, pay, n]) =>
      fam.draw.push({ tags: ['magic'], cost: 10,
        text: `Action: pay ${pay} ${RN[inp]} → draw ${n} card${n > 1 ? 's' : ''}.`,
        effects: () => [A(`Pay ${pay} ${RN[inp]} → draw ${n}`, { [inp]: pay }, [{ draw: n }])] }));
    // 7) Action → advance a Dominion track
    [['gold', 9, 'sorcery', 'Sorcery'], ['mercury', 6, 'sorcery', 'Sorcery'], ['recruits', 4, 'frontier', 'Frontier'], ['ore', 5, 'frontier', 'Frontier'], ['gold', 10, 'realm', 'Realm'], ['recruits', 6, 'realm', 'Realm']].forEach(([inp, pay, gk, GN]) =>
      fam.track.push({ tags: [gk === 'frontier' ? 'might' : 'magic'], cost: 12,
        text: `Action: pay ${pay} ${RN[inp]} → advance ${GN}.`,
        effects: () => [A(`Pay ${pay} ${RN[inp]} → +1 ${GN}`, { [inp]: pay }, [{ global: { [gk]: 1 } }])] }));

    // 8) Pure instant boon (simple but distinct)
    [['gold', 6], ['ore', 4], ['recruits', 5], ['mercury', 3], ['gold', 9], ['recruits', 7]].forEach(([res, n]) =>
      fam.gain.push({ tags: [tagOf[res]], cost: 7, text: `Gain ${n} ${RN[res]}.`, effects: () => [{ gain: { [res]: n } }] }));

    // Interleave families round-robin so each Town's 8 heroes span many archetypes.
    const order = ['boost', 'convert', 'passive', 'trigger', 'instant', 'draw', 'track', 'gain'], pool = [];
    for (let i = 0, more = true; more; i++) {
      more = false;
      for (const fk of order) { if (fam[fk][i]) { pool.push(fam[fk][i]); more = true; } }
    }
    return pool;
  })();
  const HERO_NAMES = {
    castle:     ['Tyris', 'Rion', 'Adela', 'Cuthbert', 'Sorsha', 'Valeska', 'Edric', 'Catherine'],
    rampart:    ['Mephala', 'Ufretin', 'Jenova', 'Ryland', 'Thorgrim', 'Ivor', 'Clancy', 'Kyrre'],
    tower:      ['Fafner', 'Iona', 'Josephine', 'Neela', 'Piquedram', 'Thane', 'Aine', 'Cyra'],
    inferno:    ['Fiona', 'Marius', 'Nymus', 'Calh', 'Rashka', 'Ash', 'Calid', 'Xarfax'],
    necropolis: ['Charna', 'Clavius', 'Galthran', 'Isra', 'Moandor', 'Straker', 'Vokial', 'Vidomina'],
    dungeon:    ['Ajit', 'Arlach', 'Dace', 'Gunnar', 'Lorelei', 'Shakti', 'Alamar', 'Jeddite'],
    stronghold: ['Gurnisson', 'Jabarkas', 'Krellion', 'Kilgor', 'Yog', 'Boragus', 'Dessa', 'Saurug'],
    fortress:   ['Alkin', 'Broghild', 'Bron', 'Drakon', 'Gerwulf', 'Wystan', 'Mirlanda', 'Tiva'],
    conflux:    ['Pasis', 'Thunar', 'Ignatius', 'Octavia', 'Aenain', 'Brissa', 'Ciele', 'Erdamon'],
  };
  const HEROES_BY_FACTION = {};
  // Normalize ability text (ignore "Action:/Ability:" wording & "1 step") so generated heroes never
  // duplicate the meaning of a NAMED hero (or each other). Named heroes are already in CARDS.
  const _norm = t => String(t).toLowerCase().replace(/\b(?:action|ability):\s*/g, '').replace(/\s*1 step/g, '').replace(/[.\s]+$/g, '').trim();
  const _usedHero = new Set(CARDS.filter(c => c.tags && c.tags.includes('hero')).map(c => _norm(c.text)));
  let _heroIdx = 0; // walk the pool, skipping any loadout whose meaning is already taken
  Object.keys(HERO_NAMES).forEach((fid) => {
    HEROES_BY_FACTION[fid] = [];
    HERO_NAMES[fid].forEach((name, j) => {
      while (_heroIdx < HERO_LOADOUTS.length && _usedHero.has(_norm(HERO_LOADOUTS[_heroIdx].text))) _heroIdx++;
      const L = HERO_LOADOUTS[_heroIdx % HERO_LOADOUTS.length]; _heroIdx++;
      _usedHero.add(_norm(L.text));
      const id = 'h_' + fid + '_' + (j + 1);
      CARDS.push({ id, name, type: 'active', faction: fid, tags: ['hero'].concat(L.tags), cost: L.cost, vp: 1, effects: L.effects(), text: L.text });
      HEROES_BY_FACTION[fid].push(id);
    });
  });

  /* ===== ENGINE-DEPTH EXPANSION — extra PUBLIC cards deepening each function ===== */
  [
    /* -- Map presence: profit now + score later (gain per tile + VP per tile) -- */
    { id: 'exp_tax_assessor', name: "Tax Assessor's Hall", type: 'auto', tags: ['building', 'wealth'], cost: 9, effects: [{ gainPerTile: { tile: 'town', res: 'gold', per: 1, mult: 2 } }], vp: { perTile: { tile: 'town', per: 2 } }, text: 'Gain 2 Gold for each Town you hold. Scores 1★ per 2 Towns.' },
    { id: 'exp_mine_overseer', name: 'Mine Overseer', type: 'auto', tags: ['building'], cost: 8, effects: [{ gainPerTile: { tile: 'mine', res: 'ore', per: 1, mult: 1 } }], vp: { perTile: { tile: 'mine', per: 2 } }, text: 'Gain 1 Ore for each Mine you hold. Scores 1★ per 2 Mines.' },
    { id: 'exp_frontier_marshal', name: 'Frontier Marshal', type: 'auto', tags: ['might'], cost: 9, effects: [{ gainPerTile: { tile: 'region', res: 'gold', per: 1, mult: 2 } }], vp: { perTile: { tile: 'region', per: 2 } }, text: 'Gain 2 Gold for each Region you hold. Scores 1★ per 2 Regions.' },
    { id: 'exp_provincial_gov', name: 'Provincial Governor', type: 'auto', tags: ['building', 'wealth'], cost: 11, effects: [{ gainPerTile: { tile: 'town', res: 'recruits', per: 1, mult: 1 } }], vp: { perTile: { tile: 'town', per: 3 } }, text: 'Gain 1 Recruit for each Town you hold. Scores 1★ per 3 Towns.' },
    { id: 'exp_prospectors', name: "Prospectors' Lodge", type: 'auto', tags: ['building'], cost: 8, effects: [{ gainPerTile: { tile: 'mine', res: 'gold', per: 1, mult: 2 } }], vp: { perTile: { tile: 'mine', per: 3 } }, text: 'Gain 2 Gold for each Mine you hold. Scores 1★ per 3 Mines.' },
    { id: 'exp_border_wardens', name: 'Border Wardens', type: 'auto', tags: ['might', 'creature'], cost: 9, effects: [{ gainPerTile: { tile: 'region', res: 'recruits', per: 1, mult: 1 } }], vp: { perTile: { tile: 'region', per: 3 } }, text: 'Gain 1 Recruit for each Region you hold. Scores 1★ per 3 Regions.' },
    { id: 'exp_royal_carto', name: 'Royal Cartographer', type: 'auto', tags: ['wealth', 'magic'], cost: 10, effects: [{ gainPerTile: { tile: 'town', res: 'mercury', per: 2, mult: 1 } }], vp: { perTile: { tile: 'town', per: 2 } }, text: 'Gain 1 Mercury for every 2 Towns you hold. Scores 1★ per 2 Towns.' },
    { id: 'exp_quartermaster', name: "Quartermaster's Depot", type: 'auto', tags: ['building', 'might'], cost: 10, effects: [{ gainPerTile: { tile: 'mine', res: 'recruits', per: 1, mult: 1 } }], vp: { perTile: { tile: 'region', per: 2 } }, text: 'Gain 1 Recruit for each Mine you hold. Scores 1★ per 2 Regions.' },

    /* -- Production that scales with your tableau (production per tag) -- */
    { id: 'exp_masons', name: 'Guild of Masons', type: 'auto', tags: ['building'], cost: 11, effects: [{ prodPerTag: { tag: 'building', res: 'ore', per: 2 } }], text: '+1 Ore production for every 2 Building tags you have.' },
    { id: 'exp_war_college', name: 'War College', type: 'auto', tags: ['might'], cost: 11, effects: [{ prodPerTag: { tag: 'might', res: 'recruits', per: 2 } }], text: '+1 Recruit production for every 2 Might tags you have.' },
    { id: 'exp_conservatory', name: 'Arcane Conservatory', type: 'auto', tags: ['building', 'magic'], cost: 12, effects: [{ prodPerTag: { tag: 'magic', res: 'mercury', per: 2 } }], text: '+1 Mercury production for every 2 Magic tags you have.' },
    { id: 'exp_consortium', name: 'Merchant Consortium', type: 'auto', tags: ['building', 'wealth'], cost: 11, effects: [{ prodPerTag: { tag: 'wealth', res: 'gold', per: 2 } }], text: '+1 Gold production for every 2 Wealth tags you have.' },
    { id: 'exp_menagerie', name: 'Royal Menagerie', type: 'auto', tags: ['building', 'beast'], cost: 10, effects: [{ prodPerTag: { tag: 'beast', res: 'recruits', per: 2 } }], text: '+1 Recruit production for every 2 Beast tags you have.' },

    /* -- One-time muster scaled by your tableau (instant per tag) — Spells -- */
    { id: 'exp_parade', name: 'Triumphal Parade', type: 'event', tags: ['might'], cost: 6, effects: [{ gainPerTag: { tag: 'might', res: 'gold', per: 1 } }], text: 'Gain 1 Gold for each Might tag you have.' },
    { id: 'exp_festival_magic', name: 'Festival of Magic', type: 'event', tags: ['magic'], cost: 6, effects: [{ gainPerTag: { tag: 'magic', res: 'mercury', per: 2 } }], text: 'Gain 1 Mercury for every 2 Magic tags you have.' },
    { id: 'exp_bazaar', name: 'Grand Bazaar', type: 'event', tags: ['wealth'], cost: 6, effects: [{ gainPerTag: { tag: 'wealth', res: 'gold', per: 1 } }], text: 'Gain 1 Gold for each Wealth tag you have.' },
    { id: 'exp_warcry', name: 'Rallying War-Cry', type: 'event', tags: ['creature'], cost: 6, effects: [{ gainPerTag: { tag: 'creature', res: 'recruits', per: 2 } }], text: 'Gain 1 Recruit for every 2 Creature tags you have.' },
    { id: 'exp_levy', name: "Builders' Levy", type: 'event', tags: ['building'], cost: 6, effects: [{ gainPerTag: { tag: 'building', res: 'ore', per: 1 } }], text: 'Gain 1 Ore for each Building tag you have.' },
    { id: 'exp_restless_dead', name: 'Rite of the Restless Dead', type: 'event', tags: ['undead'], cost: 6, effects: [{ gainPerTag: { tag: 'undead', res: 'recruits', per: 1 } }], text: 'Gain 1 Recruit for each Undead tag you have.' },
    { id: 'exp_call_wild', name: 'Call of the Wild', type: 'event', tags: ['beast'], cost: 6, effects: [{ gainPerTag: { tag: 'beast', res: 'recruits', per: 1 } }], text: 'Gain 1 Recruit for each Beast tag you have.' },

    /* -- Discard salvage engines (gain when you discard) -- */
    { id: 'exp_pawnbroker', name: "Pawnbroker's Stall", type: 'auto', tags: ['wealth'], cost: 7, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { gold: 3 } }] } }], text: 'When you discard a card, gain 3 Gold.' },
    { id: 'exp_scrap', name: 'Scrap Merchant', type: 'auto', tags: ['building'], cost: 7, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { ore: 1 } }] } }], text: 'When you discard a card, gain 1 Ore.' },
    { id: 'exp_medium', name: 'Spirit Medium', type: 'auto', tags: ['magic'], cost: 8, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { mercury: 1 } }] } }], text: 'When you discard a card, gain 1 Mercury.' },
    { id: 'exp_grave_tithe', name: 'Grave Tithe', type: 'auto', tags: ['undead'], cost: 8, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { recruits: 1, gold: 1 } }] } }], text: 'When you discard a card, gain 1 Recruit and 1 Gold.' },
    { id: 'exp_ragpicker', name: "Ragpicker's Cart", type: 'auto', tags: ['wealth'], cost: 6, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { gold: 2 } }] } }], text: 'When you discard a card, gain 2 Gold.' },
    { id: 'exp_reclaimer', name: "Alchemist's Reclaimer", type: 'auto', tags: ['magic'], cost: 9, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { mercury: 1, gold: 1 } }] } }], text: 'When you discard a card, gain 1 Mercury and 1 Gold.' },
    { id: 'exp_vulture', name: 'Vulture Roost', type: 'auto', tags: ['beast'], cost: 8, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { ore: 1, recruits: 1 } }] } }], text: 'When you discard a card, gain 1 Ore and 1 Recruit.' },

    /* -- Track-driven card flow (draw when you advance a track) -- */
    { id: 'exp_carto_hall', name: "Cartographers' Hall", type: 'auto', tags: ['building'], cost: 11, effects: [{ addTrigger: { type: 'onRaiseGlobal', param: 'frontier', effect: [{ draw: 1 }] } }], text: 'When you advance Frontier, draw a card.' },
    { id: 'exp_seers', name: "Seers' Sanctum", type: 'auto', tags: ['building', 'magic'], cost: 11, effects: [{ addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ draw: 1 }] } }], text: 'When you advance Sorcery, draw a card.' },
    { id: 'exp_heralds', name: "Heralds' Court", type: 'auto', tags: ['building', 'wealth'], cost: 11, effects: [{ addTrigger: { type: 'onRaiseGlobal', param: 'realm', effect: [{ draw: 1 }] } }], text: 'When you advance Realm, draw a card.' },
    { id: 'exp_oracle', name: 'Oracle Pool', type: 'auto', tags: ['magic'], cost: 12, effects: [{ addTrigger: { type: 'onRaiseGlobal', effect: [{ draw: 1 }, { gain: { gold: 1 } }] } }], text: 'When you advance any track, draw a card and gain 1 Gold.' },
    { id: 'exp_rune_scribes', name: 'Rune Scribes', type: 'auto', tags: ['magic'], cost: 12, effects: [{ addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ draw: 1 }, { gain: { mercury: 1 } }] } }], text: 'When you advance Sorcery, draw a card and gain 1 Mercury.' },

    /* -- Discard hoards that score (stockpile a counter when you discard) -- */
    { id: 'exp_reliquary', name: 'Reliquary Vault', type: 'auto', tags: ['building'], cost: 12, vp: { perStore: 2 }, effects: [{ gain: { gold: 3 } }, { addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }], text: 'Gain 3 Gold. When you discard a card, store a Relic here. Scores 1★ per 2 Relics.' },
    { id: 'exp_ossuary', name: 'The Ossuary', type: 'auto', tags: ['undead'], cost: 11, vp: { perStore: 3 }, effects: [{ prod: { recruits: 1 } }, { addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }], text: '+1 Recruit production. When you discard a card, inter a Bone here. Scores 1★ per 3 Bones.' },
    { id: 'exp_trophy_hall', name: 'Hall of Trophies', type: 'auto', tags: ['might'], cost: 11, vp: { perStore: 2 }, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ store: 1 }, { gain: { gold: 1 } }] } }], text: 'When you discard a card, mount a Trophy here and gain 1 Gold. Scores 1★ per 2 Trophies.' },
    { id: 'exp_cauldron', name: "Witch's Cauldron", type: 'auto', tags: ['magic'], cost: 11, vp: { perStore: 2 }, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ store: 1 }, { gain: { mercury: 1 } }] } }], text: 'When you discard a card, brew a Potion here and gain 1 Mercury. Scores 1★ per 2 Potions.' },
    { id: 'exp_cabinet', name: "Collector's Cabinet", type: 'auto', tags: ['wealth'], cost: 12, vp: { perStore: 2 }, effects: [{ draw: 1 }, { addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }], text: 'Draw a card. When you discard a card, store a Curio here. Scores 1★ per 2 Curios.' },
    { id: 'exp_memorial', name: 'Memorial Crypt', type: 'auto', tags: ['undead'], cost: 10, vp: { perStore: 2 }, effects: [{ addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }], text: 'When you discard a card, inter a Soul here. Scores 1★ per 2 Souls.' },
    { id: 'exp_dragon_bones', name: 'Dragon-Bone Pile', type: 'auto', tags: ['dragon'], cost: 12, vp: { perStore: 2 }, effects: [{ prod: { recruits: 1 } }, { addTrigger: { type: 'onDiscard', effect: [{ store: 1 }] } }], text: '+1 Recruit production. When you discard a card, add a Dragon Bone here. Scores 1★ per 2 Bones.' },

    /* -- Lumber industry (raise Sawmill) -- */
    { id: 'exp_lumber_mill', name: 'Lumber Mill', type: 'auto', tags: ['building'], cost: 7, effects: [{ prod: { wood: 1 } }, { gain: { gold: 3 } }], text: '+1 Sawmill (Building cards cost 2 less). Gain 3 Gold.' },
    { id: 'exp_carpenters', name: "Carpenters' Guild", type: 'auto', tags: ['building'], cost: 8, effects: [{ prod: { wood: 1 } }, { draw: 1 }], text: '+1 Sawmill (Building cards cost 2 less). Draw a card.' },
    { id: 'exp_timberyard', name: 'Timberyard', type: 'auto', tags: ['building'], cost: 8, effects: [{ prod: { wood: 1 } }, { gain: { ore: 2 } }], text: '+1 Sawmill (Building cards cost 2 less). Gain 2 Ore.' },
    { id: 'exp_master_builder', name: "Master Builder's Lodge", type: 'auto', tags: ['building'], cost: 10, vp: 1, effects: [{ prod: { wood: 1 } }, { prod: { gold: 1 } }], text: '+1 Sawmill (Building cards cost 2 less) & +1 Gold production. (1 VP)' },

    /* -- Ore industry (increase Ore production) -- */
    { id: 'exp_deep_mine', name: 'Deep Mine Shaft', type: 'auto', tags: ['building'], cost: 7, effects: [{ prod: { ore: 1 } }, { gain: { ore: 2 } }], text: '+1 Ore production. Gain 2 Ore.' },
    { id: 'exp_foundry', name: 'Great Foundry', type: 'auto', tags: ['building'], cost: 12, req: { tags: { building: 2 } }, vp: 1, effects: [{ prod: { ore: 2 } }], text: 'Requires 2 Building tags. +2 Ore production. (1 VP)' },
  ].forEach(c => CARDS.push(c));

  /* ----------------- TOWN-SIGNATURE CARD LISTS ---------------------- */
  // Public deck = every card NOT listed here. Each Town also draws from its
  // own signature deck (these cards never reach another Town).
  const FACTION_CARDS = {
    castle:     ['angel_spire', 'cavalier_stable', 'hero_mullich', 'cas_crusaders', 'cas_monastery', ...HEROES_BY_FACTION.castle],
    rampart:    ['green_dragon_glade', 'gold_dragon_vault', 'dendroid_arches', 'pegasus_glade', 'ram_unicorn', 'hero_gelu', ...HEROES_BY_FACTION.rampart],
    tower:      ['titan_hall', 'naga_bank', 'genie_lamp', 'wizards_academy', 'hero_solmyr', 'tow_golem', ...HEROES_BY_FACTION.tower],
    inferno:    ['devils_gate', 'efreet_cells', 'pit_fiend_pit', 'imp_crucible', 'hero_xeron', ...HEROES_BY_FACTION.inferno],
    necropolis: ['vampire_mansion', 'lich_tower', 'dread_knight_crypt', 'bone_dragon_crypt', 'hero_sandro', 'necromancy_amp', ...HEROES_BY_FACTION.necropolis],
    dungeon:    ['black_dragon_cave', 'red_dragon_cave', 'medusa_lair', 'minotaur_maze', 'hero_mutare', 'dun_beholder', ...HEROES_BY_FACTION.dungeon],
    stronghold: ['behemoth_lair', 'cyclops_cave', 'ogre_fort', 'wolf_pickets', 'hero_crag_hack', 'thunderbird_aerie', ...HEROES_BY_FACTION.stronghold],
    fortress:   ['hydra_pond', 'gorgon_lair', 'basilisk_pit', 'wyvern_nest', 'hero_tazar', 'for_serpent', ...HEROES_BY_FACTION.fortress],
    conflux:    ['phoenix_roost', 'storm_conflux', 'hero_luna', 'con_magma', 'con_psychic', ...HEROES_BY_FACTION.conflux],
  };
  // reverse lookup: card id -> owning town (or undefined for public cards)
  const CARD_FACTION = {};
  for (const fid in FACTION_CARDS) for (const cid of FACTION_CARDS[fid]) CARD_FACTION[cid] = fid;

  /* ----------------------- DEEDS (milestones) ----------------------- */
  // Claim during play for 8 Gold (max 3 in a game). Worth 5 VP at the end.
  const MILESTONES = [
    { id: 'm_builder', name: 'Master Builder', desc: 'Have 8+ Building tags in play.',
      check: (e, p) => e.tagCount(p, 'building') >= 8 },
    { id: 'm_archmage', name: 'Archmage', desc: 'Have 5+ Magic tags in play.',
      check: (e, p) => e.tagCount(p, 'magic') >= 5 },
    { id: 'm_warlord', name: 'Warlord', desc: 'Have 8+ Creature tags in play.',
      check: (e, p) => e.tagCount(p, 'creature') >= 8 },
    { id: 'm_conqueror', name: 'Conqueror', desc: 'Reach Renown 28 (advance the tracks 8 times).',
      check: (e, p) => p.renown >= 28 },
    { id: 'm_magnate', name: 'Magnate', desc: 'Have Gold production of 12 or more.',
      check: (e, p) => p.prod.gold >= 12 },
    { id: 'm_pathfinder', name: 'Pathfinder', desc: 'Reach Frontier 6 (chart the wild map).',
      check: (e, p) => e.params.frontier >= 6 },
  ];

  /* ------------------------ HONORS (awards) ------------------------- */
  // Fund during play (8 / 14 / 20 Gold, max 3). End: leader +5 VP, runner-up +2.
  const AWARDS = [
    { id: 'a_landlord', name: 'Lord of the Land', desc: 'Most tiles (Towns + Mines + Regions).',
      score: (e, p) => p.tiles.town + p.tiles.mine + p.tiles.region },
    { id: 'a_banker', name: 'Treasurer', desc: 'Highest Gold production.',
      score: (e, p) => p.prod.gold },
    { id: 'a_magus', name: 'Grand Mage', desc: 'Most Magic tags.',
      score: (e, p) => e.tagCount(p, 'magic') },
    { id: 'a_general', name: 'Field Marshal', desc: 'Most Creature tags.',
      score: (e, p) => e.tagCount(p, 'creature') },
    { id: 'a_collector', name: 'Master of the Realm', desc: 'Most cards in play.',
      score: (e, p) => p.tableau.length },
  ];

  /* ------------- ASTROLOGERS' PROCLAMATIONS (weekly) --------------- */
  // "Astrologers proclaim the Week of the ..." Symmetric, applied to BOTH
  // lords at the start of each week. Pure flavour + small even-handed boons.
  const PROCLAMATIONS = [
    { name: 'Week of the Squirrel', text: 'All is quiet across Erathia.', effect: [] },
    { name: 'Week of the Magpie', text: 'Coffers swell — each lord gains 3 Gold.', effect: [{ gain: { gold: 3 } }] },
    { name: 'Week of the Griffin', text: 'The dwellings teem — each lord gains 2 Recruits.', effect: [{ gain: { recruits: 2 } }] },
    { name: 'Week of the Dwarf', text: 'The mines run rich — each lord gains 2 Ore.', effect: [{ gain: { ore: 2 } }] },
    { name: 'Week of the Dendroid', text: 'The forests give freely — each lord’s Sawmill grows (Building cards cost 2 less).', effect: [{ prod: { wood: 1 } }] },
    { name: 'Week of the Unicorn', text: 'Crystal sap flows — each lord’s Mana Vault grows (Magic cards cost 2 less).', effect: [{ prod: { crystal: 1 } }] },
    { name: 'Week of the Genie', text: 'Quicksilver mists rise — each lord gains 2 Mercury.', effect: [{ gain: { mercury: 2 } }] },
    { name: 'Conjunction of the Spheres', text: 'Far visions abound — each lord draws a card.', effect: [{ draw: 1 }] },
    { name: 'Week of the Salamander', text: 'The forges blaze — each lord gains 3 Gold and 1 Ore.', effect: [{ gain: { gold: 3, ore: 1 } }] },
    { name: 'Week of the Eagle', text: 'Scouts range far — each lord gains 2 Gold.', effect: [{ gain: { gold: 2 } }] },
    { name: 'Week of the Serpent', text: 'Trade thrives — each lord gains 4 Gold.', effect: [{ gain: { gold: 4 } }] },
    { name: 'Week of the Dragon', text: 'Ancient power stirs — each lord’s Mana Vault grows and they gain 1 Mercury.', effect: [{ prod: { crystal: 1 } }, { gain: { mercury: 1 } }] },
    { name: 'Week of the Phoenix', text: 'Embers of magic drift down — each lord gains 1 Mercury and 2 Gold.', effect: [{ gain: { mercury: 1, gold: 2 } }] },
  ];

  /* --------------------- SECRET OBJECTIVES ------------------------- */
  // Each lord drafts ONE at the start, kept hidden. Worth bonus Glory if met
  // at game end.
  const SECRET_GOALS = [
    { id: 'sg_dragonlord', name: 'Dragonlord', desc: 'Field 3+ Dragon tags.', vp: 6, check: (e, p) => e.tagCount(p, 'dragon') >= 3 },
    { id: 'sg_necromancer', name: 'Necromancer', desc: 'Field 6+ Undead tags.', vp: 6, check: (e, p) => e.tagCount(p, 'undead') >= 6 },
    { id: 'sg_mason', name: 'Master Mason', desc: 'Field 10+ Building tags.', vp: 6, check: (e, p) => e.tagCount(p, 'building') >= 10 },
    { id: 'sg_archmage', name: 'Grand Sorcerer', desc: 'Reach Sorcery 12.', vp: 6, check: (e, p) => e.params.sorcery >= 12 },
    { id: 'sg_warlord', name: 'Horde Master', desc: 'Field 12+ Creature tags.', vp: 6, check: (e, p) => e.tagCount(p, 'creature') >= 12 },
    { id: 'sg_baron', name: 'Land Baron', desc: 'Hold 6+ tiles on the map.', vp: 6, check: (e, p) => (p.tiles.town + p.tiles.mine + p.tiles.region) >= 6 },
    { id: 'sg_tycoon', name: 'Tycoon', desc: 'Reach 16+ Gold production.', vp: 6, check: (e, p) => p.prod.gold >= 16 },
    { id: 'sg_explorer', name: 'Pathfinder', desc: 'Reach Frontier 8.', vp: 6, check: (e, p) => e.params.frontier >= 8 },
    { id: 'sg_emperor', name: 'Emperor', desc: 'Reach Realm 12.', vp: 6, check: (e, p) => e.params.realm >= 12 },
    { id: 'sg_beastmaster', name: 'Beastmaster', desc: 'Field 5+ Beast tags.', vp: 6, check: (e, p) => e.tagCount(p, 'beast') >= 5 },
    { id: 'sg_hoarder', name: 'Hoarder', desc: 'End with 30+ total resources.', vp: 6, check: (e, p) => RES.reduce((s, k) => s + p.res[k], 0) >= 30 },
    { id: 'sg_collector', name: 'Collector', desc: 'Have 16+ cards in play.', vp: 6, check: (e, p) => p.tableau.length >= 16 },
  ];

  /* --------------------- THE ADVENTURE MAP ------------------------- */
  // A single shared hex map. Founding Towns, flagging Mines and clearing
  // Regions place tiles on chosen hexes; hexes grant resource bonuses and
  // adjacency scores Glory at the end.
  const MAP = {
    radius: 3, // hexagon of "rings" -> 37 hexes
    // weighted one-time placement bonuses (null = empty hex). Effect-ops form.
    bonusPool: [null, null, null, null, null, { gain: { gold: 4 } }, { gain: { ore: 2 } }, { gain: { ore: 2 } }, { gain: { mercury: 1 } }, { gain: { mercury: 2 } }, { gain: { recruits: 2 } }, { draw: 1 }],
    // weighted mines: flag one here for +1 production of that resource (else +1 Gold)
    minePool: [null, null, null, null, null, null, 'gold', 'ore', 'wood', 'crystal', 'mercury'],
    terrains: ['grass', 'snow', 'swamp', 'rough', 'lava', 'sand', 'dirt'],
  };
  const TERRAIN_COLORS = {
    grass: '#3f6f33', snow: '#b8cedb', swamp: '#3f5740', rough: '#6f5f3f',
    lava: '#5f342b', sand: '#bda268', dirt: '#5c4a30', water: '#2f5f7a',
  };
  const TILE_INFO = {
    town:   { name: 'Town',   icon: '🏰' },
    mine:   { name: 'Mine',   icon: '⛏️' },
    region: { name: 'Region', icon: '🚩' },
  };

  /* ----------------------------- WONDERS --------------------------- */
  // Each Town can race to raise a unique 3-stage Wonder. Build stages in order
  // (each is a turn action with its own cost + requirement and an immediate
  // reward). Completing the final stage grants WONDER_VP (identical for every
  // Wonder) and a signature passive — and ENDS the game: once any Wonder is
  // finished, the current week is the last (the game ends after both pass).
  const WONDER_VP = 12;
  const WONDERS = {
    castle: {
      name: 'The Grand Cathedral', blurb: 'A cathedral of light to crown Erathia.',
      stages: [
        { name: 'Lay the Foundation', cost: { gold: 8, ore: 4 }, req: { realmMin: 2 }, desc: '+1 Recruit production; gain 4 Gold.', reward: [{ prod: { recruits: 1 } }, { gain: { gold: 4 } }] },
        { name: 'Raise the Nave', cost: { gold: 14, ore: 6 }, req: { realmMin: 5, tags: { building: 3 } }, desc: '+2 Gold production.', reward: [{ prod: { gold: 2 } }] },
        { name: 'Crown the Spire', cost: { gold: 20, ore: 8, mercury: 2 }, req: { realmMin: 8 }, desc: 'Advance Realm. Forever: playing a Building gains 2 Gold.', reward: [{ global: { realm: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'building', effect: [{ gain: { gold: 2 } }] } }] },
      ],
    },
    rampart: {
      name: 'The World Tree', blurb: 'The eternal Mother Tree of AvLee.',
      stages: [
        { name: 'Plant the Seed', cost: { gold: 8, ore: 5 }, req: { tags: { creature: 2 }, prod: { wood: 1 } }, desc: 'Needs Sawmill 1. +1 Sawmill (Building cards cost 2 less); gain 3 Recruits.', reward: [{ prod: { wood: 1 } }, { gain: { recruits: 3 } }] },
        { name: 'Spread the Roots', cost: { gold: 12, ore: 8 }, req: { frontierMin: 2, prod: { wood: 2 } }, desc: 'Needs Sawmill 2. +1 Recruit & +1 Mercury production.', reward: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }] },
        { name: 'Unfurl the Canopy', cost: { gold: 18, ore: 10, mercury: 2 }, req: { tags: { creature: 5 }, prod: { wood: 3 } }, desc: 'Needs Sawmill 3. +1 Sawmill (Building cards cost 2 less). Forever: playing a Creature gains 1 Recruit.', reward: [{ prod: { wood: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'creature', effect: [{ gain: { recruits: 1 } }] } }] },
      ],
    },
    tower: {
      name: 'The Celestial Observatory', blurb: 'A spire to read the stars and the weave.',
      stages: [
        { name: 'Found the Vault', cost: { gold: 8, mercury: 2 }, req: { sorceryMin: 2, prod: { crystal: 1 } }, desc: 'Needs Mana Vault 1. +1 Mercury production; draw a card.', reward: [{ prod: { mercury: 1 } }, { draw: 1 }] },
        { name: 'Mount the Lens', cost: { gold: 14, mercury: 3 }, req: { tags: { magic: 3 }, prod: { crystal: 2 } }, desc: 'Needs Mana Vault 2. +1 Mana Vault (Magic cards cost 2 less).', reward: [{ prod: { crystal: 1 } }] },
        { name: 'Open the Eye', cost: { gold: 20, mercury: 8 }, req: { sorceryMin: 8, prod: { crystal: 3 } }, desc: 'Needs Mana Vault 3. Advance Sorcery. Forever: playing a Magic card gains 2 Mercury.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { mercury: 2 } }] } }] },
      ],
    },
    inferno: {
      name: 'The Gate of Eeofol', blurb: 'A rift torn open to the inferno below.',
      stages: [
        { name: 'Breach the Crust', cost: { gold: 8, mercury: 3 }, req: { sorceryMin: 2 }, desc: 'Gain 6 Gold; +1 Mercury production.', reward: [{ gain: { gold: 6 } }, { prod: { mercury: 1 } }] },
        { name: 'Summon the Legions', cost: { gold: 12, mercury: 5 }, req: { tags: { creature: 3 } }, desc: '+2 Recruit production.', reward: [{ prod: { recruits: 2 } }] },
        { name: 'Widen the Rift', cost: { gold: 18, mercury: 6, ore: 4 }, req: { sorceryMin: 7 }, desc: 'Advance Sorcery. Forever: advancing Sorcery gains 3 Gold.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { gold: 3 } }] } }] },
      ],
    },
    necropolis: {
      name: 'The Pyramid of the Lich Kings', blurb: 'A tomb-engine that turns death into armies.',
      stages: [
        { name: 'Sink the Crypt', cost: { gold: 8, ore: 5 }, req: { tags: { undead: 1 } }, desc: '+1 Recruit production; gain 3 Recruits.', reward: [{ prod: { recruits: 1 } }, { gain: { recruits: 3 } }] },
        { name: 'Bind the Souls', cost: { gold: 12, ore: 7 }, req: { tags: { undead: 2 } }, desc: 'Forever: discarding a card gains 1 Recruit.', reward: [{ addTrigger: { type: 'onDiscard', effect: [{ gain: { recruits: 1 } }] } }] },
        { name: 'Seal the Apex', cost: { gold: 18, ore: 9, mercury: 3 }, req: { tags: { undead: 3 } }, desc: '+2 Recruit production. Forever: playing an Undead gains 2 Mercury.', reward: [{ prod: { recruits: 2 } }, { addTrigger: { type: 'onPlayTag', tag: 'undead', effect: [{ gain: { mercury: 2 } }] } }] },
      ],
    },
    dungeon: {
      name: 'The Dragon Spire', blurb: 'A black obelisk where dragons roost.',
      stages: [
        { name: 'Carve the Hollow', cost: { gold: 8, mercury: 2 }, req: { sorceryMin: 3 }, desc: '+1 Mana Vault (Magic cards cost 2 less).', reward: [{ prod: { crystal: 1 } }] },
        { name: 'Lure the Wyrms', cost: { gold: 14, mercury: 3 }, req: { tags: { dragon: 1 } }, desc: '+2 Recruit production; gain 2 Mercury.', reward: [{ prod: { recruits: 2 } }, { gain: { mercury: 2 } }] },
        { name: 'Wake the Ancients', cost: { gold: 20, mercury: 5 }, req: { tags: { dragon: 2 } }, desc: 'Advance Sorcery. Forever: playing a Dragon gains 4 Gold.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'dragon', effect: [{ gain: { gold: 4 } }] } }] },
      ],
    },
    stronghold: {
      name: 'The Hall of Valhalla', blurb: 'A mead-hall for the mightiest warlords.',
      stages: [
        { name: 'Raise the Pillars', cost: { gold: 8, ore: 5 }, req: { tags: { might: 2 } }, desc: '+2 Recruit production.', reward: [{ prod: { recruits: 2 } }] },
        { name: 'Forge the Throne', cost: { gold: 12, ore: 8 }, req: { tags: { creature: 3 } }, desc: '+1 Gold production; gain 3 Ore.', reward: [{ prod: { gold: 1 } }, { gain: { ore: 3 } }] },
        { name: 'Light the Eternal Fire', cost: { gold: 16, ore: 10 }, req: { tags: { might: 5 } }, desc: '+2 Recruit production. Forever: playing a Might card gains 3 Gold.', reward: [{ prod: { recruits: 2 } }, { addTrigger: { type: 'onPlayTag', tag: 'might', effect: [{ gain: { gold: 3 } }] } }] },
      ],
    },
    fortress: {
      name: 'The Bastion of the Bog', blurb: 'A half-sunk fortress bred for monsters.',
      stages: [
        { name: 'Drain the Mire', cost: { gold: 8, ore: 7 }, req: { tags: { beast: 2 } }, desc: '+1 Recruit & +1 Ore production.', reward: [{ prod: { recruits: 1 } }, { prod: { ore: 1 } }] },
        { name: 'Raise the Ramparts', cost: { gold: 12, ore: 6 }, req: { frontierMin: 3 }, desc: '+2 Recruit production.', reward: [{ prod: { recruits: 2 } }] },
        { name: 'Flood the Breeding Pits', cost: { gold: 16, ore: 8, mercury: 2 }, req: { tags: { beast: 4 } }, desc: '+1 Gold production. Forever: playing a Beast gains 2 Recruits.', reward: [{ prod: { gold: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'beast', effect: [{ gain: { recruits: 2 } }] } }] },
      ],
    },
    conflux: {
      name: 'The Eye of the Magi', blurb: 'A vortex where the four elements meet.',
      stages: [
        { name: 'Anchor the Vortex', cost: { gold: 8, mercury: 3 }, req: { sorceryMin: 2 }, desc: '+1 Mercury production; draw a card.', reward: [{ prod: { mercury: 1 } }, { draw: 1 }] },
        { name: 'Align the Planes', cost: { gold: 12, mercury: 5 }, req: { tags: { magic: 3 } }, desc: '+1 Mana Vault (Magic cards cost 2 less) & +1 Mercury production.', reward: [{ prod: { crystal: 1 } }, { prod: { mercury: 1 } }] },
        { name: 'Ignite the Conflux', cost: { gold: 18, mercury: 6 }, req: { sorceryMin: 6 }, desc: 'Advance Sorcery. Forever: advancing Sorcery draws a card and gains 2 Mercury.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ draw: 1 }, { gain: { mercury: 2 } }] } }] },
      ],
    },
  };
  FACTIONS.forEach(f => { f.wonder = WONDERS[f.id]; });

  /* --------------------------- ADVENTURES -------------------------- */
  // A shared, face-up board of Quests. On your turn you complete one outright:
  // meet its "have" requirement (tags/tracks you already hold — nothing spent)
  // and pay its cost, then take the reward (and any permanent Saga). The board
  // then refills. Costs lean hard on Ore (war effort) and Mercury (reagents) —
  // the engaging sink those resources were missing.
  const QUEST_BOARD_SIZE = 3;
  const QUEST_TYPES = { combat: '⚔️', arcane: '🔮', wealth: '👑', explore: '🧭', industry: '⚒️' };
  const QUESTS = [
    { id: 'q_cyclops', name: 'Clear the Cyclops Stockade', type: 'combat', req: { tags: { creature: 2 } }, cost: { ore: 4, recruits: 4 }, reward: [{ gain: { gold: 8 } }, { global: { frontier: 1 } }], text: 'Gain 8 Gold; advance Frontier.' },
    { id: 'q_wyverns', name: 'Slay the Wandering Wyverns', type: 'combat', cost: { ore: 3 }, reward: [{ gain: { gold: 6, recruits: 2 } }], text: 'Gain 6 Gold and 2 Recruits.' },
    { id: 'q_sword', name: 'Recover the Sword of Hellfire', type: 'arcane', req: { tags: { magic: 2 } }, cost: { mercury: 4 }, reward: [{ vpNow: 1 }, { addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { gold: 2 } }] } }], text: '1★. SAGA: when you play a Magic card, gain 2 Gold.' },
    { id: 'q_caravan', name: 'Rescue the Merchant Caravan', type: 'wealth', cost: { gold: 6 }, reward: [{ prod: { gold: 2 } }], text: '+2 Gold production.' },
    { id: 'q_steadwick', name: 'Defend Steadwick', type: 'combat', req: { tags: { might: 3 } }, cost: { ore: 5, recruits: 6 }, reward: [{ vpNow: 3 }, { gain: { mercury: 2 } }], text: '3★ and gain 2 Mercury.' },
    { id: 'q_manacryst', name: 'Tame the Mana Crystals', type: 'arcane', req: { prod: { crystal: 1 } }, cost: { mercury: 5 }, reward: [{ prod: { crystal: 1 } }], text: 'Needs Mana Vault 1+. +1 Mana Vault — your Magic cards cost 2 Gold less.' },
    { id: 'q_warmachines', name: 'Forge the War Machines', type: 'industry', cost: { ore: 6 }, reward: [{ gain: { recruits: 3 } }, { prod: { recruits: 1 } }], text: 'Gain 3 Recruits; +1 Recruit production.' },
    { id: 'q_wastes', name: 'Map the Northern Wastes', type: 'explore', req: { frontierMin: 2 }, cost: { mercury: 3, ore: 2 }, reward: [{ global: { frontier: 1 } }, { draw: 2 }], text: 'Advance Frontier; draw 2 cards.' },
    { id: 'q_merc', name: 'Hire the Sellswords', type: 'wealth', cost: { gold: 5 }, reward: [{ gain: { recruits: 5 } }], text: 'Gain 5 Recruits.' },
    { id: 'q_hoard', name: 'Plunder the Dragon Hoard', type: 'arcane', req: { sorceryMin: 4 }, cost: { mercury: 4 }, reward: [{ vpNow: 2 }, { gain: { mercury: 3, gold: 6 } }], text: '2★; gain 3 Mercury and 6 Gold.' },
    { id: 'q_traderoad', name: 'Build the Trade Road', type: 'wealth', req: { prod: { wood: 1 } }, cost: { ore: 4 }, reward: [{ prod: { gold: 1 } }, { prod: { wood: 1 } }], text: 'Needs Sawmill 1+. +1 Gold production & +1 Sawmill (Building cards cost 2 less).' },
    { id: 'q_elementals', name: 'Commune with the Elementals', type: 'arcane', cost: { mercury: 6 }, reward: [{ global: { sorcery: 1 } }], text: 'Advance Sorcery (+Renown).' },
    { id: 'q_undead', name: 'Quell the Undead Uprising', type: 'combat', cost: { ore: 5, mercury: 3 }, reward: [{ vpNow: 2 }, { gain: { gold: 8 } }], text: '2★ and gain 8 Gold.' },
    { id: 'q_obelisk', name: 'Decipher the Obelisks', type: 'explore', req: { frontierMin: 3 }, cost: { mercury: 5 }, reward: [{ vpNow: 1 }, { addTrigger: { type: 'onRaiseGlobal', effect: [{ gain: { gold: 2 } }] } }], text: '1★. SAGA: when you advance any track, gain 2 Gold.' },
    { id: 'q_conservancy', name: 'The Griffin Conservancy', type: 'combat', req: { tags: { beast: 2 } }, cost: { ore: 4 }, reward: [{ addTrigger: { type: 'onPlayTag', tag: 'creature', effect: [{ gain: { recruits: 1 } }] } }], text: 'SAGA: when you play a Creature, gain 1 Recruit.' },
    { id: 'q_excavate', name: 'Excavate the Ancient Mine', type: 'industry', cost: { mercury: 4 }, reward: [{ prod: { crystal: 1 } }, { gain: { ore: 2 } }], text: '+1 Mana Vault (Magic cards cost 2 less); gain 2 Ore.' },
  ];

  const API = {
    RES, RES_INFO, T, TAG_INFO, GLOBALS, FACTIONS, CARDS, MILESTONES, AWARDS, PROCLAMATIONS,
    FACTION_CARDS, CARD_FACTION, SECRET_GOALS, MAP, TERRAIN_COLORS, TILE_INFO, WONDERS, WONDER_VP,
    QUESTS, QUEST_BOARD_SIZE, QUEST_TYPES,
    cardById: id => CARDS.find(c => c.id === id),
    factionById: id => FACTIONS.find(f => f.id === id),
    goalById: id => SECRET_GOALS.find(g => g.id === id),
    questById: id => QUESTS.find(q => q.id === id),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.HK = Object.assign(global.HK || {}, { data: API });
})(typeof window !== 'undefined' ? window : globalThis);
