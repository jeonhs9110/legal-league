# Gemini prompt pack — Legal League brand assets

Prompts for generating the visual assets the site is currently faking. Written
against the live design tokens: strict grayscale (`hsl(0 0% X%)`, zero saturation),
background `hsl(0 0% 4%)` = `#0A0A0A`, liquid-glass surfaces, Poppins 500 with
Source Serif 4 italic accents.

Use Gemini image generation (Gemini 2.5 Flash Image / Imagen, whichever is current
in AI Studio) for stills, and Veo for the video loop. Paste the prompt block
verbatim, then iterate on one variable at a time.

---

## Read this before you generate a logo

Two constraints that decide how you use the output:

1. **Image models cannot draw a clean wordmark.** Letterforms come out warped,
   with phantom serifs and broken kerning, and it gets worse at small sizes.
   Generate the **symbol only**. Set the word "legal league" yourself in Poppins —
   which is already loaded on the site and licensed for it.
2. **A purely AI-generated logo is weak intellectual property.** The US Copyright
   Office refuses registration for works without human authorship, and several
   trademark offices ask who authored the mark. A mark you cannot register is a
   mark a competitor can copy. Treat these prompts as *exploration*: generate 30
   directions, pick one, then have a human redraw it as vector geometry. The
   redraw is what you file. Cheap insurance for a business whose whole pitch is
   institutional credibility.

---

## 1. Primary brand mark — three concepts

Generate all three, pick a direction, then refine. Every prompt ends with the
same technical block, since that is what makes the output usable.

### Concept A — Meridian Balance

> A minimalist geometric logo mark centered on a flat pure-black background. The
> mark combines a balance scale with a wireframe globe: a single vertical beam
> with a small filled circle at its apex, crossed by a horizontal crossbar that
> curves gently downward like a line of longitude on a sphere. Two shallow
> triangular pans hang from the ends of the crossbar by single straight lines. A
> short horizontal base anchors the beam. Drawn entirely in thin, perfectly even
> pure-white strokes of uniform weight, approximately 3 units wide on a 64-unit
> square grid, with rounded caps and rounded joins. Flat 2D vector icon, no
> perspective, no depth, perfectly symmetrical about the vertical axis, generous
> even negative space on all sides.

### Concept B — Open Aperture

> A minimalist geometric logo mark centered on a flat pure-black background.
> Twelve thin white line segments of equal length radiate from an implied circular
> center, arranged like the blades of a camera aperture or the meridians of a
> globe seen from above, each segment stopping short of the middle to leave a
> clean circular void at the center. Three of the segments are noticeably longer
> than the rest, breaking the perfect symmetry to suggest ranking and hierarchy.
> Pure white strokes of uniform weight on a 64-unit grid, rounded caps, flat 2D
> vector construction, no perspective, no shading, radially balanced with generous
> negative space.

### Concept C — Ledger J

> A minimalist geometric monogram of the single letter J, centered on a flat
> pure-black background. The letter is constructed from three straight
> architectural strokes and one quarter-circle hook at the bottom, drawn in thin
> pure-white lines of uniform weight, rationalist and grid-built rather than
> calligraphic. Three short horizontal rules of decreasing length sit stacked to
> the right of the vertical stem, evoking entries in a ledger or ranked rows in a
> table. Flat 2D vector construction on a 64-unit grid, rounded caps, no
> perspective, no shading, generous negative space.

### Technical block — append to any of the three

> Monochrome only, pure white on pure black, zero color saturation. Icon design
> intended to remain legible when reduced to 16 by 16 pixels. Square 1:1 composition
> with the mark occupying the central 70 percent of the frame.
>
> Negative prompt: no text, no letters, no words, no numbers, no wordmark, no
> gradient, no drop shadow, no glow, no bevel, no 3D render, no photorealism, no
> texture, no noise, no color, no gavel, no courthouse columns, no Lady Justice
> statue, no blindfold, no laurel wreath, no shield, no eagle, no mockup, no
> business card, no watermark, no signature, no frame, no border.

To explore fast, append: *"Present 6 distinct variations of this mark arranged in
a 3 by 2 grid, evenly spaced, each on the same flat black background."* Then
regenerate your favorite on its own for the clean version.

**Why the negatives matter:** gavels, Lady Justice, and laurel wreaths are the
default output for anything law-adjacent, and every competitor already uses them.
Gavels are also not used in Korean or most civil-law courts, which reads as
provincial on a global directory.

### Turning the output into `logo.svg`

The site wants vector, not PNG. After picking a direction:

1. Threshold the PNG to pure black and white, then trace it (Illustrator Image
   Trace, or `potrace` on the CLI) — or better, redraw the geometry by hand.
2. Save as SVG with `fill="none"` and `stroke="currentColor"` so the mark inherits
   text color instead of hardcoding white.
3. Overwrite `frontend/public/logo.svg`. No code change needed — it is already
   referenced at 32×32 in the nav.

---

## 2. Favicon / app icon

The nav mark is too fine-lined to survive a browser tab. Generate a solid variant:

> A minimalist app icon on a flat dark charcoal background of hex color 0A0A0A,
> filling the entire square frame edge to edge with no padding around the
> background itself. Centered within it, a bold simplified white glyph derived
> from a balance scale — a single thick vertical stem with a wide horizontal
> crossbar and a small filled circle at the apex — drawn in solid pure white with
> stroke weight roughly three times heavier than a typical line icon, so it stays
> readable at 16 pixels. Flat 2D vector, geometric, perfectly centered, occupying
> the central 60 percent of the frame. Square 1:1.
>
> Negative prompt: no text, no letters, no gradient, no shadow, no glow, no 3D, no
> rounded-rectangle app frame, no color, no fine detail, no thin lines.

Export at 512×512, then generate the favicon set from it.

---

## 3. Social share image (Open Graph, 1200×630)

Generate the **background only** — add the headline yourself in HTML or Figma,
where the type will be correct.

> A wide cinematic abstract background, 1200 by 630 pixels, in strict grayscale
> with zero color saturation. A dark charcoal field of hex color 0A0A0A occupies
> most of the frame. Emerging from the right third, a translucent wireframe globe
> rendered as fine white latitude and longitude lines at low opacity, softly out
> of focus, as though seen through frosted glass. Diffuse soft white light blooms
> from the upper left and falls off smoothly into deep shadow at the lower right,
> leaving the left half of the frame dark, clean, and almost empty for text
> overlay. Subtle fine-grain film noise across the whole image. Restrained,
> institutional, editorial mood — the visual language of a financial terminal or a
> serious research publication, not a technology advertisement.
>
> Negative prompt: no text, no letters, no logos, no watermark, no people, no
> hands, no faces, no color, no blue tint, no orange tint, no neon, no lens flare,
> no glossy 3D render, no stock-photo businesspeople, no scales of justice, no
> gavel, no courtroom, no busy detail on the left half.

---

## 4. Background video loop (Veo)

Optional. The current backdrop is generated in CSS with zero bandwidth cost. A
video looks richer but is the single most expensive thing you can put on a Vercel
free plan, since every visitor downloads the whole file. If you use one: cap it at
**6 MB**, 1920×1080, H.264, 10 seconds, and add a poster frame.

> A slow, hypnotic, seamlessly looping abstract background in strict monochrome
> grayscale. Dense volumetric smoke or ink drifts through absolute darkness,
> illuminated by a single soft key light from the upper left that catches only the
> leading edges of the plumes, leaving deep pure-black shadow across most of the
> frame. The motion is extremely slow and continuous with no cuts, no camera
> shake, and no sudden changes in brightness — a gentle rightward drift with a
> faint parallax as nearer wisps pass in front of farther ones. Shallow depth of
> field with the foreground softly out of focus. Fine 35mm film grain throughout.
> Overall exposure stays dark and even so that white text placed on top remains
> readable at all times. Elegant, restrained, meditative, austere. 16:9, cinematic,
> 24fps.
>
> Negative prompt: no color, no colored light, no blue or orange tint, no text, no
> logos, no people, no faces, no hands, no objects, no recognizable shapes, no fast
> motion, no strobing, no flashing, no bright flares, no camera shake, no zoom, no
> hard cuts, no scene changes, no watermark.

**Loop it properly.** Veo output rarely loops seamlessly on its own. Either
crossfade the last second into the first in an editor, or mirror the clip
(forward + reversed) for a guaranteed loop — the reverse is undetectable on
smoke-like motion.

**Wiring it in.** `frontend/src/components/hero/Backdrop.tsx` currently renders the
CSS gradient. Put the file at `frontend/public/backdrop.mp4` and swap the drift div
for `<video src="/backdrop.mp4" autoPlay loop muted playsInline poster="/backdrop-poster.jpg" className="absolute inset-0 h-full w-full object-cover" />`. Keep the
gradient div underneath as the fallback for `prefers-reduced-motion` and slow
connections.

**Keep the provenance.** The reason the original CDN video was removed is that
nobody could say where it came from. Save the prompt, the model name, the
generation date, and the terms you generated under alongside the file, so this one
has a paper trail. See [LICENSES.md](../LICENSES.md).

---

## 5. Optional — methodology diagram source

For the methodology page. Generate the illustration *style*, not the diagram
itself; real diagrams should be SVG so the labels are selectable text.

> A minimal technical schematic on a flat dark charcoal background of hex color
> 0A0A0A, drawn entirely in thin white lines at varying opacity with no fills.
> Three small rounded rectangles on the left connect by gently curved lines to a
> single circular node in the center, which in turn connects to a vertical stack of
> four short horizontal bars on the right that decrease in length from top to
> bottom, like a ranked list. Isometric-free, flat, front-facing, evenly spaced,
> generous negative space, engineering-drawing precision. Wide 16:9 composition.
>
> Negative prompt: no text, no labels, no numbers, no color, no gradient, no
> shadow, no 3D, no perspective, no icons, no clip art, no busy detail.

---

## Prompting notes that actually change the output

- **Name the hex, not the mood.** "Dark background" drifts toward navy or warm
  brown. `0A0A0A` plus "zero color saturation" holds true grayscale.
- **Say what the mark must survive.** "Legible at 16 by 16 pixels" is what stops
  the model adding detail that dies in a favicon.
- **Negatives are load-bearing here.** Half of this prompt pack's value is the
  no-gavel, no-Lady-Justice list. Without it every generation regresses to stock
  legal iconography.
- **Change one variable per iteration.** Stroke weight, or symmetry, or negative
  space — not all three. Otherwise you cannot tell what improved it.
- **Log what you keep.** Prompt, model, date, and terms, stored next to the asset.
  That record is the difference between an asset you can defend and another
  unattributed file on a CDN.
