# The Battle of Hogwarts — The Last Stand

A local, **co-op melee siege deckbuilder** for **1 or 2 allied players** (hot-seat,
one screen). Voldemort's army musters at the treeline and marches on the castle through a
**funnel of regions**; you choose a House, raise defenders, and hold the line — where your
units meet the horde they **trade blows** (both sides take damage and can fall). No install,
no build step, no internet — plain HTML/CSS/vanilla JS.

> Gameplay & look adapted from the `Hogwarts Siege.html` prototype (region funnel + melee),
> rebuilt into this vanilla, DOM-free, Node-testable engine with all four Houses, full decks,
> difficulty levels, and solo/co-op. The prototype file is kept for reference.

> A sibling project to *Conquest of Erathia* in the parent folder, built with the same
> philosophy: a DOM-free, data-driven engine that also runs headless under Node.

---

## How to run

**Just open it.** Double-click `hogwarts/index.html` (runs from `file://`).

**Or a tiny static server** (if your browser is strict about `file://`):
```bash
node hogwarts/server.js          # → http://localhost:8131
```

---

## How to play

**The field — a funnel.** Foes muster in **The Forbidden Forest**, then march down one of
three **Grounds** (Quidditch Pitch · Covered Bridge · Hagrid's Grounds) → the **Courtyard**
→ the **Great Gate**; beyond the gate they breach the **Wards**. You deploy **Allies** into
any region: hold the Grounds to intercept early per-lane, or stack the Courtyard/Gate
chokepoints where everything funnels. Each foe shows its **intent** (STRIKE/DRAIN/ADVANCE/
SMASH); the top bar previews who is **mustering** next.

**A round.** Each player takes a turn, then **Voldemort's army resolves**:
1. **The Horde Advances** — every foe marches one region closer (frozen foes skip); any that
   pass the gate breach the **Wards** (siege foes hit twice as hard).
2. **Battle is Joined** — in every region you share with foes, a **melee** is fought
   *simultaneously*: your allies and the foes strike each other at once, and **both sides can
   die**. Guard softens hits; an *intangible* ally (the Grey Lady) takes none.
3. **Out of the Darkness** — fresh foes emerge from the forest (the wave grows over the
   siege), plus scheduled **lieutenants** and finally **Lord Voldemort** himself.

Voldemort's turn is **revealed beat by beat** over the live, updating board — you watch each
phase resolve with a caption of exactly what happened, and step through it (or Skip).

**Your turn.** You get **Mana** and draw up to 5 cards. Mana **ramps over the siege** —
3 to start, +1 every 2 rounds up to 7 — so your big 4–5 cost cards come online as the
assault escalates. Spend Mana to:
- **Deploy Allies** (tap a region), **cast Spells** (blast, freeze, push back, control,
  execute, heal, drain Morale), and play **Enchantments** (persistent effects).
- Invoke your **House Power** once per turn.

Your deck (~22–25 cards) **recycles**: when your draw pile runs out, your discard reshuffles
back in — you never run out (allies you deploy stay on the board).

**Win / Lose.**
- **You win** when the Dark Army's **Morale** falls below **30%**. Rank-and-file kills barely
  dent it — it's **repelling the named lieutenants and Voldemort himself** (huge Morale hits)
  that breaks the army. So you must *survive the siege* long enough to bring the bosses down.
- **You lose** when Hogwarts' **Wards** fall below **30%** — kill foes before they pass the
  gate, and bring siege units (Trolls, Giants) down before they batter the walls.

> ⚠️ It's a true siege of attrition: your units die in the melee, the horde keeps coming, and
> the Wards are always under threat. Hold the funnel, mend the walls, heal/replace your line,
> and break the Dark Lord's champions.

**Difficulty.** Pick **Standard / Hard / Legendary** at setup — it scales the whole threat
(wave size, enemy HP/ATK, boss HP). One player should start on Standard; **two coordinated
players will likely want Hard or Legendary** (two decks are far more than twice as strong, so
the horde has to be far bigger to make the castle sweat).

---

## The four Houses

Each House is its own deck plus a unique **House Power** (two players may pick the same
House — each gets their own copy, they don't share).

| House | Identity | Power |
|---|---|---|
| 🦁 **Gryffindor** — *Courage* | Aggression & frontline valour | **Sword of Gryffindor**: 4 dmg to any enemy + 2 Morale |
| 🐍 **Slytherin** — *Cunning* | Control, debuffs, Morale drain, Imperio | **Serpent's Coil**: push a whole region back 2 |
| 🦅 **Ravenclaw** — *Wit* | Cheap spells, card flow, combo payoffs, shields | **Lost Diadem**: draw 2 |
| 🦡 **Hufflepuff** — *Loyalty* | Healing, ward repair, durable bodies, plants/swarms | **Rally the Hufflepuffs**: heal allies 2 + repair Wards 3 |

Voldemort's army escalates from Snatchers and Death Eaters through Dementors, Inferi,
Trolls and Giants, with named lieutenants — **Fenrir Greyback, Bellatrix Lestrange,
Nagini** — and the climactic arrival of **Lord Voldemort**.

---

## Project layout

```
index.html        page shell, loads the scripts (no bundler)
css/styles.css    dark castle-siege theme, house-coloured accents
js/data.js        ALL game data: config knobs, the region funnel, 4 Houses, ~70 cards,
                  the enemy roster, and the effect vocabulary (documented at top)
js/engine.js      pure rules engine (no DOM); also runnable under Node
js/ui.js          DOM rendering + interaction (targeting, hot-seat handoff, Voldemort phase)
js/main.js        bootstrap
server.js         minimal no-dep static server (port 8131)
test/sim.js       headless fuzz: many random full games, asserts invariants
test/balance.js   sensible-bot win-rate read per House (1p / 2p)
```

The engine is deliberately data-driven: cards are plain objects using the small effect
vocabulary at the top of `data.js`, so new cards/enemies are easy to add. Every balance
number lives in `CONFIG` (top of `data.js`) or as inline knobs.

## Testing
```bash
node test/sim.js 1000     # 1000 random complete games; checks all invariants
node test/balance.js 200  # per-House win rates under a heuristic ("sensible") bot
```
`sim.js` verifies the Wards/Morale stay in range, no negative mana, enemies stay on their
tracks, allies never exceed max HP, and every game reaches a valid finish.

## Notes / scope
- It's a **co-op** game: in 2p both players share the Wards and the enemy Morale, but each
  has their own deck, hand, and Mana. Waves and bosses scale up for two defenders.
- Balance is tuned but a first pass — bot win-rates are a noisy proxy (combo Houses like
  Ravenclaw need real piloting). Tune via the knobs in `data.js`; real play is the test.
