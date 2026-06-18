/* =====================================================================
 * THE BATTLE OF HOGWARTS — The Last Stand   (data.js)
 * ---------------------------------------------------------------------
 * A co-op LANE TOWER-DEFENSE deckbuilder for 1 or 2 allied players
 * (hot-seat, one screen). Defend Hogwarts against Voldemort's armies.
 *
 *   • Players act, THEN Voldemort's army acts, every turn.
 *   • Voldemort WINS if Hogwarts' Wards (health) fall below 30%.
 *   • Players WIN if the Dark Army's Morale falls below 30%.
 *
 * No build step, no dependencies — plain data + a DOM-free engine, both
 * runnable in the browser AND under Node (so the engine can be fuzzed
 * headlessly). This file is data only; engine.js implements the verbs.
 *
 * ---------------------------------------------------------------------
 * THE BATTLEFIELD
 *   3 lanes (approaches to the castle). Each lane is a track of length
 *   CONFIG.laneLen; enemies enter at the far end (dist = laneLen) and
 *   crawl toward the gate (dist = 0). Allies are DEPLOYED to a lane and
 *   defend its gate — they auto-fire every Voldemort turn (the "towers").
 *
 * CARD SCHEMA (player cards)
 *   { id, name, house, type:'ally'|'spell'|'enchant', cost, tags:[],
 *     text, flavor, count }                       // count = copies in deck
 *   ally   adds: hp, atk, and any of:
 *            guard:n      allies sharing its lane take n less damage
 *            lash         its volley also hits the 2nd enemy in lane
 *            loyal        +1 atk per OTHER ally in its lane (cap +3)
 *            intangible   cannot be targeted by enemy attacks
 *            chip:n       deals n to frontmost enemy in lane each turn-start
 *            onDeploy:[fx] resolves when played
 *            triggers:[{when, effect:[fx]}]       persistent while in play
 *            ability:{cost,oncePerTurn,effect:[fx],desc}
 *   spell  adds: onPlay:[fx]  and optional target:'enemy'|'lane'|'ally'
 *   enchant adds: triggers:[{when,...}] (stays in play), optional onPlay
 *
 * ENEMY SCHEMA
 *   { id, name, enemy:true, hp, atk, speed, morale, tags:[], text,
 *     tier, minTurn, weight,                       // wave-pool tuning
 *     boss?, breach?(override breach dmg), pairs?(deploy N at once),
 *     siege?(breach x2), dementor?(−1 mana while at gate),
 *     reanimate?{hp}, healOnHit?:n, armorPierce?(ignore guard, hit any ally),
 *     immuneFreeze?, immuneControl?, immuneExecute? }
 *
 * EFFECT VOCABULARY (engine.applyEffects) — one primary key per effect:
 *   {damage:{n,target}}   target: front|back|all|lane|pick|strongest|weakest
 *   {splash:{n}}          n to enemies adjacent to the last damaged
 *   {globalDamage:{n}}    n to every enemy on the board
 *   {perSpellDamage:{n}}  n × (spells you cast this turn) to every enemy
 *   {morale:{n}}          drain n Dark-Army morale (good for players)
 *   {push:{n,target}}     shove enemy(ies) back n tiles
 *   {freeze:{target}}     enemy skips its next advance
 *   {freezeLane:{}}       every enemy in the lane skips next advance
 *   {weaken:{n,target}}   reduce enemy atk by n (min 0, permanent)
 *   {execute:{maxHp}}     destroy a chosen enemy if its hp <= maxHp
 *   {control:{}}          turn the chosen enemy into one of YOUR allies
 *   {redirect:{}}         chosen enemy strikes the enemy ahead of it
 *   {lift:{turns}}        remove chosen enemy for N turns, re-enter at back
 *   {heal:{n,target}}     heal ally(ies): self|pick|lowest|lane|all
 *   {buff:{atk,hp,target,duration}}  duration: 'turn'|'perm'
 *   {invuln:{target}}     ally(ies) take no damage this Voldemort turn
 *   {castleHeal:{n}}      repair Hogwarts' Wards
 *   {castleShield:{n}}    prevent the first n Wards damage this Vold. turn
 *   {mana:{n}} {draw:{n}} {discard:{n}}
 *   {costReduce:{n}}      your cards cost n less for the rest of this turn
 *   {summon:{id,count}}   deploy token allies (by id) to the chosen lane
 *   {laneAttack:{}}       your allies in the chosen lane fire immediately
 *   {returnToHand:{}}     (slain-trigger) the ally returns to its owner's hand
 * Targets needing player choice ('pick', plus lane/ally for some) are
 * resolved by the UI; the engine auto-resolves them for headless play.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---- top-level tuning knobs ------------------------------------- */
  const CONFIG = {
    castleHp: 100,            // Hogwarts' Wards
    castleLosePct: 0.30,      // Voldemort wins when wards < 30%
    moraleStart: 100,         // the Dark Army's resolve
    moraleWinPct: 0.30,       // players win when morale < 30%
    gateStep: 3,              // foes at this step are AT the gate; step 4 = breach
    startForce: 3,            // foes already on the field when the siege opens
    baseMana: 3,              // mana at the start of round 1
    manaRampEvery: 2,         // +1 Mana every this-many rounds (the siege escalates both ways)...
    manaMax: 7,               // ...up to this ceiling
    handSize: 5,              // draw up to this each of your turns
    breachMoraleGain: 1,      // morale the Dark Army regains per unblocked breach
    // Reinforcement waves escalate — this is the built-in doom countdown.
    waveBase: 1,              // enemies deployed turn 1
    waveGrowEvery: 2,         // +1 to the wave every N player-turns
    waveMax: 5,               // cap (×players — see engine)
    perPlayerWave: 1,         // extra wave size added per player beyond the first
    enemyHpRampEvery: 5,      // non-boss enemies gain +1 HP every N rounds (they reach the walls)
    // Difficulty presets — scale the whole threat. Two strong players who
    // steamroll Standard should climb to Hard / Legendary.
    DIFFICULTIES: {
      standard:  { id: 'standard',  name: 'Standard',  blurb: 'A winnable defence — learn the siege.',
        waveMult: 0.77, capMult: 0.9, statMult: 0.7, bossHp: 0.88 },
      hard:      { id: 'hard',      name: 'Hard',      blurb: 'A sterner siege. Recommended for two strong players.',
        waveMult: 1.0, capMult: 1.1, statMult: 1.15, bossHp: 1.18 },
      legendary: { id: 'legendary', name: 'Legendary', blurb: 'Few walls have ever held. The Dark Lord spares nothing.',
        waveMult: 1.12, capMult: 1.25, statMult: 1.3, bossHp: 1.28 },
    },
    // Named lieutenants enter on these turns (scaled a little for 2p in engine).
    bossSchedule: [
      { turn: 4,  id: 'greyback'  },
      { turn: 7,  id: 'bellatrix' },
      { turn: 10, id: 'nagini'    },
      { turn: 13, id: 'voldemort' },
    ],
  };

  /* ---- the battlefield: a funnel of regions ----------------------- *
   * Enemies muster at the FOREST, then march down one of three GROUNDS
   * (step 1) → the COURTYARD (step 2) → the GREAT GATE (step 3); beyond
   * the gate (step 4) they breach the Wards. Allies are deployed into any
   * 'play' region and fight foes that share it (a melee, both take harm).
   * x/y are % positions on the painterly map (for the UI).               */
  const REGIONS = [
    { id: 'forest', name: 'The Forbidden Forest — the Dark Army musters', short: 'The Forbidden Forest', side: 'enemy', x: 50, y: 12 },
    { id: 'pitch',  name: 'The Quidditch Pitch', short: 'Quidditch Pitch', side: 'play', x: 19, y: 42 },
    { id: 'bridge', name: 'The Covered Bridge',  short: 'The Covered Bridge', side: 'play', x: 50, y: 46 },
    { id: 'hagrid', name: "Hagrid's Grounds",    short: "Hagrid's Grounds", side: 'play', x: 81, y: 40 },
    { id: 'court',  name: 'The Courtyard',       short: 'The Courtyard', side: 'play', x: 50, y: 66 },
    { id: 'gate',   name: 'The Great Gate',      short: 'The Great Gate', side: 'play', x: 50, y: 84 },
  ];
  const GROUNDS = ['pitch', 'bridge', 'hagrid']; // step-1 lanes
  // step → region:  0 forest · 1 grounds[lane] · 2 court · 3 gate · ≥4 breach

  /* ---- the four Houses (each a deck + a unique House Power) -------- */
  const HOUSES = {
    gryffindor: {
      id: 'gryffindor', name: 'Gryffindor', crest: '🦁', color: '#ae0001', color2: '#d3a625',
      motto: 'Courage', identity: 'Aggression & frontline valour. Hit hard, hit first.',
      // Passive: read & applied by the engine.
      passive: { id: 'valor', text: 'Valour: all your allies deal +1 damage, always.' },
      power: { id: 'sword', name: 'Sword of Gryffindor', cost: 2, oncePerTurn: true,
        desc: 'Deal 4 damage to any enemy and drain 2 Morale.',
        effect: [{ damage: { n: 4, target: 'pick' } }, { morale: { n: 2 } }] },
    },
    slytherin: {
      id: 'slytherin', name: 'Slytherin', crest: '🐍', color: '#2a623d', color2: '#aaaaaa',
      motto: 'Cunning', identity: 'Control & attrition. Bend the battle, drain their will.',
      passive: { id: 'cunning', text: 'Cunning: whenever an enemy is slain by one of your spells, drain 1 extra Morale.' },
      power: { id: 'coil', name: "Serpent's Coil", cost: 2, oncePerTurn: true,
        desc: 'Push every enemy in one lane back 2 tiles.',
        effect: [{ push: { n: 2, target: 'lane' } }] },
    },
    ravenclaw: {
      id: 'ravenclaw', name: 'Ravenclaw', crest: '🦅', color: '#222f5b', color2: '#946b2d',
      motto: 'Wit', identity: 'Card flow & spell chains. Out-think the horde.',
      passive: { id: 'wit', text: 'Wit: every 2nd spell you cast in a turn, draw a card and deal 3 to the most-advanced foe.' },
      power: { id: 'diadem', name: 'Lost Diadem', cost: 1, oncePerTurn: true,
        desc: 'Draw 2 cards.',
        effect: [{ draw: { n: 2 } }] },
    },
    hufflepuff: {
      id: 'hufflepuff', name: 'Hufflepuff', crest: '🦡', color: '#ecb939', color2: '#372e29',
      motto: 'Loyalty', identity: 'Resilience & healing. Outlast the siege, mend the walls.',
      passive: { id: 'loyalty', text: 'Loyalty: the first ally that would die each turn survives with 1 HP — up to 4 times in the battle.' },
      power: { id: 'rally', name: 'Rally the Hufflepuffs', cost: 2, oncePerTurn: true,
        desc: 'Heal all your allies 2 and repair the Wards 2.',
        effect: [{ heal: { n: 2, target: 'all' } }, { castleHeal: { n: 2 } }] },
    },
  };

  const TAGS = {
    student: '🎓', professor: '📖', order: '🦌', dueller: '⚔️',
    charm: '✨', curse: '🟢', healing: '💚', plant: '🌿',
    creature: '🐾', ghost: '👻', token: '○',
  };

  /* =================================================================
   * PLAYER CARDS  (count = copies in that house's deck; tokens have no
   * count — they are summoned, never drawn)
   * ================================================================= */
  const CARDS = [

    /* ---------------- GRYFFINDOR — Courage ------------------------- */
    { id: 'g_harry', house: 'gryffindor', name: 'Harry Potter', type: 'ally', cost: 4, count: 1,
      hp: 6, atk: 3, tags: ['student', 'dueller'],
      text: 'When slain: draw 2 cards and drain 3 Morale.',
      flavor: '"I am the true master of the Elder Wand."',
      triggers: [{ when: 'slain', effect: [{ draw: { n: 2 } }, { morale: { n: 3 } }] }] },
    { id: 'g_ron', house: 'gryffindor', name: 'Ron Weasley', type: 'ally', cost: 3, count: 1,
      hp: 5, atk: 2, loyal: true, tags: ['student'],
      text: 'Loyal: +1 ATK for each other ally in his lane (max +3).',
      flavor: '"We could be killed. Or worse, expelled."' },
    { id: 'g_neville', house: 'gryffindor', name: 'Neville Longbottom', type: 'ally', cost: 3, count: 1,
      hp: 5, atk: 2, tags: ['student'],
      text: 'When slain: deal 3 to all enemies in his lane and drain 2 Morale.',
      flavor: 'He drew the Sword of Gryffindor from the Sorting Hat.',
      triggers: [{ when: 'slain', effect: [{ damage: { n: 3, target: 'lane' } }, { morale: { n: 2 } }] }] },
    { id: 'g_ginny', house: 'gryffindor', name: 'Ginny Weasley', type: 'ally', cost: 2, count: 1,
      hp: 4, atk: 3, tags: ['student'],
      text: 'On deploy: weaken the frontmost enemy in her lane by 2 (Bat-Bogey Hex).',
      flavor: 'Her hexes were the stuff of legend.',
      onDeploy: [{ weaken: { n: 2, target: 'front' } }] },
    { id: 'g_seamus', house: 'gryffindor', name: 'Seamus Finnigan', type: 'ally', cost: 2, count: 1,
      hp: 4, atk: 1, tags: ['student'],
      text: 'When slain: deal 4 to all enemies in his lane (Pyrotechnics).',
      flavor: '"I can bring the whole bridge down."',
      triggers: [{ when: 'slain', effect: [{ damage: { n: 4, target: 'lane' } }] }] },
    { id: 'g_fawkes', house: 'gryffindor', name: 'Fawkes', type: 'ally', cost: 4, count: 1,
      hp: 4, atk: 2, chip: 1, tags: ['creature'],
      text: 'Each turn: deal 1 to the frontmost enemy in his lane. When slain: repair the Wards 5 and return to your hand.',
      flavor: 'Phoenixes can carry immensely heavy loads.',
      triggers: [{ when: 'slain', effect: [{ castleHeal: { n: 5 } }, { returnToHand: {} }] }] },
    { id: 'g_mcgonagall', house: 'gryffindor', name: 'Minerva McGonagall', type: 'ally', cost: 5, count: 1,
      hp: 7, atk: 3, tags: ['professor'],
      text: 'On deploy: summon a Stone Guardian to her lane (Piertotum Locomotor).',
      flavor: '"I\'ve always wanted to use that spell."',
      onDeploy: [{ summon: { id: 't_guardian', count: 1 } }] },
    { id: 'g_stupefy', house: 'gryffindor', name: 'Stupefy', type: 'spell', cost: 1, count: 3,
      tags: ['charm'], target: 'enemy', text: 'Deal 3 damage to an enemy.',
      flavor: 'The Stunning Spell — a duellist\'s bread and butter.',
      onPlay: [{ damage: { n: 3, target: 'pick' } }] },
    { id: 'g_expelliarmus', house: 'gryffindor', name: 'Expelliarmus', type: 'spell', cost: 1, count: 3,
      tags: ['charm'], target: 'enemy', text: 'Weaken an enemy by 3 and push it back 1.',
      flavor: 'Harry\'s signature spell.',
      onPlay: [{ weaken: { n: 3, target: 'pick' } }, { push: { n: 1, target: 'pick' } }] },
    { id: 'g_reducto', house: 'gryffindor', name: 'Reducto', type: 'spell', cost: 2, count: 3,
      tags: ['charm'], target: 'enemy', text: 'Deal 4 damage to an enemy.',
      flavor: 'The Reductor Curse blasts solid objects aside.',
      onPlay: [{ damage: { n: 4, target: 'pick' } }] },
    { id: 'g_confringo', house: 'gryffindor', name: 'Confringo', type: 'spell', cost: 3, count: 2,
      tags: ['charm'], target: 'lane', text: 'Deal 4 damage to all enemies in a region.',
      flavor: 'The Blasting Curse leaves nothing but cinders.',
      onPlay: [{ damage: { n: 4, target: 'lane' } }] },
    { id: 'g_da', house: 'gryffindor', name: "Dumbledore's Army", type: 'spell', cost: 3, count: 2,
      tags: ['student'], target: 'lane', text: 'Summon two DA Defenders to a lane.',
      flavor: 'The room of requirement provided.',
      onPlay: [{ summon: { id: 't_da', count: 2 } }] },
    { id: 'g_courage', house: 'gryffindor', name: "A Gryffindor's Courage", type: 'spell', cost: 2, count: 2,
      tags: ['charm'], text: 'All your allies gain +2 ATK this turn. Drain 1 Morale.',
      flavor: 'It takes a great deal of bravery to stand up to your enemies.',
      onPlay: [{ buff: { atk: 2, target: 'all', duration: 'turn' } }, { morale: { n: 1 } }] },
    { id: 'g_swordstrike', house: 'gryffindor', name: 'Sword of the Hat', type: 'spell', cost: 2, count: 2,
      tags: ['dueller'], target: 'enemy', text: 'Deal 6 to a single enemy. If it dies, drain 3 Morale.',
      flavor: 'Goblin-made, it imbibes only that which strengthens it.',
      onPlay: [{ damage: { n: 6, target: 'pick', moraleOnKill: 3 } }] },

    /* ---------------- SLYTHERIN — Cunning -------------------------- */
    { id: 's_snape', house: 'slytherin', name: 'Severus Snape', type: 'ally', cost: 4, count: 1,
      hp: 6, atk: 3, tags: ['professor'],
      text: 'On deploy: weaken every enemy in his lane by 1. When slain: drain 5 Morale (his true loyalty revealed).',
      flavor: '"Look... at... me."',
      onDeploy: [{ weaken: { n: 1, target: 'lane' } }],
      triggers: [{ when: 'slain', effect: [{ morale: { n: 5 } }] }] },
    { id: 's_slughorn', house: 'slytherin', name: 'Horace Slughorn', type: 'ally', cost: 3, count: 1,
      hp: 5, atk: 1, tags: ['professor'],
      text: 'At the start of your turn while he lives: gain +1 Mana.',
      flavor: 'He returned to fight, and dared to duel the Dark Lord himself.',
      triggers: [{ when: 'turnStart', effect: [{ mana: { n: 1 } }] }] },
    { id: 's_grey', house: 'slytherin', name: 'Conjured Serpent', type: 'ally', cost: 2, count: 2,
      hp: 3, atk: 2, lash: true, tags: ['creature'],
      text: 'Serpensortia — its strike also hits the enemy behind its target.',
      flavor: '"Sssss."' },
    { id: 's_sectum', house: 'slytherin', name: 'Sectumsempra', type: 'spell', cost: 3, count: 2,
      tags: ['curse'], target: 'enemy', text: 'Deal 6 to an enemy. It cannot be healed.',
      flavor: '"For enemies." — the Half-Blood Prince',
      onPlay: [{ damage: { n: 6, target: 'pick', noHeal: true } }] },
    { id: 's_imperio', house: 'slytherin', name: 'Imperio', type: 'spell', cost: 4, count: 1,
      tags: ['curse'], target: 'enemy', text: 'Seize control of an enemy — it fights for you as an ally until slain.',
      flavor: 'An Unforgivable Curse, turned against its makers.',
      onPlay: [{ control: {} }] },
    { id: 's_impedimenta', house: 'slytherin', name: 'Impedimenta', type: 'spell', cost: 1, count: 3,
      tags: ['charm'], target: 'lane', text: 'Freeze a lane — its enemies do not advance next turn.',
      flavor: 'The Impediment Jinx buys precious seconds.',
      onPlay: [{ freezeLane: {} }] },
    { id: 's_confundo', house: 'slytherin', name: 'Confundo', type: 'spell', cost: 2, count: 2,
      tags: ['curse'], target: 'enemy', text: 'A Confunded enemy strikes the enemy ahead of it instead of advancing.',
      flavor: 'The Confundus Charm muddles the sharpest mind.',
      onPlay: [{ redirect: {} }] },
    { id: 's_ambush', house: 'slytherin', name: "Serpent's Ambush", type: 'spell', cost: 2, count: 2,
      tags: ['curse'], text: 'Deal 3 to the BACKMOST enemy in every lane.',
      flavor: 'Strike the stragglers before they ever arrive.',
      onPlay: [{ damage: { n: 3, target: 'back', allLanes: true } }] },
    { id: 's_venom', house: 'slytherin', name: 'Creeping Venom', type: 'enchant', cost: 3, count: 1,
      tags: ['curse'], text: 'Each Voldemort turn: deal 1 to every enemy on the board.',
      flavor: 'A slow poison seeps across the grounds.',
      triggers: [{ when: 'volley', effect: [{ globalDamage: { n: 1 } }] }] },
    { id: 's_felix', house: 'slytherin', name: 'Felix Felicis', type: 'spell', cost: 3, count: 1,
      tags: ['charm'], text: 'Liquid Luck: draw 2, and your cards cost 1 less for the rest of this turn.',
      flavor: 'A small vial of molten gold luck.',
      onPlay: [{ draw: { n: 2 } }, { costReduce: { n: 1 } }] },
    { id: 's_basilisk', house: 'slytherin', name: 'Basilisk Fang', type: 'spell', cost: 2, count: 2,
      tags: ['curse'], target: 'enemy', text: 'Destroy a chosen enemy with 5 or less HP. Drain 2 Morale.',
      flavor: 'Venom that even destroys Horcruxes.',
      onPlay: [{ execute: { maxHp: 5 } }, { morale: { n: 2 } }] },
    { id: 's_whispers', house: 'slytherin', name: 'Whispers of Doubt', type: 'spell', cost: 2, count: 2,
      tags: ['curse'], text: 'Drain 3 Morale directly.',
      flavor: 'Even the Dark Lord\'s servants flinch.',
      onPlay: [{ morale: { n: 3 } }] },
    { id: 's_portrait', house: 'slytherin', name: 'Phineas Nigellus', type: 'enchant', cost: 2, count: 1,
      tags: ['professor'], text: 'At the start of each of your turns: draw 1 card.',
      flavor: 'The least popular Headmaster Hogwarts ever had.',
      triggers: [{ when: 'turnStart', effect: [{ draw: { n: 1 } }] }] },

    /* ---------------- RAVENCLAW — Wit ----------------------------- */
    { id: 'r_luna', house: 'ravenclaw', name: 'Luna Lovegood', type: 'ally', cost: 3, count: 1,
      hp: 6, atk: 2, tags: ['student'],
      text: 'On deploy: draw 2 cards.',
      flavor: '"We\'re all a little mad. The best of us are."',
      onDeploy: [{ draw: { n: 2 } }] },
    { id: 'r_flitwick', house: 'ravenclaw', name: 'Filius Flitwick', type: 'ally', cost: 4, count: 1,
      hp: 6, atk: 3, spellPower: 2, tags: ['professor'],
      text: 'While he lives: your damage spells deal +2 (Charms Master).',
      flavor: 'A duelling champion in his youth.' },
    { id: 'r_cho', house: 'ravenclaw', name: 'Cho Chang', type: 'ally', cost: 2, count: 1,
      hp: 4, atk: 2, tags: ['student'],
      text: 'On deploy: deal 2 to an enemy.',
      flavor: 'A member of the DA from the very first meeting.',
      onDeploy: [{ damage: { n: 2, target: 'pick' } }] },
    { id: 'r_greylady', house: 'ravenclaw', name: 'The Grey Lady', type: 'ally', cost: 3, count: 2,
      hp: 5, atk: 0, intangible: true, chip: 4, tags: ['ghost'],
      text: 'Intangible (cannot be attacked). In melee she deals 4 to the most-advanced foe in her region, taking no harm.',
      flavor: 'Helena Ravenclaw, daughter of the founder.' },
    { id: 'r_diffindo', house: 'ravenclaw', name: 'Diffindo', type: 'spell', cost: 1, count: 3,
      tags: ['charm'], target: 'enemy', text: 'Deal 3 damage to an enemy.',
      flavor: 'The Severing Charm — cheap, quick, endless.',
      onPlay: [{ damage: { n: 3, target: 'pick' } }] },
    { id: 'r_protego', house: 'ravenclaw', name: 'Protego', type: 'spell', cost: 1, count: 3,
      tags: ['charm'], text: 'Shield: reduce all damage to the Wards by 4 this Voldemort turn.',
      flavor: 'The Shield Charm rebounds the assault.',
      onPlay: [{ castleShield: { n: 4 } }] },
    { id: 'r_protegomax', house: 'ravenclaw', name: 'Protego Maxima', type: 'enchant', cost: 4, count: 1,
      tags: ['charm'], text: 'The Great Shield: prevent the first 4 Wards damage every Voldemort turn.',
      flavor: 'The teachers cast the castle\'s ancient protections.',
      triggers: [{ when: 'castleShield', effect: [{ castleShield: { n: 4 } }] }] },
    { id: 'r_glacius', house: 'ravenclaw', name: 'Glacius', type: 'spell', cost: 2, count: 2,
      tags: ['charm'], target: 'enemy', text: 'Freeze the chosen enemy and the one behind it.',
      flavor: 'The Freezing Charm locks limbs in ice.',
      onPlay: [{ freeze: { target: 'pick' } }, { freeze: { target: 'behind' } }] },
    { id: 'r_bombarda', house: 'ravenclaw', name: 'Bombarda Maxima', type: 'spell', cost: 3, count: 2,
      tags: ['charm'], target: 'enemy', text: 'Deal 4 to an enemy and 2 to the enemies on either side of it.',
      flavor: 'The wall of the Clock Tower came down in a roar.',
      onPlay: [{ damage: { n: 4, target: 'pick' } }, { splash: { n: 2 } }] },
    { id: 'r_wisdom', house: 'ravenclaw', name: "Rowena's Wisdom", type: 'spell', cost: 2, count: 2,
      tags: ['charm'], text: 'Draw 2. Your next spell this turn costs 0.',
      flavor: '"Wit beyond measure is man\'s greatest treasure."',
      onPlay: [{ draw: { n: 2 } }, { costReduce: { n: 99, oneCard: true } }] },
    { id: 'r_ravens', house: 'ravenclaw', name: 'Conjure a Flock', type: 'spell', cost: 2, count: 1,
      tags: ['charm'], target: 'lane', text: 'Summon 3 Conjured Ravens to a lane.',
      flavor: 'Avis! A flutter of wings from the wand-tip.',
      onPlay: [{ summon: { id: 't_raven', count: 3 } }] },
    { id: 'r_revelio', house: 'ravenclaw', name: 'Specialis Revelio', type: 'spell', cost: 1, count: 2,
      tags: ['charm'], text: 'Draw 1 card and gain 1 Mana.',
      flavor: 'A cantrip that pays for itself.',
      onPlay: [{ draw: { n: 1 } }, { mana: { n: 1 } }] },
    { id: 'r_levicorpus', house: 'ravenclaw', name: 'Levicorpus', type: 'spell', cost: 2, count: 2,
      tags: ['charm'], target: 'enemy', text: 'Dangle an enemy in the air — remove it for 1 turn, then it re-enters at the back.',
      flavor: 'Hung upside-down by the ankle.',
      onPlay: [{ lift: { turns: 1 } }] },
    { id: 'r_master', house: 'ravenclaw', name: 'Master of Spells', type: 'spell', cost: 4, count: 1,
      tags: ['charm'], text: 'Deal 2 to every enemy for each spell you have cast this turn.',
      flavor: 'The culmination of a thousand quiet hours in the library.',
      onPlay: [{ perSpellDamage: { n: 2 } }] },

    /* ---------------- HUFFLEPUFF — Loyalty ------------------------ */
    { id: 'h_cedric', house: 'hufflepuff', name: 'Cedric Diggory', type: 'ally', cost: 4, count: 1,
      hp: 6, atk: 3, guard: 1, tags: ['student', 'dueller'],
      text: 'Champion: while he lives, allies in his lane take 1 less damage.',
      flavor: '"If you must, take my body back."' },
    { id: 'h_sprout', house: 'hufflepuff', name: 'Pomona Sprout', type: 'ally', cost: 4, count: 1,
      hp: 5, atk: 1, tags: ['professor', 'plant'],
      text: 'On deploy: summon 3 Mandrakes to her region.',
      flavor: 'She led the charge with her Venomous Tentacula.',
      onDeploy: [{ summon: { id: 't_mandrake', count: 3 } }] },
    { id: 'h_tentacula', house: 'hufflepuff', name: 'Venomous Tentacula', type: 'ally', cost: 3, count: 1,
      hp: 4, atk: 3, lash: true, tags: ['plant'],
      text: 'Its strike also lashes the enemy behind its target.',
      flavor: 'A toothy, vinelike plant — and a hungry one.' },
    { id: 'h_tonks', house: 'hufflepuff', name: 'Nymphadora Tonks', type: 'ally', cost: 3, count: 1,
      hp: 5, atk: 3, tags: ['order'],
      text: 'On deploy: deal 2 to an enemy.',
      flavor: 'Auror, Metamorphmagus, member of the Order.',
      onDeploy: [{ damage: { n: 2, target: 'pick' } }] },
    { id: 'h_hagrid', house: 'hufflepuff', name: 'Rubeus Hagrid', type: 'ally', cost: 5, count: 1,
      hp: 8, atk: 3, tags: ['order'],
      text: 'On deploy: push all enemies in his lane back 1 tile.',
      flavor: '"Yeh great lump." A half-giant\'s heart and hide.',
      onDeploy: [{ push: { n: 1, target: 'lane' } }] },
    { id: 'h_episkey', house: 'hufflepuff', name: 'Episkey', type: 'spell', cost: 1, count: 3,
      tags: ['healing'], target: 'ally', text: 'Heal an ally 4.',
      flavor: 'A quick mending of broken bone.',
      onPlay: [{ heal: { n: 4, target: 'pick' } }] },
    { id: 'h_reparo', house: 'hufflepuff', name: 'Reparo the Walls', type: 'spell', cost: 2, count: 3,
      tags: ['charm'], text: 'Repair the Wards 6.',
      flavor: 'Stone flowed back into stone.',
      onPlay: [{ castleHeal: { n: 6 } }] },
    { id: 'h_snare', house: 'hufflepuff', name: "Devil's Snare", type: 'enchant', cost: 3, count: 1,
      tags: ['plant'], target: 'lane', text: 'Plant a snare in a lane: each Voldemort turn it freezes that lane and deals 1 to each enemy there.',
      flavor: '"Devil\'s Snare, Devil\'s Snare... it likes the dark and damp."',
      triggers: [{ when: 'volley', effect: [{ damage: { n: 1, target: 'lane', boundLane: true } }, { freezeLane: { boundLane: true } }] }] },
    { id: 'h_stand', house: 'hufflepuff', name: 'Loyal Stand', type: 'spell', cost: 2, count: 2,
      tags: ['charm'], text: 'Your allies take no damage this Voldemort turn.',
      flavor: 'Shoulder to shoulder, they would not break.',
      onPlay: [{ invuln: { target: 'all' } }] },
    { id: 'h_elves', house: 'hufflepuff', name: 'House-Elves of Hogwarts', type: 'spell', cost: 3, count: 2,
      tags: ['creature'], target: 'lane', text: 'Summon 3 House-Elves to a lane and drain 2 Morale. "FIGHT! FIGHT FOR MY MASTER!"',
      flavor: 'Kreacher led them, the locket of Regulus Black bouncing on his chest.',
      onPlay: [{ summon: { id: 't_elf', count: 3 } }, { morale: { n: 2 } }] },
    { id: 'h_resolve', house: 'hufflepuff', name: 'Hufflepuff Resolve', type: 'enchant', cost: 3, count: 1,
      tags: ['healing'], text: 'At the start of each of your turns: heal all your allies 1 and repair the Wards 1.',
      flavor: 'Steadfast, unswerving, and true.',
      triggers: [{ when: 'turnStart', effect: [{ heal: { n: 1, target: 'all' } }, { castleHeal: { n: 1 } }] }] },
    { id: 'h_pomfrey', house: 'hufflepuff', name: "Pomfrey's Care", type: 'spell', cost: 2, count: 2,
      tags: ['healing'], target: 'ally', text: 'Fully heal an ally and drain 1 Morale.',
      flavor: 'The matron of the hospital wing fears no battlefield.',
      onPlay: [{ heal: { n: 99, target: 'pick' } }, { morale: { n: 1 } }] },
    { id: 'h_together', house: 'hufflepuff', name: 'Stand Together', type: 'spell', cost: 1, count: 2,
      tags: ['charm'], target: 'lane', text: 'Allies in a lane each gain +1 ATK per ally in that lane this turn.',
      flavor: 'Loyalty is a force multiplier.',
      onPlay: [{ swarmBuff: { target: 'lane' } }] },
    { id: 'h_herbiv', house: 'hufflepuff', name: 'Herbivicus Vines', type: 'spell', cost: 2, count: 2,
      tags: ['plant'], target: 'lane', text: 'Entangle a lane: freeze it and deal 1 to each enemy there.',
      flavor: 'Roots erupt from the flagstones.',
      onPlay: [{ freezeLane: {} }, { damage: { n: 1, target: 'lane' } }] },

    /* ---------------- TOKEN ALLIES (summoned, never drawn) -------- */
    { id: 't_da', name: 'DA Defender', type: 'ally', token: true, hp: 2, atk: 1, tags: ['student', 'token'],
      text: 'A member of Dumbledore\'s Army.' },
    { id: 't_guardian', name: 'Stone Guardian', type: 'ally', token: true, hp: 4, atk: 2, guard: 1, tags: ['token'],
      text: 'Animated castle statue. Allies in its lane take 1 less damage.' },
    { id: 't_mandrake', name: 'Mandrake', type: 'ally', token: true, hp: 2, atk: 0, tags: ['plant', 'token'],
      text: 'When slain: deal 3 to all enemies in its lane (its cry is fatal).',
      triggers: [{ when: 'slain', effect: [{ damage: { n: 3, target: 'lane' } }] }] },
    { id: 't_raven', name: 'Conjured Raven', type: 'ally', token: true, hp: 2, atk: 1, tags: ['creature', 'token'],
      text: 'A flock-conjured bird.' },
    { id: 't_elf', name: 'House-Elf', type: 'ally', token: true, hp: 2, atk: 2, tags: ['creature', 'token'],
      text: 'Wielding kitchen knives and cleavers.' },
  ];

  /* =================================================================
   * VOLDEMORT'S ARMY — enemies the engine deploys against the players.
   * tier/minTurn/weight tune the escalating reinforcement pool.
   * ================================================================= */
  const ENEMIES = [
    { id: 'e_snatcher', name: 'Snatcher', enemy: true, hp: 2, atk: 1, speed: 1, morale: 1,
      tier: 1, minTurn: 1, weight: 4, tags: ['wizard'], text: 'Bounty hunters of the new regime.' },
    { id: 'e_deatheater', name: 'Death Eater', enemy: true, hp: 4, atk: 2, speed: 1, morale: 1,
      tier: 1, minTurn: 1, weight: 4, tags: ['wizard'], text: 'A masked servant of the Dark Lord.' },
    { id: 'e_acromantula', name: 'Acromantula', enemy: true, hp: 3, atk: 2, speed: 2, morale: 1, pairs: 2,
      tier: 1, minTurn: 2, weight: 3, tags: ['creature'], text: 'Fast. Pours from the Forbidden Forest in pairs.' },
    { id: 'e_darkwizard', name: 'Dark Wizard', enemy: true, hp: 5, atk: 3, speed: 1, morale: 2, ranged: true,
      tier: 2, minTurn: 4, weight: 3, tags: ['wizard'], text: 'Ranged: hurls curses at the Wards even past your defenders (Guard & shields soften them).' },
    { id: 'e_dementor', name: 'Dementor', enemy: true, hp: 4, atk: 2, speed: 1, morale: 1, dementor: true,
      tier: 2, minTurn: 4, weight: 3, tags: ['dark'], text: 'While at the gate, players gain 1 less Mana.' },
    { id: 'e_inferius', name: 'Inferius', enemy: true, hp: 6, atk: 1, speed: 1, morale: 1, reanimate: { hp: 3 },
      tier: 2, minTurn: 5, weight: 2, tags: ['undead'], text: 'When first slain, it rises again at the back.' },
    { id: 'e_troll', name: 'Mountain Troll', enemy: true, hp: 9, atk: 4, speed: 1, morale: 2, siege: true,
      tier: 2, minTurn: 6, weight: 2, tags: ['creature'], text: 'Siege: pounds the Wards even past your defenders; double damage on a true breach. Kill it fast.' },
    { id: 'e_giant', name: 'Giant', enemy: true, hp: 14, atk: 5, speed: 1, morale: 3, siege: true,
      tier: 3, minTurn: 8, weight: 2, tags: ['creature'], text: 'A wall-breaker. Siege: batters the Wards past defenders; double breach damage.' },

    /* ---- named lieutenants & the Dark Lord (boss insertions) ----- */
    { id: 'greyback', name: 'Fenrir Greyback', enemy: true, boss: true, hp: 13, atk: 5, speed: 1, morale: 18,
      bombard: true, healOnHit: 3, tags: ['werewolf'], text: 'Boss. Tears at the Wards past your defenders; heals 3 whenever he draws blood. Kill him fast.' },
    { id: 'bellatrix', name: 'Bellatrix Lestrange', enemy: true, boss: true, hp: 15, atk: 5, speed: 1, morale: 20,
      bombard: true, tags: ['wizard'], text: 'Boss. Hurls killing curses at the Wards even past your line (Guard & shields soften them).' },
    { id: 'nagini', name: 'Nagini', enemy: true, boss: true, hp: 12, atk: 4, speed: 2, morale: 22,
      bombard: true, healOnHit: 2, immuneFreeze: true, tags: ['horcrux'], text: 'Boss. Fast, immune to freezing; strikes the Wards directly and heals as she does.' },
    { id: 'voldemort', name: 'Lord Voldemort', enemy: true, boss: true, finalBoss: true,
      hp: 24, atk: 8, speed: 1, morale: 50, breach: 25, bombard: true,
      immuneFreeze: true, immuneControl: true, immuneExecute: true, armorPierce: true,
      tags: ['darklord'], text: 'The Dark Lord. Blasts the Wards past any defence; if he reaches the gate, they take 25. Repel him and the Dark Army breaks.' },
  ];

  /* ---- indexes & helpers ----------------------------------------- */
  const ALL = CARDS.concat(ENEMIES);
  const byId = {};
  ALL.forEach(c => { byId[c.id] = c; });
  function cardById(id) { return byId[id]; }

  // Build each house's starting deck as a flat array of card ids (copies).
  const HOUSE_DECKS = {};
  Object.keys(HOUSES).forEach(h => {
    const ids = [];
    CARDS.filter(c => c.house === h && !c.token).forEach(c => {
      for (let i = 0; i < (c.count || 1); i++) ids.push(c.id);
    });
    HOUSE_DECKS[h] = ids;
  });

  const DATA = {
    CONFIG, REGIONS, GROUNDS, HOUSES, TAGS, CARDS, ENEMIES, HOUSE_DECKS,
    cardById,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  global.HW = global.HW || {};
  global.HW.data = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
