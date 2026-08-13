# Legal League — brand asset prompts

Prompts for Gemini / Imagen / Veo, written to be pasted verbatim.

---

## How the watermark problem is solved

Generated images carry a **visible watermark**, usually bottom-right, sometimes
bottom-left. Every prompt below therefore asks for the artwork to occupy a
small centred region of a much larger canvas, with the rest left as flat empty
background. The watermark lands in that empty margin, and the margin is cropped
away afterwards.

The ratio used throughout is **1 : 3** — artwork occupies the centre third,
so a 20 × 20 mark is requested inside a 60 × 60 canvas. That leaves a 20px
band on every side, which is wider than any watermark yet seen and gives the
crop room to be imprecise.

Two things to be aware of, so nothing surprises you later:

- Cropping removes the **visible** watermark. Google also embeds **SynthID**,
  an invisible signal that survives cropping, resizing and recompression. It
  does not appear to a viewer and does not prevent commercial use — it only
  means the file remains identifiable as AI-generated. Check the terms of the
  specific tier you generate under before publishing commercially.
- **Do not use a generated image as the favicon.** The site already generates
  its favicon and OG card from code (`src/app/icon.tsx`,
  `src/app/opengraph-image.tsx`). Those are typographic, watermark-free,
  and rebuild themselves from live figures. The prompts below are for richer
  brand assets — the wordmark, editorial imagery, the launch film — not for
  replacing something that already works.

### Cropping, after generation

```bash
# 60x60 canvas -> the centred 20x20 mark
magick input.png -gravity center -crop 20x20+0+0 +repage icon-20.png

# General form: keep the centre third of any square canvas
magick input.png -gravity center -crop 33.34%x33.34%+0+0 +repage cropped.png

# 1920x1080 frame with a 640x360 centred safe area
magick input.png -gravity center -crop 640x360+0+0 +repage cropped.png
```

Always verify the crop landed correctly before use — check all four corners at
100% zoom.

---

## Brand constants

Every prompt below is built on these. Keep them identical across assets, or the
set will not read as one publication.

| | |
|---|---|
| Name | Legal League |
| Slogan | A comprehensive legal media publication |
| Domain | legalleague.org |
| Paper | `#FBFAF7` warm off-white |
| Ink | `#14161A` near-black, slightly blue |
| Rule | `#E4E0D6` warm grey line |
| Oxblood | `#7A2230` deep red accent |
| Muted | `#6B7280` grey for secondary text |
| Type | High-contrast transitional serif — Source Serif, Freight, Canela |
| Register | Financial Times, The Economist, Monocle. **Not** legaltech SaaS. |

**The single most important instruction, repeated in every prompt:** this must
look like a printed publication with an editorial art director, not like a
startup landing page. No gradients, no glassmorphism, no glowing edges, no
neon, no 3D renders, no gavels, no scales of justice, no columned courthouses,
no blindfolded figures. Those clichés are why legal directories all look the
same, and they are the first thing that makes a page read as generated.

---

## 1 · Wordmark / logo

> Design a typographic wordmark for a legal media publication called **Legal
> League**.
>
> **Canvas and placement — follow exactly.** Produce a square image
> **1200 × 1200 pixels**. The wordmark must occupy only the centred region of
> **400 × 400 pixels**, precisely centred both horizontally and vertically.
> Every pixel outside that centred 400 × 400 region must be flat, uniform,
> completely empty background in the exact colour `#FBFAF7`, with no texture,
> no shadow, no vignette, no gradient, no border and no stray marks of any
> kind. Treat the outer 400-pixel band on all four sides as strictly reserved
> empty margin. Do not extend the design into it. Do not centre the design and
> then scale it up to fill the frame.
>
> **The mark itself.** Set the two words "Legal League" in a high-contrast
> transitional serif with sharp, flat, unbracketed serifs and a strong
> thick-to-thin stroke modulation — the character of Source Serif Pro, Freight
> Display or Canela. Stack the two words on two lines, flush left, with tight
> leading so the descender of "g" in "Legal" nearly meets the cap-height of
> "League". Letter-spacing slightly negative, roughly minus two percent.
> Colour the type `#14161A`. Beneath the second word, place a single hairline
> horizontal rule, one pixel in weight, in `#7A2230`, running exactly the width
> of the word "League" and no wider.
>
> **Explicitly avoid.** No icon, no emblem, no monogram, no crest, no seal, no
> scales of justice, no gavel, no pillar, no book, no globe, no shield, no
> laurel. No gradient anywhere. No drop shadow, outer glow, bevel, emboss or
> 3D extrusion. No outline or stroke around the letters. No background texture,
> paper grain, or noise. No decorative flourish, swash or ligature beyond
> standard typography. Nothing that suggests a technology company, a law firm
> or a software product.
>
> Flat vector-style rendering, print-quality, absolutely sharp edges. The
> reference register is a masthead in the Financial Times or The Economist.

**Crop:** centre 400 × 400 from 1200 × 1200.

---

## 2 · Monogram, for small square placements

Use for app icons, social avatars, and anywhere the full wordmark will not
survive the size. (The browser favicon is already generated in code — this is
for external placements.)

> Design a minimal square monogram for a legal media publication.
>
> **Canvas and placement — follow exactly.** Produce a square image
> **900 × 900 pixels**. The monogram must occupy only the centred region of
> **300 × 300 pixels**, precisely centred. Every pixel outside that centred
> 300 × 300 region must be flat, uniform, empty background in `#FBFAF7` —
> no texture, no shadow, no gradient, no border, no marks. The outer
> 300-pixel band on all four sides is strictly reserved empty margin.
>
> **The monogram.** Within the centred region, a solid square of deep oxblood
> `#7A2230` with sharp ninety-degree corners, completely filling that region —
> no rounded corners, no circle, no shield shape. Centred on it, the two
> letters "LL" in a high-contrast transitional serif, in warm off-white
> `#FBFAF7`, at roughly sixty percent of the square's height. The two Ls
> should be tightly letter-spaced, almost touching, reading as one unit. Flat
> colour only.
>
> **Explicitly avoid.** No gradient, no gloss, no highlight, no bevel, no
> shadow, no 3D. No circular badge, no rounded rectangle, no border ring. No
> additional symbol, no gavel, no scales, no globe. Nothing resembling an app
> icon template with a glossy sheen.
>
> Flat, geometric, print-quality, sharp edges.

**Crop:** centre 300 × 300 from 900 × 900, then export at 512, 192, 180, 32.

---

## 3 · Editorial section illustration

For section headers on `/news`, `/rankings`, `/methodology`. Generate one per
section by swapping the subject sentence.

> Create an editorial illustration for a serious legal news publication, in the
> style of a broadsheet newspaper's commissioned artwork.
>
> **Canvas and placement — follow exactly.** Produce an image
> **2400 × 1350 pixels**. All meaningful content must sit within a centred
> region of **1600 × 900 pixels**. The surrounding band — 400 pixels on the
> left and right, 225 pixels top and bottom — must be flat, uniform, empty
> background in `#FBFAF7`, with no texture, no gradient, no vignette, no
> content and no partial elements bleeding into it. Do not compose the image
> to fill the full frame.
>
> **Subject.** [ONE OF:
> *for news* — an arrangement of overlapping broadsheet newspaper pages seen
> from directly above, folded and slightly fanned, their columns rendered as
> abstract grey rules rather than legible text;
> *for rankings* — a set of vertical bars of differing heights arranged as a
> quiet bar chart, drawn as if printed, with one bar in deep red;
> *for methodology* — a technical diagram of nested rectangles connected by
> thin lines, resembling an architectural plan or a flow chart drawn by hand
> with a ruling pen.]
>
> **Treatment.** Flat two-dimensional illustration with no perspective depth.
> Restricted palette of exactly four colours: warm off-white `#FBFAF7`,
> near-black `#14161A`, warm grey `#E4E0D6`, and deep oxblood `#7A2230` used
> sparingly for a single point of emphasis only. Line work is thin, precise
> and consistent in weight, as if drawn with a technical pen. Generous empty
> space within the composition itself. Subtle offset-print texture is
> acceptable but must be very faint.
>
> **Explicitly avoid.** No gavels, no scales of justice, no courthouse
> columns, no blindfolded figures, no law books, no wigs, no marble. No
> photorealism, no 3D rendering, no glass, no reflections, no lens flare, no
> bokeh. No gradients, no neon, no glow. No people's faces. No legible text,
> lettering, numbers or logos anywhere in the image. No stock-illustration
> style with rounded corporate figures.
>
> Reference register: a commissioned illustration in the Financial Times
> weekend edition or The Economist.

**Crop:** centre 1600 × 900 from 2400 × 1350.

---

## 4 · Launch film (Veo)

Eight seconds, silent, for the homepage or a launch post. Silent is
deliberate — it will autoplay muted, and a soundtrack that nobody hears is
wasted while a soundtrack that surprises someone is worse.

> An eight-second silent film in the visual register of a broadsheet
> newspaper's brand film. Static locked-off camera throughout — no pan, no
> zoom, no dolly, no handheld motion, no camera shake whatsoever.
>
> **Framing — follow exactly.** Produce the video at **1920 × 1080**. All
> meaningful action and subject matter must remain within a centred safe area
> of **1280 × 720 pixels**. The surrounding band — 320 pixels left and right,
> 180 pixels top and bottom — must remain flat, empty, uniform `#FBFAF7`
> background for the entire duration, with nothing entering it at any point in
> any frame.
>
> **Shot.** Overhead view, camera pointing straight down at a flat warm
> off-white surface. A single sheet of newsprint lies centred. Over the eight
> seconds, three more sheets slide in slowly and settle over it, each
> overlapping the last, coming to rest still. The sheets carry printed columns
> rendered as fine grey horizontal rules — abstract, never legible as actual
> words. On the final sheet, one short rule is deep oxblood red while all
> others remain grey.
>
> **Lighting and grade.** Flat, even, diffuse light with no visible source, no
> hotspot, no falloff. Very soft contact shadows under the sheets only. No
> dramatic lighting, no chiaroscuro, no colour grading beyond the natural warm
> off-white and near-black of the palette.
>
> **Motion.** Slow, weighted, physical — paper settling under its own weight,
> not floating. Everything comes to complete rest by the seventh second and
> holds still for the eighth.
>
> **Explicitly avoid.** No text, no titles, no lettering, no numbers, no logos
> anywhere in frame. No people, no hands, no faces. No gavels, no scales, no
> courtrooms, no law books. No camera movement of any kind. No transitions,
> wipes, fades, flashes or cuts — one continuous static shot. No lens flare,
> no bloom, no glow, no particles, no dust motes, no light rays. No music
> visualisation. Nothing that resembles a technology product launch video.
>
> Silent. No audio track.

**Crop:** centre 1280 × 720 from 1920 × 1080.

```bash
ffmpeg -i input.mp4 -vf "crop=1280:720:(iw-1280)/2:(ih-720)/2" -an -c:v libx264 -crf 18 launch.mp4
```

`-an` strips any audio the model added regardless of the instruction.

---

## 5 · Social share card, generated alternative

The site already generates its own OG card in code, from live figures. Use this
only if a hand-designed card is wanted for a specific campaign.

> Design a social share card for a legal media publication.
>
> **Canvas and placement — follow exactly.** Produce an image
> **1800 × 945 pixels**. All content must sit within a centred region of
> **1200 × 630 pixels**. The surrounding band — 300 pixels left and right,
> roughly 157 pixels top and bottom — must be flat, uniform, empty `#FBFAF7`
> with no content whatsoever.
>
> **Layout within the centred region.** Warm off-white `#FBFAF7` ground. In
> the upper left, the words "LEGAL LEAGUE" in a high-contrast transitional
> serif, near-black `#14161A`, generously letter-spaced at roughly fifteen
> percent, at a modest size. Below it, a single one-pixel horizontal rule in
> warm grey `#E4E0D6` running the full width of the content area. In the lower
> left, the line "A comprehensive legal media publication" in the same serif,
> italic, in grey `#6B7280`. In the lower right, "legalleague.org" in small
> letter-spaced uppercase, oxblood `#7A2230`. Large areas of the card left
> deliberately empty.
>
> **Explicitly avoid.** No photograph, no illustration, no icon, no emblem.
> No gradient, no shadow, no glow, no rounded corners, no card border, no
> device mockup. No stock imagery of lawyers, handshakes, skylines or
> courthouses.
>
> Flat, typographic, restrained. The register of a printed announcement.

**Crop:** centre 1200 × 630 from 1800 × 945.

---

## Checklist before any asset ships

- [ ] Watermark cropped away; all four corners inspected at 100%
- [ ] Colours match the constants exactly — sample them, do not eyeball
- [ ] No gavel, scales, columns, blindfold or law book anywhere
- [ ] No gradient, glow, bevel or 3D
- [ ] Legible at the smallest size it will actually be used at
- [ ] Licence terms for the generating tier checked, if the use is commercial
