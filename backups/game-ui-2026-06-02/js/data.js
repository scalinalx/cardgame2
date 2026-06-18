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
      desc: 'Start: 40 Gold, 3 Wood, +1 Wood & +1 Recruit production. Mustering a Town costs only 6 Recruits.',
      start: { res: { gold: 40, wood: 3 }, prod: { wood: 1, recruits: 1 } }, settlementCost: 6,
    },
    {
      id: 'tower', name: 'Tower', align: 'good',
      blurb: 'Wizards of Bracada, Genies, Nagas and Titans.',
      desc: 'Start: 40 Gold, 3 Mercury, +1 Crystal production. Magic cards cost 3 Gold less. Ability: pay 1 Mercury → draw a card.',
      start: { res: { gold: 40, mercury: 3 }, prod: { crystal: 1 } }, discounts: { magic: 3 },
      action: { desc: 'Pay 1 Mercury → draw a card', cost: { mercury: 1 }, effect: [{ draw: 1 }] },
    },
    {
      id: 'inferno', name: 'Inferno', align: 'evil',
      blurb: 'Imps, Pit Fiends, Efreeti and the Devils of Eeofol.',
      desc: 'Start: 43 Gold, +1 Mercury production. Whenever you advance Sorcery, gain 2 Gold.',
      start: { res: { gold: 43 }, prod: { mercury: 1 } },
      triggers: [{ type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { gold: 2 } }] }],
    },
    {
      id: 'necropolis', name: 'Necropolis', align: 'evil',
      blurb: 'Skeletons, Vampires, Liches and Dread Knights — death given purpose.',
      desc: 'Start: 38 Gold, 4 Recruits, +1 Recruit production. Necromancy: whenever you discard a card, gain 1 Recruit.',
      start: { res: { gold: 38, recruits: 4 }, prod: { recruits: 1 } },
      triggers: [{ type: 'onDiscard', effect: [{ gain: { recruits: 1 } }] }],
    },
    {
      id: 'dungeon', name: 'Dungeon', align: 'evil',
      blurb: 'Warlocks of Nighon, Beholders, Manticores and Black Dragons.',
      desc: 'Start: 44 Gold, 2 Crystal. Dragon & Creature cards cost 3 Gold less. Ability: pay 4 Gold → gain 1 Mercury.',
      start: { res: { gold: 44, crystal: 2 } }, discounts: { dragon: 3, creature: 3 },
      action: { desc: 'Pay 4 Gold → gain 1 Mercury', cost: { gold: 4 }, effect: [{ gain: { mercury: 1 } }] },
    },
    {
      id: 'stronghold', name: 'Stronghold', align: 'evil',
      blurb: 'Goblins, Cyclopes and Behemoths of Krewlod — strength above all.',
      desc: 'Start: 46 Gold, +1 Ore production. Creature cards cost 2 Gold less. When you play a Might card, gain 3 Gold.',
      start: { res: { gold: 46 }, prod: { ore: 1 } }, discounts: { creature: 2 },
      triggers: [{ type: 'onPlayTag', tag: 'might', effect: [{ gain: { gold: 3 } }] }],
    },
    {
      id: 'fortress', name: 'Fortress', align: 'good',
      blurb: 'Gnolls, Basilisks, Gorgons and Hydras of the Tatalian swamps.',
      desc: 'Start: 42 Gold, +1 Ore & +1 Recruit production. Beast cards cost 3 Gold less; playing a Beast gains 1 Recruit.',
      start: { res: { gold: 42 }, prod: { ore: 1, recruits: 1 } }, discounts: { beast: 3 },
      triggers: [{ type: 'onPlayTag', tag: 'beast', effect: [{ gain: { recruits: 1 } }] }],
    },
    {
      id: 'conflux', name: 'Conflux', align: 'good',
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
      effects: [{ prod: { wood: 1 } }], text: '+1 Wood production.' },
    { id: 'ore_pit', name: 'Ore Pit', type: 'auto', tags: ['building'], cost: 5,
      effects: [{ prod: { ore: 1 } }], text: '+1 Ore production.' },
    { id: 'alchemist_lab', name: "Alchemist's Lab", type: 'auto', tags: ['building', 'magic'], cost: 8,
      effects: [{ prod: { mercury: 1 } }, { gain: { gold: 2 } }], text: '+1 Mercury production. Gain 2 Gold.' },
    { id: 'crystal_cavern', name: 'Crystal Cavern', type: 'auto', tags: ['building', 'magic'], cost: 12,
      req: { sorceryMin: 3 }, vp: 1, effects: [{ prod: { crystal: 1 } }, { gain: { crystal: 1 } }],
      text: 'Requires Sorcery 3+. +1 Crystal production. Gain 1 Crystal.' },
    { id: 'mystic_pond', name: 'Mystic Pond', type: 'auto', tags: ['building', 'magic'], cost: 7,
      effects: [{ prod: { crystal: 1 } }], text: '+1 Crystal production.' },
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
      effects: [{ gain: { wood: 2, ore: 2 } }], text: 'Gain 2 Wood and 2 Ore.' },
    { id: 'mage_guild', name: 'Mage Guild', type: 'auto', tags: ['building', 'magic'], cost: 9,
      effects: [{ prod: { mercury: 1 } }, { draw: 1 }], text: '+1 Mercury production. Draw a card.' },
    { id: 'great_library', name: 'Great Library', type: 'active', tags: ['building', 'magic'], cost: 13,
      vp: 1, effects: [{ addTrigger: { type: 'onRaiseGlobal', effect: [{ draw: 1 }] } }],
      text: 'When you advance any Dominion track, draw a card.' },
    { id: 'wizards_academy', name: 'Wizards Academy', type: 'auto', tags: ['building', 'magic'], cost: 17,
      req: { tags: { magic: 2 } }, vp: 1, effects: [{ prod: { mercury: 1 } }, { gainPerTag: { tag: 'magic', res: 'crystal', per: 2 } }],
      text: 'Requires 2 Magic tags. +1 Mercury production. Gain 1 Crystal per 2 Magic tags.' },
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
      effects: [{ prod: { recruits: 1 } }, { gain: { wood: 1 } }], text: '+1 Recruit production. Gain 1 Wood.' },
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
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { wood: 1 } }], text: '+1 Recruit & +1 Wood production.' },
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
      vp: 1, effects: [{ prod: { recruits: 1 } }, { prod: { crystal: 1 } }], text: '+1 Recruit & +1 Crystal production.' },
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
      text: 'Requires Sorcery 7+. +2 Recruit & +1 Crystal production. (3 VP)' },
    { id: 'devils_gate', name: "Devil's Gate", type: 'auto', tags: ['creature'], cost: 20,
      req: { sorceryMin: 6 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { gain: { gold: 4 } }],
      text: 'Requires Sorcery 6+. +2 Recruit production. Gain 4 Gold. (3 VP)' },
    { id: 'phoenix_roost', name: 'Phoenix Roost', type: 'auto', tags: ['creature', 'magic'], cost: 18,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { recruits: 2 } }, { prod: { mercury: 1 } }],
      text: 'Requires Sorcery 5+. +2 Recruit & +1 Mercury production. (3 VP)' },

    /* ============ DRAGONS ============ */
    { id: 'green_dragon_glade', name: 'Green Dragon Glade', type: 'auto', tags: ['creature', 'dragon'], cost: 14,
      req: { sorceryMin: 3 }, vp: 2, effects: [{ prod: { recruits: 1 } }, { prod: { wood: 1 } }],
      text: 'Requires Sorcery 3+. +1 Recruit & +1 Wood production. (2 VP)' },
    { id: 'gold_dragon_vault', name: 'Gold Dragon Vault', type: 'auto', tags: ['creature', 'dragon', 'wealth'], cost: 18,
      req: { sorceryMin: 4 }, vp: 2, effects: [{ prod: { gold: 3 } }], text: 'Requires Sorcery 4+. +3 Gold production. (2 VP)' },
    { id: 'red_dragon_cave', name: 'Red Dragon Cave', type: 'auto', tags: ['creature', 'dragon', 'magic'], cost: 16,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }],
      text: 'Requires Sorcery 5+. +1 Recruit & +1 Mercury production. (3 VP)' },
    { id: 'black_dragon_cave', name: 'Black Dragon Cave', type: 'auto', tags: ['creature', 'dragon', 'magic'], cost: 21,
      req: { sorceryMin: 7 }, vp: 4, effects: [{ prod: { recruits: 2 } }, { gain: { crystal: 2 } }],
      text: 'Requires Sorcery 7+. +2 Recruit production. Gain 2 Crystal. (4 VP)' },
    { id: 'bone_dragon_crypt', name: 'Bone Dragon Crypt', type: 'auto', tags: ['creature', 'dragon', 'undead'], cost: 15,
      req: { sorceryMin: 4 }, vp: 2, effects: [{ prod: { recruits: 2 } }], text: 'Requires Sorcery 4+. +2 Recruit production. (2 VP)' },
    { id: 'crystal_dragon_lair', name: 'Crystal Dragon Lair', type: 'auto', tags: ['creature', 'dragon'], cost: 17,
      req: { sorceryMin: 5 }, vp: 3, effects: [{ prod: { crystal: 1 } }, { prod: { recruits: 1 } }],
      text: 'Requires Sorcery 5+. +1 Crystal & +1 Recruit production. (3 VP)' },
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
      vp: 1, effects: [{ prod: { crystal: 1 } }], text: '+1 Crystal production. (1 VP)' },
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
      effects: [{ attackRes: { res: 'gold', n: 8 } }, { gain: { crystal: 1 } }], text: 'Each opponent loses 8 Gold. Gain 1 Crystal.' },
    { id: 'spell_slow', name: 'Slow', type: 'event', tags: ['magic'], cost: 6,
      effects: [{ attackRes: { res: 'gold', n: 6 } }], text: 'Each opponent loses 6 Gold.' },
    { id: 'spell_berserk', name: 'Berserk', type: 'event', tags: ['magic'], cost: 8,
      effects: [{ attackProd: { res: 'recruits', n: 1 } }, { gain: { gold: 3 } }], text: 'Each opponent: -1 Recruit production. Gain 3 Gold.' },
    { id: 'spell_armageddon', name: 'Armageddon', type: 'event', tags: ['magic'], cost: 16,
      effects: [{ attackProd: { res: 'recruits', n: 1 } }, { global: { sorcery: 1 } }, { gain: { crystal: 2 } }],
      text: 'Each opponent: -1 Recruit production. Advance Sorcery 1 step. Gain 2 Crystal.' },

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
  const HERO_LOADOUTS = [
    { tags: ['might'], cost: 8, text: 'Action: pay 2 Ore → gain 6 Gold.', effects: () => [A('Pay 2 Ore → gain 6 Gold', { ore: 2 }, [{ gain: { gold: 6 } }])] },
    { tags: ['might'], cost: 9, text: 'Action: pay 3 Gold → gain 3 Recruits.', effects: () => [A('Pay 3 Gold → gain 3 Recruits', { gold: 3 }, [{ gain: { recruits: 3 } }])] },
    { tags: ['might', 'creature'], cost: 10, text: '+1 Recruit production. Action: pay 2 Ore → gain 3 Recruits.', effects: () => [{ prod: { recruits: 1 } }, A('Pay 2 Ore → gain 3 Recruits', { ore: 2 }, [{ gain: { recruits: 3 } }])] },
    { tags: ['might'], cost: 9, text: 'Gain 2 Recruits. When you play a Might card, gain 2 Gold.', effects: () => [{ gain: { recruits: 2 } }, { addTrigger: { type: 'onPlayTag', tag: 'might', effect: [{ gain: { gold: 2 } }] } }] },
    { tags: ['might'], cost: 11, text: '+2 Recruit production.', effects: () => [{ prod: { recruits: 2 } }] },
    { tags: ['might', 'creature'], cost: 9, text: 'Action: pay 4 Recruits → advance Frontier.', effects: () => [A('Pay 4 Recruits → +1 Frontier', { recruits: 4 }, [{ global: { frontier: 1 } }])] },
    { tags: ['magic'], cost: 11, text: '+1 Mercury production. Action: pay 2 Mercury → draw 2 cards.', effects: () => [{ prod: { mercury: 1 } }, A('Pay 2 Mercury → draw 2 cards', { mercury: 2 }, [{ draw: 2 }])] },
    { tags: ['magic'], cost: 9, text: 'Action: pay 5 Gold → +1 Mercury production.', effects: () => [A('Pay 5 Gold → +1 Mercury production', { gold: 5 }, [{ prod: { mercury: 1 } }])] },
    { tags: ['magic'], cost: 12, text: 'Action: pay 1 Mercury → gain 2 Recruits.', effects: () => [A('Pay 1 Mercury → gain 2 Recruits', { mercury: 1 }, [{ gain: { recruits: 2 } }])] },
    { tags: ['magic'], cost: 10, text: 'Action: pay 1 Crystal → draw 2 cards.', effects: () => [A('Pay 1 Crystal → draw 2 cards', { crystal: 1 }, [{ draw: 2 }])] },
    { tags: ['magic'], cost: 13, text: 'Action: pay 9 Gold → advance Sorcery.', effects: () => [A('Pay 9 Gold → +1 Sorcery', { gold: 9 }, [{ global: { sorcery: 1 } }])] },
    { tags: ['magic'], cost: 9, text: 'When you advance Sorcery, gain 2 Gold.', effects: () => [{ addTrigger: { type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { gold: 2 } }] } }] },
    { tags: ['wealth'], cost: 10, text: '+1 Gold production. Gain 3 Gold.', effects: () => [{ prod: { gold: 1 } }, { gain: { gold: 3 } }] },
    { tags: ['wealth'], cost: 8, text: 'Action: pay 2 Recruits → gain 6 Gold.', effects: () => [A('Pay 2 Recruits → gain 6 Gold', { recruits: 2 }, [{ gain: { gold: 6 } }])] },
    { tags: ['creature'], cost: 9, text: 'Gain 2 Recruits. Action: pay 3 Gold → gain 2 Recruits.', effects: () => [{ gain: { recruits: 2 } }, A('Pay 3 Gold → gain 2 Recruits', { gold: 3 }, [{ gain: { recruits: 2 } }])] },
    { tags: ['magic'], cost: 12, text: 'When you play a Magic card, gain 1 Mercury.', effects: () => [{ addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { mercury: 1 } }] } }] },
  ];
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
  Object.keys(HERO_NAMES).forEach((fid, fi) => {
    HEROES_BY_FACTION[fid] = [];
    HERO_NAMES[fid].forEach((name, j) => {
      const L = HERO_LOADOUTS[(j + fi) % HERO_LOADOUTS.length];
      const id = 'h_' + fid + '_' + (j + 1);
      CARDS.push({ id, name, type: 'active', faction: fid, tags: ['hero'].concat(L.tags), cost: L.cost, vp: 1, effects: L.effects(), text: L.text });
      HEROES_BY_FACTION[fid].push(id);
    });
  });

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
    { name: 'Week of the Dendroid', text: 'The forests give freely — each lord gains 2 Wood.', effect: [{ gain: { wood: 2 } }] },
    { name: 'Week of the Unicorn', text: 'Crystal sap flows — each lord gains 1 Crystal.', effect: [{ gain: { crystal: 1 } }] },
    { name: 'Week of the Genie', text: 'Quicksilver mists rise — each lord gains 2 Mercury.', effect: [{ gain: { mercury: 2 } }] },
    { name: 'Conjunction of the Spheres', text: 'Far visions abound — each lord draws a card.', effect: [{ draw: 1 }] },
    { name: 'Week of the Salamander', text: 'The forges blaze — each lord gains 3 Gold and 1 Ore.', effect: [{ gain: { gold: 3, ore: 1 } }] },
    { name: 'Week of the Eagle', text: 'Scouts range far — each lord gains 2 Gold.', effect: [{ gain: { gold: 2 } }] },
    { name: 'Week of the Serpent', text: 'Trade thrives — each lord gains 4 Gold.', effect: [{ gain: { gold: 4 } }] },
    { name: 'Week of the Dragon', text: 'Ancient power stirs — each lord gains 1 Crystal and 1 Mercury.', effect: [{ gain: { crystal: 1, mercury: 1 } }] },
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
    bonusPool: [null, null, null, null, null, { gain: { gold: 4 } }, { gain: { ore: 2 } }, { gain: { wood: 2 } }, { gain: { crystal: 1 } }, { gain: { mercury: 2 } }, { gain: { recruits: 2 } }, { draw: 1 }],
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
        { name: 'Plant the Seed', cost: { gold: 8, wood: 5 }, req: { tags: { creature: 2 } }, desc: '+1 Wood production; gain 3 Recruits.', reward: [{ prod: { wood: 1 } }, { gain: { recruits: 3 } }] },
        { name: 'Spread the Roots', cost: { gold: 12, wood: 8 }, req: { frontierMin: 2 }, desc: '+1 Recruit & +1 Mercury production.', reward: [{ prod: { recruits: 1 } }, { prod: { mercury: 1 } }] },
        { name: 'Unfurl the Canopy', cost: { gold: 18, wood: 10, crystal: 2 }, req: { tags: { creature: 5 } }, desc: '+1 Wood production. Forever: playing a Creature gains 1 Recruit.', reward: [{ prod: { wood: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'creature', effect: [{ gain: { recruits: 1 } }] } }] },
      ],
    },
    tower: {
      name: 'The Celestial Observatory', blurb: 'A spire to read the stars and the weave.',
      stages: [
        { name: 'Found the Vault', cost: { gold: 8, crystal: 2 }, req: { sorceryMin: 2 }, desc: '+1 Mercury production; draw a card.', reward: [{ prod: { mercury: 1 } }, { draw: 1 }] },
        { name: 'Mount the Lens', cost: { gold: 14, crystal: 3 }, req: { tags: { magic: 3 } }, desc: '+1 Crystal production.', reward: [{ prod: { crystal: 1 } }] },
        { name: 'Open the Eye', cost: { gold: 20, crystal: 4, mercury: 4 }, req: { sorceryMin: 8 }, desc: 'Advance Sorcery. Forever: playing a Magic card gains 2 Mercury.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'magic', effect: [{ gain: { mercury: 2 } }] } }] },
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
        { name: 'Carve the Hollow', cost: { gold: 8, crystal: 2 }, req: { sorceryMin: 3 }, desc: '+1 Crystal production.', reward: [{ prod: { crystal: 1 } }] },
        { name: 'Lure the Wyrms', cost: { gold: 14, crystal: 3 }, req: { tags: { dragon: 1 } }, desc: '+2 Recruit production; gain 2 Crystal.', reward: [{ prod: { recruits: 2 } }, { gain: { crystal: 2 } }] },
        { name: 'Wake the Ancients', cost: { gold: 20, crystal: 5 }, req: { tags: { dragon: 2 } }, desc: 'Advance Sorcery. Forever: playing a Dragon gains 4 Gold.', reward: [{ global: { sorcery: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'dragon', effect: [{ gain: { gold: 4 } }] } }] },
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
        { name: 'Drain the Mire', cost: { gold: 8, ore: 4, wood: 3 }, req: { tags: { beast: 2 } }, desc: '+1 Recruit & +1 Ore production.', reward: [{ prod: { recruits: 1 } }, { prod: { ore: 1 } }] },
        { name: 'Raise the Ramparts', cost: { gold: 12, ore: 6 }, req: { frontierMin: 3 }, desc: '+2 Recruit production.', reward: [{ prod: { recruits: 2 } }] },
        { name: 'Flood the Breeding Pits', cost: { gold: 16, ore: 8, crystal: 2 }, req: { tags: { beast: 4 } }, desc: '+1 Gold production. Forever: playing a Beast gains 2 Recruits.', reward: [{ prod: { gold: 1 } }, { addTrigger: { type: 'onPlayTag', tag: 'beast', effect: [{ gain: { recruits: 2 } }] } }] },
      ],
    },
    conflux: {
      name: 'The Eye of the Magi', blurb: 'A vortex where the four elements meet.',
      stages: [
        { name: 'Anchor the Vortex', cost: { gold: 8, mercury: 3 }, req: { sorceryMin: 2 }, desc: '+1 Mercury production; draw a card.', reward: [{ prod: { mercury: 1 } }, { draw: 1 }] },
        { name: 'Align the Planes', cost: { gold: 12, mercury: 5 }, req: { tags: { magic: 3 } }, desc: '+1 Crystal & +1 Mercury production.', reward: [{ prod: { crystal: 1 } }, { prod: { mercury: 1 } }] },
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
    { id: 'q_steadwick', name: 'Defend Steadwick', type: 'combat', req: { tags: { might: 3 } }, cost: { ore: 5, recruits: 6 }, reward: [{ vpNow: 3 }, { gain: { crystal: 2 } }], text: '3★ and gain 2 Crystal.' },
    { id: 'q_manacryst', name: 'Tame the Mana Crystals', type: 'arcane', cost: { mercury: 5 }, reward: [{ prod: { crystal: 1 } }], text: '+1 Crystal production.' },
    { id: 'q_warmachines', name: 'Forge the War Machines', type: 'industry', cost: { ore: 6 }, reward: [{ gain: { recruits: 3 } }, { prod: { recruits: 1 } }], text: 'Gain 3 Recruits; +1 Recruit production.' },
    { id: 'q_wastes', name: 'Map the Northern Wastes', type: 'explore', req: { frontierMin: 2 }, cost: { mercury: 3, ore: 2 }, reward: [{ global: { frontier: 1 } }, { draw: 2 }], text: 'Advance Frontier; draw 2 cards.' },
    { id: 'q_merc', name: 'Hire the Sellswords', type: 'wealth', cost: { gold: 5 }, reward: [{ gain: { recruits: 5 } }], text: 'Gain 5 Recruits.' },
    { id: 'q_hoard', name: 'Plunder the Dragon Hoard', type: 'arcane', req: { sorceryMin: 4 }, cost: { mercury: 4 }, reward: [{ vpNow: 2 }, { gain: { crystal: 3, gold: 6 } }], text: '2★; gain 3 Crystal and 6 Gold.' },
    { id: 'q_traderoad', name: 'Build the Trade Road', type: 'wealth', cost: { ore: 4 }, reward: [{ prod: { gold: 1 } }, { prod: { wood: 1 } }], text: '+1 Gold & +1 Wood production.' },
    { id: 'q_elementals', name: 'Commune with the Elementals', type: 'arcane', cost: { mercury: 6 }, reward: [{ global: { sorcery: 1 } }], text: 'Advance Sorcery (+Renown).' },
    { id: 'q_undead', name: 'Quell the Undead Uprising', type: 'combat', cost: { ore: 5, mercury: 3 }, reward: [{ vpNow: 2 }, { gain: { gold: 8 } }], text: '2★ and gain 8 Gold.' },
    { id: 'q_obelisk', name: 'Decipher the Obelisks', type: 'explore', req: { frontierMin: 3 }, cost: { mercury: 5 }, reward: [{ vpNow: 1 }, { addTrigger: { type: 'onRaiseGlobal', effect: [{ gain: { gold: 2 } }] } }], text: '1★. SAGA: when you advance any track, gain 2 Gold.' },
    { id: 'q_conservancy', name: 'The Griffin Conservancy', type: 'combat', req: { tags: { beast: 2 } }, cost: { ore: 4 }, reward: [{ addTrigger: { type: 'onPlayTag', tag: 'creature', effect: [{ gain: { recruits: 1 } }] } }], text: 'SAGA: when you play a Creature, gain 1 Recruit.' },
    { id: 'q_excavate', name: 'Excavate the Ancient Mine', type: 'industry', cost: { mercury: 4 }, reward: [{ prod: { crystal: 1 } }, { gain: { ore: 2 } }], text: '+1 Crystal production; gain 2 Ore.' },
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
