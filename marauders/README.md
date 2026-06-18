# THE MARAUDERS

A co-op, **turn-based** Hogwarts exploration RPG. 1–4 friends (hot-seat, one
screen) play a team of students sneaking through dungeons that **rearrange
themselves every run** — find the House Cup hidden deep in the dark, pocket
what treasure you dare, and slip back out before the castle catches you.

Same house style as the rest of this repo: **vanilla JS, no build step, no deps.**
A pure DOM-free engine + a pure dungeon generator (both Node-`require()`-able, so
tests sweep seeds headlessly), and a canvas isometric renderer.

## Run

- **Play:** open `index.html`, or `node server.js` → http://localhost:8132
  (preview config name: `marauders`, port 8132). Kill the server when done.
- **Test (headless, Node):**
  - `node test/sim.js 40` — fuzz invariants on generated dungeons; a 30-seed
    **fairness sweep** (Cup, exit, secrets, treasure all reachable ON FOOT — no
    spell ever required); spell verbs / heist / catch / stealth-cone checks.
  - `node test/playthrough.js [seed]` — a bot plays one whole dungeon, logging
    every action. `--batch 20` plays 20 seeds and reports the win rate
    (gate: ≥50%; currently ~85–90%, mostly flawless).
  - Status: **all green.**

## How it plays

- **Freeform exploration, zero scripting.** Every dungeon is generated: rooms,
  corridors, torches, treasure, secret chambers, patrol routes. The world is
  dark until you light it; the minimap (top-left) fills in as you explore.
- **It's Hogwarts, not a maze:** every room is a named place (the Potions Store,
  the Forgotten Library, the Trophy Vault…) dressed with cauldrons, floating
  candles, house banners, moonbeams, armor and cobwebs; a house ghost drifts
  the halls; the HUD names where you're standing and entering a new room is
  announced. Props are pure set-dressing — never gameplay.
- **You always know the way home:** the exit is a glowing arched portal with a
  "Way Out" nameplate, permanently marked on the minimap — and the moment you
  take the Cup, the **Marauder's Map** traces a golden trail along the floor
  from the carrier back to the way out.
- **Controls that don't fight you:** click anywhere you've seen and the student
  travels there turn by turn (paths into the dark too) · WASD/arrows to step ·
  Space ends the turn · 1–3 cast spells · Esc cancels targeting · clicks during
  an animation fast-forward it.
- **Spells are optional tools, never required keys:** the spanning-tree corridors
  guarantee everything is walkable. Doors (Alohomora) and rubble (Reducto) gate
  *extra shortcut* corridors only; cracked walls (Revelio) hide bonus treasure
  chambers; Lumos trades visibility for being visible; Wingardium yeets a friend
  over the floor — even over a patrol.
- **Readable stealth:** patrol vision cones are painted on the floor (orange =
  watching, red = alerted). Spot → chase → hide works off real line-of-sight.
  Teammates are pass-through (squeeze past in corridors). Caught = −1 ⭐, sent
  back, briefly ignored by patrols (no spawn-camping), the Cup returns to its
  pedestal and the castle settles — House Points are a clean 3-attempt budget.
- **The heist arc:** sneak in → take the Cup → **the castle wakes** (red alarm,
  Filch rises, patrols quicken, sight widens) → dash back to the glowing way out.

## Architecture / performance notes

- `js/data.js` — CONFIG, tiles, spells, houses + the **dungeon generator**
  (`data.generate(seed)`, pure & deterministic; `scenarios.dungeon` = seed 7).
- `js/engine.js` — pure rules: turns, movement (ally pass-through), spells,
  stealth (cones/alert/chase), alarm/heist, treasure, House Points, `hint()`
  (ambient objective/danger only — never prescriptive).
- `js/ui.js` — the renderer. **Static-layer model:** tiles/walls/fog/light are
  drawn ONCE per game action to an offscreen canvas and blitted per frame;
  reachable tiles, spell markers, torch lists and the minimap are cached per
  action; animated glows are pre-rendered sprites. Frame work ≈ **1ms** (~60fps;
  the old per-frame BFS + ~250 gradients was the "7fps" cause). The rAF loop
  re-arms first and the move tween resolves outside the render try/catch, so a
  bad frame can never freeze input; errors surface in a red on-screen banner.
- `js/main.js` — title/intro; every New Game = `generate(random seed)`.
- `MAR.game`, `MAR.ui._state()`, `MAR.ui._clickTile(x,y)` — live debug handles.

## Next steps (candidate)

- **More dungeon variety:** chasm+bridge rooms, multi-floor stairs, themed zones
  (Forbidden Forest outdoors, Room of Requirement weirdness), rarer big rooms.
- **Quests beyond the heist:** rescue a friend, brew-and-fetch ingredients,
  multi-objective nights; a quest board hub.
- **A second patrol archetype** (Peeves: noisy, erratic) and difficulty knobs.
- **3–4 player parties** (markers '3','4' + loadouts already supported by data).
- **Save/resume** via `engine.snapshot()` → localStorage.
- **Real art** later via the repo's Nano-Banana pipeline (tilesets/portraits
  drop in over the canvas primitives).
- Online co-op is deferred; turn-based state syncs trivially when wanted.
