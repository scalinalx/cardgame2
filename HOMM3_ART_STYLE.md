# Heroes of Might & Magic III — Art Style Reference & Prompt Token

> An accurate, sourced characterization of the HoMM3 (1999, New World Computing / 3DO) visual style,
> plus a dense **drop-in style token** for image generators (pairs with `NANO_BANANA_2_PROMPTING.md`).
> Built from an adversarial-verification research pass (19 claims confirmed, 6 refuted).
>
> **Honesty note:** the *art-direction & production* facts below are well-sourced (mostly from
> development director **David Mullich's** first-person retrospective). The *color/lighting/UI-material*
> specifics are **informed extrapolation**, clearly flagged — they're consistent with the game but were
> not independently verified by a primary source.

---

## 1. The one-line answer

> **HoMM3 has TWO looks (confirmed against the real art).** ENVIRONMENTS (towns, interiors, the map) are **atmospheric late-1990s pre-rendered 3D** — detailed fantasy matte-painting scenes with **earthy naturalistic colour, rich material texture, and hazy depth.** CHARACTERS, creatures and key art are **dramatic, semi-realistic PAINTED fantasy illustration** in the heroic **Boris Vallejo / Frank Frazetta / New World Computing box-art** tradition, with **strong thematic colour** (heavenly blue+gold, infernal red+black, deathly green+bone) and **painterly drama** (glowing magic, backlight). Both are **rich, atmospheric and mature — never flat, cute, cartoon, anime, or photoreal-gritty.**

> ⚠️ **Earlier text-only guesses were wrong in telling ways:** "clean/smooth/Elmore-storybook" produced *cute cartoon*; the real HoMM3 is darker, deeper, more atmospheric and more dramatic than that. The canonical card prompts built from the real art live in **`CARD_ART_PROMPT.md`**.

---

## 2. Verified facts (what the style actually is)

**✅ "Extreme fantasy" — a deliberate art direction.** Development director David Mullich pushed the franchise *away* from Heroes II's **"cartoony" look** (which he felt "looked about five years behind the times") toward a semi-realistic, grown-up high-fantasy style he literally called **"extreme fantasy."** This is the single most important fact: **HoMM3 is deliberately NOT cartoony, NOT stylized-cute — it aims for painterly, serious high fantasy.**

**✅ Modeled on classic fantasy-illustration masters.** The team built mood boards from the painted work of **Boris Vallejo, Larry Elmore, and Rowena Morrill** — "picking out images of heroes, creatures and environments that captured the look we were going after." (This was *inspiration/reference*, not copying. Warhammer miniatures were a *minor supplementary* reference — do **not** call Warhammer the primary touchstone; that was refuted.) → For a generator, **these three painters are the gold-standard style anchors.**

**✅ Made by a large, skilled team.** Lead artist / art director **Phelan Sykes** (whom Mullich called the most talented artist at the company), assistant lead **Rebecca Riel**, a **~20-artist team**, producing **10,000+ pieces of art**. Other key names: illustrator **George Almond**, lead character animator **Adam McCarthy** ("created all of the main characters"), UI designer **Scott White**.

**✅ Technique = pre-rendered 3D → 2D sprites (a hybrid pipeline).** This is the crucial production fact and a common misconception: **HoMM3 is NOT hand-drawn pixel art, and it is NOT a real-time 3D game.** Creature/unit sprites and town structures were **modeled in 3D, rendered, and baked down into 2D animation frames** displayed in a 2D isometric engine. (It was the first HoMM to do this. Proof: the original 3D models were *lost* after 3DO's bankruptcy, so Ubisoft's HD remake had to hand-retouch the 2D sprites instead of re-rendering.) → So the look has a **slightly "rendered"/CG solidity** under a painterly finish — **avoid "pixel art" and avoid "flat vector," but also avoid "modern real-time 3D game screenshot."** (The exact 3D tool, e.g. 3DS Max, is **not** confirmed.)

**✅ Nine ornate per-faction town screens.** Castle, Rampart, Tower, Inferno, Necropolis, Dungeon, Stronghold, Fortress, Conflux — each a distinct, lavishly illustrated faction backdrop with its own identity. (Base game shipped 8; Conflux was added by the *Armageddon's Blade* expansion.)

**✅ Perceived as "clean, crisp, detailed, timeless."** *(medium confidence — this is reception, sourced to retrospectives + community.)* The art is widely held to have **aged well**, with **iconic, well-defined creature illustrations**. → Target **clean, crisp, detailed** — not muddy, not noisy.

---

## 3. Informed extrapolation (visually accurate, but not primary-sourced)

The research could **not** independently verify the following from an artist interview, so treat them as *my* by-eye characterization of the actual game — accurate to what's on screen, but not "proven":

- **Color:** rich, **warm, luminous, saturated-but-controlled** fantasy color with **strong per-faction identity**. **Idealized and vibrant — NOT muted, drab, washed-out, or grimdark.** (Critical for image-gen: pushing "restrained/muted/natural color" too hard makes output look like a *dreary realistic photo*, killing the fantasy. Keep it warm, glowing, and beautiful — just not neon.)
- **Lighting:** soft, even, fairly **bright** pre-rendered lighting; **polished and clear, not harsh, dark, or gritty**; strong figure-ground separation so every unit and detail reads clearly. (This is the big one for image-gen: HoMM3 is *legible and luminous*, NOT noir/chiaroscuro.)
- **Ornate UI chrome:** the interface frames are heavily **ornamented fantasy borders** — carved **stone and wood**, **gilded/metal** trim, **parchment** scrolls and panels, and **gem/jewel buttons**. (The materials are visually evident in-game but not confirmed by a sourced art description.)
- **Adventure map:** **isometric** terrain tiles — forests, mountains, swamps, lava, snow, dirt roads — dotted with resource piles, dwellings, and ornate map objects.

> Per-faction color cues (purely my extrapolation, for your 9 factions — verify by eye against screenshots):
> Castle = ivory/blue/gold heraldic; Rampart = emerald forest greens & silver; Tower = white/cyan/gold arcane; Inferno = lava red/black/orange; Necropolis = bone-grey/purple/sickly green; Dungeon = violet/black/teal subterranean; Stronghold = ochre/brown/blood-red barbarian; Fortress = murky swamp green/brown; Conflux = elemental multi-hue (fire-orange/water-blue/air-white/earth-brown).

---

## 4. What makes it instantly recognizable (and what to AVOID)

**Recognizable because:** painterly semi-realism (a step toward realism but still clearly illustration), high detail, saturated heroic color, the pre-rendered solidity of the sprites, and the lavish ornamented frames — all at once.

**To evoke it, AVOID:**
- ❌ "cartoony," "chibi," "cute," "stylized" (that's the look HoMM3 *rejected* — and HoMM2's feel)
- ❌ "pixel art," "8-bit," "16-bit sprite" (HoMM3 is pre-rendered, not pixelled)
- ❌ "3D render," "Unreal Engine," "real-time 3D," "modern game screenshot" (that's HoMM4/5/Olden Era, not 3)
- ❌ "flat vector," "minimalist," "cel-shaded," "anime"
- ❌ "gritty," "dark grimdark," "muted desaturated" (HoMM3 is polished and colorful)
- ❌ "dramatic lighting," "chiaroscuro," "deep/heavy shadows," "low-key," "firelit gloom," "moody/noir" — these **drown detail in shadow.** HoMM3 is **evenly, fairly brightly lit and fully readable.** For clean light, lead the painter trio with **Elmore** (bright/storybook), not **Vallejo** (dark/high-contrast).

---

## 5. The drop-in STYLE TOKENS

Paste one of these verbatim into a Nano Banana 2 prompt (as the `[STYLE]` slot, or the fixed style token in the asset-pipeline recipe in `NANO_BANANA_2_PROMPTING.md` §9). Remember NB2 wants **narrative description**, so these are written as prose, not tags.

### 5a. CHARACTER token (heroes, creatures, spells, events)
```
a richly detailed, semi-realistic fantasy oil painting in the heroic tradition of Boris Vallejo,
Frank Frazetta and the painted New World Computing box art of Heroes of Might & Magic III — mature,
atmospheric and dramatic, real anatomy and detailed armour, strong thematic colour and mood (cool
blue/gold for the holy, hot red/black for the infernal, sickly green/bone for the undead), glowing
magic and painterly drama; painted not photographed — not flat, simplistic, cute, cartoon, anime,
or a photo
```

### 5b. ENVIRONMENT token (towns, buildings, interiors, landscapes)
```
the atmospheric, detailed look of late-1990s Heroes of Might & Magic III town-screen and adventure
art — pre-rendered 3D fantasy environments like a detailed fantasy matte painting, earthy
naturalistic colour (greens, stone greys, warm timber and terracotta) with a few rich accents, hazy
atmospheric depth (misty mountains, soft haze), rich material texture (thatch, weathered stone,
timber, metal), soft diffuse hazy daylight; mature and grounded — not flat, simplistic, cute,
cartoon, or anime
```

### 5c. UI-CHROME token (for frames, panels, buttons, banners)
```
an ornate late-90s fantasy game UI in the Heroes of Might & Magic III style: carved dark wood and
weathered stone borders with gilded metal trim, aged parchment insets, and polished gemstone
buttons, richly detailed and painterly, front-on and seamless, not cartoony, not flat vector
```

### 5d. TOWN/ENVIRONMENT token (for backdrops & maps)
```
an isometric high-fantasy [town/landscape] in the Heroes of Might & Magic III style: painterly
semi-realistic, richly colored with strong faction color identity, ornate detailed architecture,
soft pre-rendered lighting, clean and crisp, late-1990s "extreme fantasy" illustration
```

---

## 6. Using it well with Nano Banana 2

- **Lead the prompt with the *subject*, end with the style token** (per NB2's `[Subject]+[Action]+[Location]+[Composition]+[Style]` structure). Example:
  > *A towering black dragon with obsidian scales and tattered wings, perched on a ruined battlement, three-quarter view — `[5a FULL token]`.*
- **⚠️ THE #1 TRAP — photoreal AI render instead of a clean illustration.** NB2's default is hyper-detailed photorealism. Avoid the words that trigger it: **"realistic," "true-to-life," "photographic," "pre-rendered / 3D model," "every detail sharp/legible," "4K/2K," "hyperdetailed."** Instead, *positively* force the **smooth, clean ILLUSTRATION** look: **"a clean smooth fantasy illustration / digital painting," "smoothly blended shading, soft gradients, clean edges," "simplified illustrated forms, not photographic detail," "soft diffuse light, low contrast," "smooth surfaces, no skin pores / fabric weave / sheen," "selective focus — only the nearest figures sharp, the rest softens into a clean simplified background."** Generate at **1K** (higher res adds micro-detail you don't want).
  - **⚠️ Do NOT over-swing into "oil painting / visible brushstrokes / loose paint" either** — HoMM3 art is **smooth and clean with NO visible brushwork or canvas texture.** Fight photoreal with *smoothness + "it's an illustration" + simplified forms*, not with brush texture.
- **⚠️ TRAP #2 — drab "dirty medieval photo" instead of magical fantasy.** Pushing "ordinary everyday life / candid / restrained muted natural color / semi-realistic" makes the model render **grimy, downtrodden peasant realism** with no wonder. Fix: positively assert an **enchanting, idealized, vibrant, magical** world — *"a place of wonder and magic, clean and luminous, rich warm color, gentle golden light, a soft glow of magic"* — and call it a **stylized fantasy illustration** (the further from "realistic," the better). HoMM3 is heroic, beautiful, idealized fantasy, NOT medieval grit.
- **⚠️ TRAP #3 — crunchy noise / over-sharpened digital artifacts.** Two causes: (a) **over-crowded scenes** (dozens of tiny figures/objects) pack the frame with high-frequency detail that turns to noise — **keep composition CLEAN and uncluttered, one clear focal subject, large readable shapes**; (b) **long "no texture / no pores / no noise / no sharpening" exclusion lists backfire** — autoregressive models tend to summon what you name. Beat artifacts with *positive* "smooth, clean illustration, large clear shapes" + a simpler scene + **1K resolution**, NOT with a pile of negations.
- **⚠️ TRAP #4 — anime / Studio Ghibli.** The words **"stylized," "idealized," "enchanting," "wonder," "magical glow"**, and stripping out ALL realism anchors, push the model into anime/manga. **HoMM3 sits in a narrow band: photoreal is too real, anime is too stylized — the target is semi-realistic *Western painted* fantasy.** Anchor it: **"Western, painterly, semi-realistic, natural human proportions, like the painted art of Larry Elmore / Boris Vallejo — not anime, manga, or cel-shaded."** Keep "renaissance painting naturalism" or "semi-realistic" in the prompt as the anti-anime ballast (it also doesn't go photoreal as long as "painting/illustration, not a photo" is present).
- **Lock the style across a whole set** by reusing **the exact same token** on every generation, and/or feeding back one approved image as a **style-reference image** ("match the art style of the reference").
- **Lead the painter anchor with Larry Elmore** (clean, bright, *painted* storybook look). Use Vallejo/Morrill only as secondary — Vallejo alone pulls dark + glossy-realistic.
- **If a result drifts, correct conversationally:** "make it looser and more painterly — visible brushstrokes, softer light, much less fine detail" beats restating the whole prompt.

---

## 7. Sources & confidence

**Primary (art direction & production):** David Mullich, *"The Tale of Heroes of Might & Magic III"* (davidmullich.com, 2014; republished on gamedeveloper.com/Gamasutra and heroes3wog.net). Corroboration: Wikipedia, Celestial Heavens, Might & Magic Fandom wiki, Adam McCarthy's portfolio, Archon Studio "Art of Might and Magic," The Spriters Resource.

**Confidence map:**
- **High:** "extreme fantasy" intent; Vallejo/Elmore/Morrill references; team & roster (Sykes/Riel/Almond/McCarthy/White); pre-rendered-3D-to-2D pipeline; nine ornate town screens; "not cartoony" pivot.
- **Medium:** "clean/crisp/timeless" reception.
- **Extrapolation (not primary-sourced):** specific palette/jewel-tones, lighting/contrast, per-faction color theory, exact UI frame materials (gilt/stone/wood/parchment/gem), hero-portrait production method, exact resolution/3D tool.

**Refuted (don't use):** "HoMM3 is 2D, not 3D" *(it's pre-rendered 3D baked to 2D)*; "in-engine low-poly 3D"; "Warhammer as the primary touchstone"; "instantly readable, clutter-free creature designs" as a sourced fact.
