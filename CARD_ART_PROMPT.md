# Conquest of Erathia — Card Art Prompts (canonical)

> Two Nano Banana 2 prompts, rebuilt **from the real HoMM3 reference art** (not text guesswork).
> HoMM3 has two visual registers — use the matching prompt for the card type.
> Pairs with `HOMM3_ART_STYLE.md` (the why) and `NANO_BANANA_2_PROMPTING.md` (the how).

## Hard rules (both prompts)
- **No border/frame, no text or lettering** — full-bleed art only (frames + titles are added later in the card layout).
- **Generate at 1K** (higher res adds the crunchy over-sharpened noise).
- **Rich, atmospheric, mature, painterly** — never flat, cute, cartoon, anime, simplistic, or photoreal-gritty.

---

## PROMPT A — Environments (towns, buildings, interiors, landscapes)
Use for: Structures / town buildings, dwellings, terrain, map locations, "place" cards.

```
A game-card illustration of a place in a high-fantasy medieval world (the realm of Erathia) — a
town, village, castle, market, hall, forge, mage tower, temple, harbour, farmland, or wild
landscape. Let the subject vary widely, from a grand sweeping vista of a town and its valley to a
closer, atmospheric corner of a street or building.

The scene is alive and immersive with real atmospheric depth — misty mountains and hazy distance,
soft drifting haze, layered foreground, midground and background, a believable sense of place and
scale.

Colour is grounded and naturalistic — earthy greens, stone greys, warm timber browns and terracotta
roofs — lifted by a few rich signature accents (heraldic banners, a glow of magic). Soft, diffuse,
slightly hazy daylight with gentle shadows. Rich, tactile material texture: thatch, weathered stone,
aged timber, metal.

Style: the atmospheric, detailed look of late-1990s Heroes of Might & Magic 3 town-screen and
adventure art — pre-rendered 3D fantasy environments, like a detailed fantasy matte painting, mature
and grounded. Painted/rendered, not a photograph — not flat, simplistic, cute, cartoon, or anime.

Full-bleed illustration, no border or frame, no text or lettering. Natural colour and contrast, not
oversaturated; soft detail, not oversharpened.
```

---

## PROMPT B — Characters, creatures, heroes, spells, events
Use for: heroes, creatures/dragons, spell cards, combat/quest moments, dramatic events.

```
A game-card illustration of a hero, creature, or dramatic moment in a high-fantasy medieval world
(the realm of Erathia) — e.g. a knight, wizard, elf, angel, demon, dragon, beast, a spell being
cast, a clash, an oath, a death. A single striking subject or a small, dynamic scene, heroic and
full of presence, drawing you into the world.

Strong thematic colour and mood to fit the subject — cool blues, gold and white light for the holy;
hot reds, orange and black for the infernal; sickly greens, bone and moonlight for the undead; warm
earthy tones for the wild. Painterly drama: glowing magic, dramatic backlight, soft atmospheric haze
or smoke, strong but believable contrast.

Style: a richly detailed, semi-realistic fantasy oil painting in the heroic tradition of Boris
Vallejo, Frank Frazetta and the painted New World Computing box art of Heroes of Might & Magic 3 —
mature, atmospheric and dramatic, with real anatomy and detailed armour. Painted, not photographed —
not flat, simplistic, cute, cartoon, anime, or a photo.

Full-bleed illustration, no border or frame, no text or lettering. Natural colour and contrast, not
oversaturated; rich detail, not oversharpened.
```

---

## Per-card toggles (append one line, optional)
- Framing: `· grand sweeping vista` / `· intimate close moment` / `· interior`
- Mood/light: `· golden afternoon` / `· overcast and misty` / `· stormy` / `· moonlit night` / `· dawn`
- Theme accent: `· heavenly` / `· infernal` / `· deathly` / `· arcane` / `· wild`

## Best practice
- **Reuse the same prompt + style wording verbatim** across a set so the deck looks like one world.
- **Even better — use a reference image.** Drop one of the real HoMM3 screenshots (or an approved generation) into Nano Banana 2 and add *"match the art style of this reference."* A reference locks the look far more reliably than words.
- **Iterate conversationally**, e.g. *"push more atmospheric haze and depth,"* *"make the colour earthier,"* *"more painterly, less sharp"* — don't restart from scratch.

## The hard-won do/don't (why these prompts are worded this way)
- ❌ "stylized / idealized / enchanting" → **anime**.  ✅ "semi-realistic, Vallejo/Frazetta, real anatomy."
- ❌ "clean / smooth / simple / flat shapes" → **cute cartoon**.  ✅ "richly detailed, atmospheric, painterly."
- ❌ "realistic / photo / modern 3D render / 4K / hyperdetailed" → **gritty photoreal noise**.  ✅ "painted, 1K, soft detail" (note: HoMM3 *environments* genuinely are *atmospheric late-90s pre-rendered 3D* — that phrasing is fine; "modern photoreal render" is not).
- ❌ long piles of "no texture / no noise / no pores" → autoregressive models **summon** what you name.  ✅ few positive anchors + a simpler scene.
- ✅ The missing magic was **atmospheric depth + haze + grounded earthy colour** (environments) and **thematic dramatic colour + painterly drama** (characters).
