# Nano Banana 2 — Prompting Bible

> A reusable, evidence-based reference for constructing excellent prompts for Google's
> **Nano Banana 2** image model. Built from a fan-out/adversarial-verification research pass
> (25 claims verified against Google first-party sources, 0 refuted). Hand this whole file to any
> LLM and it can build strong Nano Banana 2 prompts.
>
> **As of:** mid-2026. This is a fast-moving product — treat version numbers and access surfaces as
> time-sensitive; the *prompting principles* are stable.

---

## 0. TL;DR — the ten golden rules

1. **Describe a scene in natural prose. Do NOT write keyword/tag soup.** ("A simple list of keywords won't cut it; you need to describe the scene narratively." — Google.)
2. **Be hyper-specific.** Replace every vague noun with a described one: not "fantasy armor" but "ornate elven plate armor etched with silver-leaf patterns, a high collar, and pauldrons shaped like falcon wings."
3. **Follow a structure:** `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`.
4. **For edits, start with a strong verb** that names the operation: *Add / Remove / Change / Replace / Relight / Restyle.*
5. **Use real camera & lighting language** — it works: *low-angle shot, shallow depth of field at f/1.8, golden-hour backlighting, cinematic color grading with muted teal tones.*
6. **Iterate conversationally.** Don't chase the perfect one-shot prompt — generate, then make small follow-up edits ("make the lighting warmer"). This is Google's *officially recommended* workflow.
7. **Express exclusions POSITIVELY.** Never "no cars." Say "an empty, deserted street with no signs of traffic." (The model is autoregressive — naming an unwanted object tends to summon it.)
8. **Put in-image text in "quotes"** and specify the typography. For lots of text, *concept the words in chat first*, then ask for the image.
9. **Assign roles to reference images:** "Use Image A for the pose, Image B for the art style, Image C for the background."
10. **State the aspect ratio and resolution you want** (e.g., "3:4 portrait, 2K"). Defaults to 1K, 1:1-ish.

---

## 1. Identity & access (know what you're actually prompting)

"Nano Banana" is a **family of three** Google image models. Get the mapping right:

| Marketing name | Official model | Model ID | Tier |
|---|---|---|---|
| **Nano Banana 2** | **Gemini 3.1 Flash Image** | `gemini-3.1-flash-image` (`…-preview`) | Flash (fast) |
| Nano Banana Pro | Gemini 3 Pro Image | `gemini-3-pro-image` | Pro (max fidelity) |
| Nano Banana (original) | Gemini 2.5 Flash Image | `gemini-2.5-flash-image` | Flash |

- **Nano Banana 2 is Flash-tier** — fast, cheap, and in the Gemini app it *functionally replaces* Nano Banana Pro across the **Fast / Thinking / Pro** modes. **But Pro (Gemini 3 Pro Image) is still the higher-fidelity model** for the hardest jobs (dense infographics, maximum detail, complex multi-character composition). "Successor to Pro" is imprecise — think of NB2 as the fast workhorse, Pro as the premium option.
- **Timeline:** announced ~**Feb 26, 2026**; GA **May 29, 2026** (scoped via the Gemini Enterprise Agent Platform). Model IDs come in stable and `-preview` variants depending on surface.
- **Where to use it:** Gemini app, **Google AI Studio**, **Gemini API**, **Vertex AI**, Google Search (AI Mode / Lens), **Flow** (it's the new default image model there), and Google Ads. (Pro additionally: Google Workspace Slides/Vids, NotebookLM.)
- **Knowledge cutoff:** January 2025. **Every output carries a SynthID watermark + C2PA Content Credentials.**

**Picking Flash (NB2) vs Pro:** default to **NB2** for speed, iteration, and the vast majority of asset work. Reach for **Pro** when you need the absolute top of text legibility, infographic accuracy, or the most characters/objects held consistent in one frame.

---

## 2. The #1 principle — narrative, not keywords

Nano Banana descends from a *language* model, so it reads prompts like a creative brief, not a tag cloud. Google's guides are unambiguous: **"A simple list of keywords won't cut it; you need to describe the scene narratively,"** and **"The more detail you add, the closer the image will be to what you've imagined."**

> ❌ `wizard, fantasy, armor, dramatic, 4k, masterpiece, trending`
>
> ✅ `A weathered old wizard in ornate elven plate armor etched with silver-leaf patterns, standing on a windswept cliff at dusk, his staff raised as storm-light catches the falcon-wing pauldrons on his shoulders.`

**Specificity is the lever.** Every place you'd write a generic word, describe it instead:
- "a dog" → "a shaggy, mud-flecked Border Collie mid-leap, ears flying"
- "a castle" → "a black-granite mountain fortress with five spired towers and banners of crimson"
- "nice lighting" → "warm golden-hour backlight throwing long shadows across the courtyard"

Vague-prompt slang from other engines (`masterpiece`, `8k`, `trending on artstation`, `award-winning`) is mostly **noise** here — it adds little and can muddy results. Spend those words on real description instead.

---

## 3. Prompt structure (the templates that work)

### 3.1 Text-to-image formula
```
[Subject] + [Action] + [Location/context] + [Composition] + [Style]
```
- **Subject** — who/what, described specifically
- **Action** — what they're doing / the moment
- **Location/context** — where, the environment & atmosphere
- **Composition** — framing, camera angle, shot type, depth of field
- **Style** — the aesthetic / medium / art direction

**Example:**
> *A grizzled dwarven blacksmith [subject] hammering a glowing blade on an anvil, sparks flying [action], inside a torch-lit mountain forge with smoke curling toward a vaulted stone ceiling [location], shot from a low angle with a shallow depth of field that blurs the embers behind him [composition], in the style of a painterly high-fantasy oil illustration with warm rim-lighting [style].*

### 3.2 Six-component structure (for complex / Pro-grade work)
```
Subject · Composition · Action · Location · Style · Editing instructions
```
Same idea, with framing and explicit editing direction broken out. Use when a scene has many moving parts.

### 3.3 Editing — start with a verb
When modifying an existing image, **the first word should name the operation:**
- `Add a flock of birds to the sky on the upper-left.`
- `Remove the lamppost and seamlessly fill the background.`
- `Change the season to winter — snow on the rooftops, bare trees, cold blue light.`
- `Replace the wooden door with an iron portcullis.`
- `Relight the scene as if lit by a single candle from below.`
- `Restyle this photo as a charcoal sketch, keeping the composition identical.`

---

## 4. High-impact keyword vocabulary (a working palette)

These **measurably** change output (verified against Google's Pro guide & DeepMind). Weave them into the prose, don't list them raw.

**Camera & shot:** low-angle shot · high-angle / bird's-eye · eye-level · close-up · extreme close-up · wide-angle · panoramic · over-the-shoulder · Dutch angle · macro

**Lens & depth:** shallow depth of field · `f/1.8` (or any aperture) · bokeh · deep focus · 85mm portrait lens · 24mm wide lens · tilt-shift · fisheye

**Lighting:** golden-hour backlighting · long shadows · soft diffused light · hard directional light · rim light · chiaroscuro · volumetric god-rays · candlelight from below · overcast · neon · studio three-point lighting · blue-hour

**Color & grade:** cinematic color grading · muted teal tones · warm amber palette · desaturated · high-contrast · jewel-toned · monochrome · split-toning

**Composition:** rule of thirds · centered symmetry · leading lines · negative space · tight crop · full-body shot · headroom · foreground framing

**Medium / style:** oil painting · gouache · watercolor · charcoal sketch · 3D render · claymation · vector flat illustration · pixel art · cinematic photograph · matte painting · ink and wash · cel-shaded

**Mood:** ominous · serene · whimsical · epic · melancholic · heroic

> Rule of thumb: **2–5 well-chosen modifiers** woven into a described scene beats a pile of 20. Camera + lighting + a single clear style verb is usually enough to transform a result.

---

## 5. Signature capabilities (and exactly how to prompt them)

### 5.1 Multi-image fusion (blend several references)
Nano Banana 2 blends **many entirely unconnected reference images** into one new composition.
- **Capacity:** NB2 (Flash) — up to **10 object images + 4 character images**; Pro — up to **6 object + 5 character**; up to **~14 references** mixable total. **Practitioner note: fidelity is best at ≈6 references or fewer** — don't overload it.
- **Technique — assign each reference a role:**
> *"Combine these: use **Image A** for the character's pose, **Image B** for the art style, and **Image C** for the background environment. Produce a single cohesive illustration."*

### 5.2 Character & style consistency across generations
- Maintain the resemblance of **up to 5 characters (4 on Flash/NB2)** plus the fidelity of **up to 14 objects** in one workflow — including multiple characters together in a group.
- **To lock a character across a set:** provide a **character reference image** and refer to it; keep generating in the **same conversation**; describe the invariant traits every time ("the same red-haired knight with the scar over her left eye").
- **To lock a *style* across many assets:** supply one **style-reference image** and explicitly say "match the art style of the reference" on every generation, or carry it through a multi-turn chat. (See §9 for a full asset-pipeline recipe.)

### 5.3 In-image text & typography
Nano Banana is best-in-class at legible text — if you prompt it right:
1. **Put the exact words in quotes:** `a poster with the title "CONQUEST OF ERATHIA"`.
2. **Specify the typography:** `in a bold, white, sans-serif font` / `Century Gothic, 12px` / `ornate blackletter gold lettering`.
3. **Text-first hack (for lots of text / when accuracy matters):** *first* have a normal chat turn where the model drafts/refines the wording, *then* ask it to render the image containing that finalized text. This dramatically cuts misspellings.
4. **Translate/localize:** write the prompt in one language and name the target language for the rendered text.

### 5.4 Resolution & aspect ratio
- **Resolutions:** `512px (0.5K)` · `1K` (default) · `2K` · `4K`. The 512px floor is a Flash/NB2 addition (Pro starts at 1K).
- **Aspect ratios (API enums):** `1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9`. **NB2 adds extreme ratios: `1:4, 4:1, 1:8, 8:1`** (great for banners/skyscrapers).
- **Cinematic ratios** (1.85:1, 2.39:1, etc.) aren't discrete enums — get them by **prompt-driven reframing** ("reframe to a 2.39:1 cinematic widescreen crop").
- **Just say it in the prompt:** `…, 3:4 portrait orientation, rendered at 2K.`

### 5.5 Conversational / multi-turn editing (the recommended workflow)
Google: **"Chat or multi-turn conversation is the recommended way to iterate on images."** Don't perfect one prompt — generate a base, then issue **small, targeted follow-ups**:
> `Make the lighting warmer.` → `Now change her expression to be more serious.` → `Add a faint magical glow to the staff.`

Context is retained across turns. (API note: *thought signatures* carry the cross-turn state and are auto-handled by the official SDKs — keep them if you build raw API calls.)

---

## 6. Advanced techniques

- **Positive (semantic) negative prompting** — to *exclude*, describe the desired state positively. Not `no people` → say `a silent, completely empty plaza at dawn`. Not `no text` → say `a clean, unmarked surface`.
- **Targeted local edits / inpainting** — name the region and the change precisely: `Change only the sky to a stormy sunset; keep everything else identical.` Pair "change only X" with "keep everything else identical" to protect the rest of the frame.
- **Preserve identity across edits** — restate the identity every turn (`the same character`) and make one change at a time; long edit chains drift, so re-anchor with the reference image if the face starts to slip.
- **Relighting** — `Relight this scene with cool moonlight from the left, deep shadows on the right, keeping the composition and subject unchanged.`
- **Style transfer** — `Render this scene in the art style of the attached reference image` (supply the style image).
- **Real-world grounding** — Pro especially uses Gemini's reasoning/world-knowledge for accurate diagrams, infographics, maps, and labeled illustrations. Ask it to "lay out an accurate infographic of X with labeled callouts."

---

## 7. Failure modes & fixes

| Symptom | Cause | Fix |
|---|---|---|
| Misspelled / garbled text | Too much text in one shot | Quote the words; **concept the text in chat first**, then render; reduce word count; bump to 2K/Pro for small type |
| The thing you said "no" to appears | Autoregressive model summons named objects | Re-write the exclusion **positively** (§6) |
| Identity drifts over many edits | Long edit chains accumulate error | Re-anchor with the character reference image; restate invariant traits; change one thing per turn |
| Instructions ignored / muddy result | Conflicting or vague style directions; keyword soup | Cut to one clear style; convert tags → described scene; split into sequential edits |
| Flat / generic output | Under-specified prompt | Add subject detail + camera + lighting; name a concrete medium/style |
| Over-busy / cluttered | Too many modifiers or references | Trim to ≤5 modifiers and ≤6 references; simplify the scene |

---

## 8. Before / after examples

**A — basic → specific**
- ❌ `a knight in a forest`
- ✅ `A young knight in dented steel plate, kneeling exhausted beside a mossy standing stone in a misty pine forest at first light, shafts of pale sunlight breaking through the canopy, shot at eye level with a shallow depth of field, painterly high-fantasy oil illustration.`
- *Why:* concrete subject + moment + atmosphere + camera + named style give the model a real target instead of a category.

**B — keyword soup → narrative**
- ❌ `dragon, mountain, epic, fire, 8k, masterpiece, cinematic`
- ✅ `A colossal red dragon coiled around a snow-capped mountain peak, roaring as fire spills from its jaws into a bruised twilight sky, seen from a dramatic low angle with the village far below for scale, cinematic color grading, volumetric light through the smoke.`
- *Why:* `8k/masterpiece` are noise; the rewrite spends those words on composition, scale, and light.

**C — negative → positive**
- ❌ `a city street, no cars, no people`
- ✅ `A silent, deserted city street at dawn, wet cobblestones reflecting the pink sky, not a single car or pedestrian in sight, long soft shadows.`
- *Why:* positive framing of the emptiness, so the model paints absence instead of conjuring the named objects.

**D — one-shot → conversational edit**
- Turn 1: `A regal elven queen on a throne of living wood, full-body, painterly fantasy portrait, 3:4.`
- Turn 2: `Make her gown deep emerald instead of blue.`
- Turn 3: `Add a faint golden crown and warm candlelight from the left.`
- *Why:* small targeted edits converge faster and more reliably than one giant prompt.

---

## 9. Recipe — consistent game / fantasy art assets (card art, portraits, UI chrome)

This is the workflow for producing a **cohesive set** (e.g., a deck of cards, a faction's hero portraits, matching UI frames).

**Step 1 — Lock a style token.** Write one dense **style descriptor** sentence and reuse it verbatim in *every* prompt (see the companion `HOMM3_ART_STYLE.md` for a ready-made one). Optionally generate one "hero" image you love and use it as a **style-reference image** on subsequent gens.

**Step 2 — Use a fixed template per asset type.** Keep everything constant except the subject:
> *`[STYLE TOKEN]`. A `[creature/hero]`, `[described appearance]`, `[pose/action]`, centered three-quarter view, neutral dark background, consistent rim-lighting, 3:4 portrait, 2K.*

**Step 3 — Hold characters consistent** by supplying the same character reference image and restating invariant traits; keep a faction's set within one conversation so style carries.

**Step 4 — Card layouts & text.** Generate the **art** and the **frame/typography** in stages: art first, then "Add an ornate gold card frame with the title `"BLACK DRAGON"` in blackletter at the bottom" — or composite text in your own layout layer for pixel-perfect control (in-image text is strong but a real layout engine is exact).

**Step 5 — UI chrome (frames, buttons, banners).** Describe the material and ornament precisely: *"an ornate gilded fantasy UI panel of carved dark oak and hammered bronze, gemstone rivets at the corners, parchment inset, seamless tileable border, flat front-on view, transparent background."* Use the extreme aspect ratios (`8:1`, `1:8`) for bars and side-rails.

**Step 6 — Iterate, don't restart.** Refine each asset with small follow-up edits; re-anchor to the style reference whenever drift creeps in.

> Practitioner caveat: the asset-pipeline specifics (Steps 2–5) come from community testing, not Google docs — treat them as strong heuristics and verify by eye. The *backbone* (narrative prompts, role-assigned references, consistency limits, multi-turn editing, positive framing) is all from Google first-party guidance.

---

## 10. Copy-paste skeletons

**Single illustration**
```
A [specific subject with described appearance], [doing a specific action], in [described
location/atmosphere], [camera angle + shot type + depth of field], [lighting], [named art style
or medium], [color/mood]. [Aspect ratio], [resolution].
```

**Edit (existing image attached)**
```
[Verb: Add/Remove/Change/Replace/Relight/Restyle] [the specific element], [how exactly].
Keep everything else identical.
```

**Multi-reference fusion**
```
Combine the attached references into one cohesive image: use Image A for [role], Image B for
[role], Image C for [role]. [Describe the desired final scene]. [Style], [aspect ratio].
```

**In-image text / poster**
```
A [layout/medium] with the headline "[EXACT TEXT]" in [typography], and [secondary text] in
[typography]. [Scene/background], [style], [aspect ratio].
(If lots of text: first ask the model to draft and finalize the wording, THEN request the image.)
```

**Consistent asset in a set**
```
[FIXED STYLE TOKEN]. [Subject for THIS asset, described], [fixed pose/framing], [fixed
background], [fixed lighting], [fixed aspect ratio + resolution]. Match the attached style reference.
```

---

## 11. Sources (first-party unless noted)

- blog.google — *Introducing Nano Banana 2 (Gemini 3.1 Flash Image)*
- cloud.google.com — *Nano Banana 2 and Nano Banana Pro are generally available* (May 29 2026)
- cloud.google.com — *Ultimate prompting guide for Nano Banana*
- ai.google.dev — *Gemini API: Image generation* docs
- deepmind.google — *Gemini Image (Pro)* model page & *prompt guide*
- blog.google — *Prompting tips for Nano Banana Pro*
- docs.cloud.google.com — *Gemini image generation best practices* / Vertex AI *Image prompt guide*
- developers.googleblog.com — *How to prompt Gemini 2.5 Flash Image for the best results*
- Practitioner (blog-tier, for asset pipelines/consistency): atlabs.ai, wavespeed.ai, chasejarvis.com, apiyi face-consistency guide, medium.com/google-cloud, nanoprompts.org, roboticape.com, prompting.systems

**Caveats:** Fast-moving product — version IDs/availability will shift; prompting principles are stable. Capability numbers differ by tier (Flash NB2 vs Pro). A few techniques (positive framing, text-first hack, iterate-and-refine) originate in the original Nano Banana guide but are confirmed to carry forward. Verified set: **25/25 claims confirmed, 0 refuted.**
