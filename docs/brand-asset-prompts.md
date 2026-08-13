# League of Legals — brand asset prompts

**How to use this file.** Each asset below has one grey code box. Copy
**everything inside that box** — from the first word to the last — and paste it
into Gemini as a single message. Nothing above or below the box goes into the
prompt: the headings, the notes and the crop commands are for you, not for the
model.

In most editors, and in the GitHub preview, a code box shows a copy button in
its top-right corner when you hover over it — that is the reliable way to take
the whole prompt. Failing that, click at the first character and shift-click at
the last.

Do **not** copy the `PROMPT STARTS` / `PROMPT ENDS` marker lines. They sit
outside the box for exactly that reason.

**Done and shipped:** 1 wordmark · 2 monogram · 3 section illustrations.
**To generate next:** 4 launch film (first attempt failed — read the note) · 6 deals · 7 court records · 8 for-firms · 9 not-found · 10 masthead ornament.

---

## How the watermark problem is solved

Generated images carry a **visible watermark**, usually bottom-right, sometimes
bottom-left. Every prompt below therefore asks for the artwork to occupy a
small centred region of a much larger canvas, with the rest left as flat empty
background. The watermark lands in that empty margin, and the margin is cropped
away afterwards.

The ratio used throughout is **1 : 3** — artwork occupies the centre third, so
a 20 × 20 mark is requested inside a 60 × 60 canvas. That leaves a 20px band on
every side, wider than any watermark yet seen, so the crop does not have to be
precise.

Two things so nothing surprises you later:

- Cropping removes the **visible** watermark. Google also embeds **SynthID**,
  an invisible signal that survives cropping, resizing and recompression. It
  does not appear to a viewer and does not prevent commercial use — it only
  means the file stays identifiable as AI-generated. Check the terms of the
  tier you generate under before commercial publication.
- **Do not use a generated image as the favicon.** The site already generates
  its favicon and share card from code (`src/app/icon.tsx`,
  `src/app/opengraph-image.tsx`). Those are typographic, watermark-free, and
  rebuild from live figures. These prompts are for richer brand assets, not for
  replacing something that already works.

---

## Brand constants

Every prompt is built on these. Keep them identical across assets or the set
will not read as one publication.

| | |
|---|---|
| Name | League of Legals |
| Slogan | A comprehensive legal media publication |
| Domain | leagueoflegals.com |
| Paper | `#FBFAF7` warm off-white |
| Ink | `#14161A` near-black, slightly blue |
| Rule | `#E4E0D6` warm grey line |
| Oxblood | `#7A2230` deep red accent |
| Muted | `#6B7280` grey for secondary text |
| Type | High-contrast transitional serif — Source Serif, Freight, Canela |
| Register | Financial Times, The Economist, Monocle. **Not** legaltech SaaS. |

---

## 1 · Wordmark / logo

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Design a typographic wordmark for a legal media publication called League of Legals.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce a square image 1200 x 1200 pixels. The wordmark must occupy only the centred region of 400 x 400 pixels, precisely centred both horizontally and vertically. Every pixel outside that centred 400 x 400 region must be flat, uniform, completely empty background in the exact colour #FBFAF7, with no texture, no shadow, no vignette, no gradient, no border and no stray marks of any kind. Treat the outer 400-pixel band on all four sides as strictly reserved empty margin. Do not extend the design into it. Do not centre the design and then scale it up to fill the frame.

THE MARK ITSELF. Set the three words "League of Legals" in a high-contrast transitional serif with sharp, flat, unbracketed serifs and strong thick-to-thin stroke modulation — the character of Source Serif Pro, Freight Display or Canela. Set "LEAGUE OF" on the first line in smaller capitals and "LEGALS" on the second line much larger, flush left, with tight leading. The eye should land on LEGALS. Letter-spacing slightly negative, roughly minus two percent. Colour the type #14161A. Beneath the second word place a single hairline horizontal rule, one pixel in weight, in #7A2230, running exactly the width of the word "LEGALS" and no wider.

EXPLICITLY AVOID. No icon, no emblem, no monogram, no crest, no seal, no scales of justice, no gavel, no pillar, no book, no globe, no shield, no laurel. No gradient anywhere. No drop shadow, outer glow, bevel, emboss or 3D extrusion. No outline or stroke around the letters. No background texture, paper grain or noise. No decorative flourish, swash or ligature beyond standard typography. Nothing that suggests a technology company, a law firm or a software product.

Flat vector-style rendering, print-quality, absolutely sharp edges. The reference register is a masthead in the Financial Times or The Economist.
```

**▲ PROMPT ENDS ▲**

Crop afterwards — centre 400 × 400 out of 1200 × 1200:

```bash
magick wordmark.png -gravity center -crop 400x400+0+0 +repage logo.png
```

---

## 2 · Monogram, for small square placements

For app icons, social avatars, and anywhere the full wordmark will not survive
the size. The browser favicon is already generated in code — this is for
external placements.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Design a minimal square monogram for a legal media publication.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce a square image 900 x 900 pixels. The monogram must occupy only the centred region of 300 x 300 pixels, precisely centred. Every pixel outside that centred 300 x 300 region must be flat, uniform, empty background in #FBFAF7 — no texture, no shadow, no gradient, no border, no marks. The outer 300-pixel band on all four sides is strictly reserved empty margin. Do not scale the monogram up to fill the frame.

THE MONOGRAM. Within the centred region, a solid square of deep oxblood #7A2230 with sharp ninety-degree corners, completely filling that region — no rounded corners, no circle, no shield shape. Centred on it, the two letters "LL" in a high-contrast transitional serif, in warm off-white #FBFAF7, at roughly sixty percent of the square's height. The two Ls should be tightly letter-spaced, almost touching, reading as one unit. Flat colour only.

EXPLICITLY AVOID. No gradient, no gloss, no highlight, no bevel, no shadow, no 3D. No circular badge, no rounded rectangle, no border ring. No additional symbol, no gavel, no scales, no globe. Nothing resembling an app icon template with a glossy sheen.

Flat, geometric, print-quality, sharp edges.
```

**▲ PROMPT ENDS ▲**

Crop, then export the sizes you need:

```bash
magick monogram.png -gravity center -crop 300x300+0+0 +repage mark.png
magick mark.png -resize 512x512 mark-512.png
magick mark.png -resize 180x180 apple-touch-icon.png
```

---

## 3 · Editorial section illustration

One per section. Swap only the SUBJECT paragraph — everything else stays
identical so the three read as a set.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Create an editorial illustration for a serious legal news publication, in the style of a broadsheet newspaper's commissioned artwork.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 2400 x 1350 pixels. All meaningful content must sit within a centred region of 1600 x 900 pixels. The surrounding band — 400 pixels on the left and right, 225 pixels top and bottom — must be flat, uniform, empty background in #FBFAF7, with no texture, no gradient, no vignette, no content and no partial elements bleeding into it. Do not compose the image to fill the full frame.

SUBJECT. An arrangement of overlapping broadsheet newspaper pages seen from directly above, folded and slightly fanned, their columns rendered as abstract grey rules rather than legible text.

TREATMENT. Flat two-dimensional illustration with no perspective depth. Restricted palette of exactly four colours: warm off-white #FBFAF7, near-black #14161A, warm grey #E4E0D6, and deep oxblood #7A2230 used sparingly for a single point of emphasis only. Line work thin, precise and consistent in weight, as if drawn with a technical pen. Generous empty space within the composition itself. Subtle offset-print texture is acceptable but must be very faint.

EXPLICITLY AVOID. No gavels, no scales of justice, no courthouse columns, no blindfolded figures, no law books, no wigs, no marble. No photorealism, no 3D rendering, no glass, no reflections, no lens flare, no bokeh. No gradients, no neon, no glow. No people's faces. No legible text, lettering, numbers or logos anywhere in the image. No stock-illustration style with rounded corporate figures.

Reference register: a commissioned illustration in the Financial Times weekend edition or The Economist.
```

**▲ PROMPT ENDS ▲**

**To make the other two**, replace only the SUBJECT paragraph with one of these:

```text
SUBJECT. A set of vertical bars of differing heights arranged as a quiet bar chart, drawn as if printed, with one bar in deep red.
```

```text
SUBJECT. A technical diagram of nested rectangles connected by thin lines, resembling an architectural plan or a flow chart drawn by hand with a ruling pen.
```

Crop — centre 1600 × 900 out of 2400 × 1350:

```bash
magick illustration.png -gravity center -crop 1600x900+0+0 +repage section.png
```

---

## 4 · Launch film (Veo)

> **The first attempt failed, and the reason matters.** Veo rendered the prompt's
> own specification *as artwork*: the finished frames contained dimension arrows
> labelled "320pixel" on both sides, the string "#FBFAF7" printed twice across
> the newspaper, and garbled lettering in the corner. It read the canvas
> instructions as things to draw. The text sat in the middle of the frame, so no
> crop could rescue it. Veo also ignored the 1920×1080 request and rendered
> 1280×720, leaving no margin at all — the watermark sparkle landed inside the
> picture at roughly 120px from the right edge.
>
> **So video prompts must not contain pixel dimensions or hex codes.** Describe
> colours in words, describe the scene only, set the aspect ratio in the tool's
> own controls rather than in the prompt, and crop the watermark afterwards.
> That is what the rewritten prompt below does. Images tolerate the numeric
> spec; video does not.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
An eight-second silent film in the visual register of a broadsheet newspaper's brand film.

CAMERA. Completely static locked-off camera for the entire duration. No pan, no tilt, no zoom, no dolly, no push-in, no handheld motion, no camera shake, no rack focus. One continuous shot from first frame to last.

SHOT. Directly overhead, camera pointing straight down at a flat warm off-white paper surface the colour of unbleached newsprint. A single broadsheet newspaper page lies centred in frame with generous empty surface visible all around it. Over the eight seconds, three more broadsheet pages slide in slowly from just outside the frame and settle over the first, each overlapping the one beneath at a slight angle, until all four come to rest in a loose fanned stack.

THE PRINTED PAGES. The pages carry newspaper columns suggested purely as fine horizontal grey rules of varying length, in the manner of a page seen from too far away to read. Absolutely no readable words, no letterforms, no numbers, no headlines, no logos, no captions, no annotations, no measurements, no arrows, no labels of any kind anywhere in the frame. On the topmost page only, one short rule is deep burgundy red; every other rule is soft warm grey.

PALETTE. Restricted entirely to warm off-white paper, soft warm greys, near-black, and a single deep burgundy accent. Nothing saturated, nothing bright, no other colour anywhere.

LIGHTING. Flat, even, diffuse daylight with no visible source, no hotspot, no falloff, no vignette. Only very soft contact shadows directly beneath the edges of the paper where it lifts slightly. No dramatic lighting, no chiaroscuro, no rim light, no colour cast.

MOTION. Slow, weighted and physical, as real paper moves under its own weight — sliding and settling, never floating or drifting. All motion finishes by the seventh second and the final second is completely still.

DO NOT INCLUDE. No text of any kind. No lettering, no typography, no numbers, no measurements, no dimension arrows, no annotations, no watermark-like marks, no logos, no captions, no subtitles. No people, no hands, no faces, no bodies. No gavels, no scales of justice, no courtrooms, no law books, no legal symbolism. No camera movement. No cuts, transitions, wipes, fades, flashes or dissolves. No lens flare, no bloom, no glow, no light rays, no particles, no dust motes, no smoke. No music, no sound effects, no audio.

Photographic, quiet, restrained, editorial. The register of a printed newspaper, not a technology product launch.
```

**▲ PROMPT ENDS ▲**

Set the aspect ratio to 16:9 in Veo's own settings — not in the prompt.

Afterwards, trim the watermark by cropping ~9% off the right and bottom, then
scale back to a clean 16:9. `-an` strips any audio track regardless of the
instruction, which Veo added anyway last time:

```bash
ffmpeg -i launch-raw.mp4 \
  -vf "crop=iw*0.91:ih*0.88:0:0,scale=1280:720" \
  -an -c:v libx264 -crf 20 -pix_fmt yuv420p launch.mp4
```

Check the last frame before shipping — the watermark is easiest to see there:

```bash
ffmpeg -y -ss 7 -i launch.mp4 -frames:v 1 lastframe.png
```

---

## 5 · Social share card, generated alternative

The site already generates its own share card in code, from live figures. Use
this only if you want a hand-designed card for a specific campaign.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Design a social share card for a legal media publication.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 1800 x 945 pixels. All content must sit within a centred region of 1200 x 630 pixels. The surrounding band — 300 pixels left and right, roughly 157 pixels top and bottom — must be flat, uniform, empty #FBFAF7 with no content whatsoever.

LAYOUT WITHIN THE CENTRED REGION. Warm off-white #FBFAF7 ground. In the upper left, the words "LEAGUE OF LEGALS" in a high-contrast transitional serif, near-black #14161A, generously letter-spaced at roughly fifteen percent, at a modest size. Below it, a single one-pixel horizontal rule in warm grey #E4E0D6 running the full width of the content area. In the lower left, the line "A comprehensive legal media publication" in the same serif, italic, in grey #6B7280. In the lower right, "leagueoflegals.com" in small letter-spaced uppercase, oxblood #7A2230. Large areas of the card left deliberately empty.

EXPLICITLY AVOID. No photograph, no illustration, no icon, no emblem. No gradient, no shadow, no glow, no rounded corners, no card border, no device mockup. No stock imagery of lawyers, handshakes, skylines or courthouses.

Flat, typographic, restrained. The register of a printed announcement.
```

**▲ PROMPT ENDS ▲**

Crop — centre 1200 × 630 out of 1800 × 945:

```bash
magick card.png -gravity center -crop 1200x630+0+0 +repage share-card.png
```

---

## Generic crop, for any square canvas

Keeps the centre third, which is the ratio every prompt above uses:

```bash
magick input.png -gravity center -crop 33.34%x33.34%+0+0 +repage output.png
```

---

## Checklist before any asset ships

- [ ] Watermark cropped away; all four corners inspected at 100% zoom
- [ ] Colours match the constants exactly — sample them, do not eyeball
- [ ] No gavel, scales, columns, blindfold or law book anywhere
- [ ] No gradient, glow, bevel or 3D
- [ ] Legible at the smallest size it will actually be used at
- [ ] Licence terms for the generating tier checked, if the use is commercial

---

# Further assets

The five below extend the set without breaking it. Each follows the same rules:
canvas three times the artwork, flat empty margin for the watermark, four
colours only, and an avoid-list. Generate them in the order given — the first
two do the most for the page.

---

## 6 · Deals section illustration

For the quarterly deals pillar on the homepage.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Create an editorial illustration for a serious legal news publication, in the style of a broadsheet newspaper's commissioned artwork.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 2400 x 1350 pixels. All meaningful content must sit within a centred region of 1600 x 900 pixels. The surrounding band — 400 pixels on the left and right, 225 pixels top and bottom — must be flat, uniform, empty background in #FBFAF7, with no texture, no gradient, no vignette, no content and no partial elements bleeding into it. Do not compose the image to fill the full frame.

SUBJECT. Two loose stacks of paper documents seen from directly above, sitting apart on a flat surface, with a single unbroken horizontal line running between them to connect the two. The line is deep oxblood red. The documents are rendered as plain rectangles with their text suggested only as fine grey rules. One document in the left stack is turned slightly askew.

TREATMENT. Flat two-dimensional illustration with no perspective depth. Restricted palette of exactly four colours: warm off-white #FBFAF7, near-black #14161A, warm grey #E4E0D6, and deep oxblood #7A2230 used sparingly for a single point of emphasis only. Line work thin, precise and consistent in weight, as if drawn with a technical pen. Generous empty space within the composition itself. Subtle offset-print texture is acceptable but must be very faint.

EXPLICITLY AVOID. No money, no coins, no banknotes, no currency symbols, no dollar signs, no upward arrows, no growth charts, no handshakes, no briefcases, no skylines, no buildings. No gavels, no scales of justice, no courthouse columns. No photorealism, no 3D rendering, no gradients, no glow. No people. No legible text, lettering, numbers or logos anywhere in the image.

Reference register: a commissioned illustration in the Financial Times weekend edition.
```

**▲ PROMPT ENDS ▲**

```bash
magick deals-raw.png -gravity center -crop 1600x900+0+0 +repage deals.png
```

---

## 7 · Court records illustration

For the primary-sources pillar — judgments and ministry notices.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Create an editorial illustration for a serious legal news publication, in the style of a broadsheet newspaper's commissioned artwork.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 2400 x 1350 pixels. All meaningful content must sit within a centred region of 1600 x 900 pixels. The surrounding band — 400 pixels on the left and right, 225 pixels top and bottom — must be flat, uniform, empty background in #FBFAF7, with no texture, no gradient, no vignette, no content and no partial elements bleeding into it. Do not compose the image to fill the full frame.

SUBJECT. A long horizontal row of narrow vertical document spines standing side by side, like bound volumes shelved in a row and seen straight on, each a plain rectangle of slightly different height and width. Their labels are suggested only as short grey rules. Three spines near the centre are deep oxblood red while all others are warm grey and off-white.

TREATMENT. Flat two-dimensional illustration with no perspective depth. Restricted palette of exactly four colours: warm off-white #FBFAF7, near-black #14161A, warm grey #E4E0D6, and deep oxblood #7A2230 used sparingly. Line work thin, precise and consistent in weight, as if drawn with a technical pen. Generous empty space above and below the row. Subtle offset-print texture is acceptable but must be very faint.

EXPLICITLY AVOID. No gavels, no scales of justice, no courthouse columns, no blindfolded figures, no wigs, no marble, no ornate bindings, no gold leaf, no leather texture. No photorealism, no 3D rendering, no perspective, no shelves, no furniture. No gradients, no glow. No people. No legible text, lettering, numbers or logos anywhere in the image.

Reference register: a commissioned illustration in The Economist.
```

**▲ PROMPT ENDS ▲**

```bash
magick courts-raw.png -gravity center -crop 1600x900+0+0 +repage courts.png
```

---

## 8 · For-firms illustration

For the commercial page, where the firewall between advertising and editorial
is set out.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Create an editorial illustration for a serious legal news publication, in the style of a broadsheet newspaper's commissioned artwork.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 2400 x 1350 pixels. All meaningful content must sit within a centred region of 1600 x 900 pixels. The surrounding band — 400 pixels on the left and right, 225 pixels top and bottom — must be flat, uniform, empty background in #FBFAF7, with no texture, no gradient, no vignette, no content and no partial elements bleeding into it. Do not compose the image to fill the full frame.

SUBJECT. Two separate groups of plain rectangles arranged on either side of the composition, with a single unbroken vertical line running floor to ceiling between them, dividing the image cleanly in two. Nothing crosses the line. The line is deep oxblood red and is the only red element. The rectangles are warm grey and off-white, of varying sizes, arranged in a loose grid.

TREATMENT. Flat two-dimensional illustration with no perspective depth. Restricted palette of exactly four colours: warm off-white #FBFAF7, near-black #14161A, warm grey #E4E0D6, and deep oxblood #7A2230. Line work thin, precise and consistent in weight, as if drawn with a technical pen. Generous empty space. Subtle offset-print texture is acceptable but must be very faint.

EXPLICITLY AVOID. No handshakes, no people, no money, no coins, no currency symbols, no shopping carts, no price tags, no badges, no ribbons, no stars, no checkmarks, no shields, no locks. No gavels, no scales of justice. No photorealism, no 3D rendering, no gradients, no glow. No legible text, lettering, numbers or logos anywhere in the image.

Reference register: a diagram in a printed annual report.
```

**▲ PROMPT ENDS ▲**

```bash
magick forfirms-raw.png -gravity center -crop 1600x900+0+0 +repage forfirms.png
```

---

## 9 · Not-found page illustration

For the 404. Small, quiet, not a joke.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Create a small editorial illustration for a serious legal news publication, in the style of a broadsheet newspaper's commissioned artwork.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce a square image 1800 x 1800 pixels. All meaningful content must sit within a centred region of 600 x 600 pixels, precisely centred. Every pixel outside that centred 600 x 600 region must be flat, uniform, empty background in #FBFAF7 with no texture, no gradient, no vignette and no content whatsoever. The outer 600-pixel band on all four sides is strictly reserved empty margin.

SUBJECT. A single sheet of paper lying flat, seen from directly above, entirely blank except for one short deep oxblood red rule near its upper left corner. One corner of the sheet is very slightly curled.

TREATMENT. Flat two-dimensional illustration with no perspective depth. Restricted palette of exactly four colours: warm off-white #FBFAF7, near-black #14161A, warm grey #E4E0D6, and deep oxblood #7A2230. A single thin precise outline defines the sheet. Very soft contact shadow beneath the curled corner only. Otherwise entirely empty.

EXPLICITLY AVOID. No question marks, no exclamation marks, no numbers, no "404", no error symbols, no warning triangles, no magnifying glasses, no broken links, no unplugged cables, no sad faces, no cartoon characters, no mascots. No gavels, no scales. No photorealism, no 3D, no gradients, no glow. No legible text or lettering anywhere.

Quiet, restrained, almost empty.
```

**▲ PROMPT ENDS ▲**

```bash
magick notfound-raw.png -gravity center -crop 600x600+0+0 +repage notfound.png
```

---

## 10 · Masthead rule ornament

A narrow horizontal ornament to sit beneath the masthead on the homepage, in
the way a printed paper sets a decorative rule under its nameplate.

**▼ PROMPT STARTS — copy everything inside the box below ▼**

```text
Design a narrow horizontal typographic ornament for the masthead of a printed newspaper.

CANVAS AND PLACEMENT — FOLLOW EXACTLY. Produce an image 2400 x 600 pixels. All content must sit within a centred horizontal band 1800 pixels wide and 120 pixels tall, precisely centred both horizontally and vertically. Every pixel outside that centred band must be flat, uniform, empty background in #FBFAF7, with no texture, no gradient, no vignette and no content whatsoever.

THE ORNAMENT. Within the band, a symmetrical arrangement of horizontal rules: one thick rule in near-black #14161A running the full width, a thin hairline rule in warm grey #E4E0D6 parallel below it with a small gap, and at the exact centre a single small solid diamond in deep oxblood #7A2230 interrupting the thick rule, with a short break in the rule on either side of the diamond. Perfectly symmetrical about the centre.

EXPLICITLY AVOID. No text, no letters, no numbers. No filigree, no scrollwork, no floral motifs, no laurel, no leaves, no acanthus, no Victorian ornament, no art nouveau curves. No gradient, no shadow, no glow, no bevel, no 3D. No stars, no fleurons, no asterisks.

Flat, geometric, precise, print-quality, absolutely sharp edges. The register of a rule beneath the nameplate of The Times or Le Monde.
```

**▲ PROMPT ENDS ▲**

```bash
magick ornament-raw.png -gravity center -crop 1800x120+0+0 +repage ornament.png
```

---

## When these are downloaded

Say so and they will be cropped, converted and wired in the same way as the
first five. The crop is measured per image against its own artwork bounds
rather than applied as a fixed ratio — the first batch showed why that
matters, since Gemini did not honour the padding instruction and a blind
centre-third crop would have cut straight through the wordmark.
