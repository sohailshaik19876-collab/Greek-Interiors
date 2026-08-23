# Greek Interiors — Website

A complete, hand-built marketing site for **Greek Interiors**, a luxury interior design and
interior architecture studio in India.

**Designing Spaces. Defining Lifestyles.**

No frameworks, no build step, no dependencies — one HTML file, one stylesheet, one script.
Open `index.html` in a browser, or drop the folder on any static host (Netlify, Vercel,
GitHub Pages, cPanel, S3).

```
index.html                     all page content
assets/css/style.css           design system + every section, with a numbered table of contents
assets/js/main.js              scroll reveals, filters, slider, carousel, form, menu
assets/img/favicon.svg         browser tab icon (bronze mark on charcoal)
assets/img/favicon-32.png      raster fallback for older browsers
assets/img/apple-touch-icon.png  iOS home-screen icon, 180x180
assets/img/og-image.svg        source artwork for the sharing card
assets/img/og-image.png        social sharing card, 1200x630
vercel.json                    headers + caching for Vercel
robots.txt / sitemap.xml       search engine basics
```

---

## Deploying to Vercel

The site is static, so there is nothing to build.

**Import from GitHub** — New Project → import this repo → pick branch
`claude/greek-interiors-luxury-site-ux9ja0` (or merge to `main` first) → settings:

| Setting | Value |
|---|---|
| Framework Preset | **Other** |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty — the repo root is served)* |
| Install Command | *(leave empty)* |

Or from the terminal:

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

`vercel.json` sets security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, HSTS) and `Cache-Control: max-age=0, must-revalidate` on `/assets/*`.
That last one is deliberate: the CSS and JS filenames are not content-hashed, so a long cache
would leave visitors on a stale stylesheet after an edit. Revalidation is cheap — Vercel's CDN
answers with a 304. If you later add version strings (`style.css?v=2`), switch it to
`public, max-age=31536000, immutable`.

HSTS is set to one year **without** `includeSubDomains` or `preload`, so it cannot affect any
other subdomain on the same apex. Only add those once every subdomain is known to be HTTPS.

### Before pointing a real domain at it

The absolute URLs are placeholders — `https://www.greekinteriors.in`. Social previews, the
canonical tag and the sitemap all break silently if they point at the wrong host, so update
them in **five** places:

1. `index.html` — `<link rel="canonical">`
2. `index.html` — `og:url`, `og:image`, `twitter:image`
3. `index.html` — the `url` field in the JSON-LD block
4. `robots.txt` — the `Sitemap:` line
5. `sitemap.xml` — the `<loc>` element

```bash
# one command, once the domain is decided
grep -rl 'www.greekinteriors.in' . --exclude-dir=.git \
  | xargs sed -i 's|https://www.greekinteriors.in|https://YOUR-DOMAIN.com|g'
```

Then run the page through [Facebook's sharing debugger](https://developers.facebook.com/tools/debug/)
and [LinkedIn's post inspector](https://www.linkedin.com/post-inspector/) to prime their caches —
both hold a stale preview for days otherwise.

Also worth doing on the Vercel side: add both `example.com` and `www.example.com` and let Vercel
redirect one to the other, so the canonical tag and the served host agree.

### Social preview image

`assets/img/og-image.png` (1200×630) is the sharing card — the bronze mark, wordmark and
tagline on charcoal. It is a **PNG on purpose**: WhatsApp, Facebook and LinkedIn do not render
SVG previews. `og-image.svg` is the source; if you edit it, re-export at 1200×630 and keep both
in sync. Same for `apple-touch-icon.png` (180×180) and `favicon-32.png`, which are rasterised
from `favicon.svg`.

## Design system

| Role | Token | Value |
|---|---|---|
| Primary — deep charcoal | `--ink` | `#14110F` |
| Secondary — warm ivory | `--ivory` | `#F7F3ED` |
| Accent — champagne bronze | `--bronze` | `#C08B62` |
| Deep bronze (text on ivory) | `--bronze-2` | `#A96F47` |
| Light bronze (text on charcoal) | `--bronze-3` | `#E3BC9C` |
| Supporting — stone / taupe | `--stone` / `--taupe` | `#DCD3C7` / `#8E8074` |

Bronze is used only for rules, section labels, hover states, numerals and small highlights —
never as a fill or a gradient wash.

**Typography** — `Cormorant Garamond` (editorial serif) for display headings; `Jost`
(geometric sans, closest to the logo's letterforms) for navigation, labels, buttons and body
copy. Both load from Google Fonts with system fallbacks.

All tokens live at the top of `assets/css/style.css` under `01. Tokens`. Change a value there
and it propagates across the whole site.

---

## Replacing the placeholder content

Everything is written as realistic studio copy, not filler — so it reads correctly if it goes
live before you replace it. Each item below is a plain edit in `index.html`.

**Contact details.** The phone number and studio address are the real ones and appear in the
contact section, the footer, the mobile menu, the sticky dock and the JSON-LD block:

| Value | Status |
|---|---|
| `+91 97004 53895` — `tel:+919700453895`, `wa.me/919700453895` | live |
| `1662, Krishna Nagar Colony, Aditya Nagar, Hafeezpet, Hyderabad, Telangana 500049` | live |
| `studio@greekinteriors.in` | **placeholder** — `mailto:` links, JSON-LD |
| `https://www.greekinteriors.in/` | **placeholder** — canonical, OG tags, JSON-LD, sitemap |
| Instagram / Facebook / Pinterest / LinkedIn | **placeholder** — footer, "Follow Our Journey" |

**Project locations are placeholders.** The eight case studies name Bengaluru, Mumbai, Goa,
Pune, Chennai and Delhi NCR. Replace them with real completed projects before launch — the
hero rail deliberately says only "Hyderabad, India" so the site does not imply offices the
studio does not have.

**Projects** — eight `<article class="proj">` blocks. Each carries a `data-cat`
(`living` / `kitchens` / `bedrooms` / `villas` / `commercial`) that drives the filter buttons,
plus a name, location and category label. The classes `proj--wide`, `proj--tall` and
`proj--full` set the tile's footprint in the grid; the current mix tiles the composition
exactly, so keep the same mix if you swap projects in and out.

**Statistics** — `data-count="10"`, `data-count="150"`, `data-count="100"` in the About
section. Change the number in the attribute; the counter animates to it.

**Testimonials** — four `<li class="quote">` blocks. Add or remove freely; the dots and
arrows adapt automatically.

---

## Photography

Image URLs currently point at Unsplash (`images.unsplash.com/photo-…`), which is free for
commercial use under the [Unsplash License](https://unsplash.com/license). They are
placeholders chosen for tone, not final art direction.

**Before launch, replace them with the studio's own project photography.** Swap the `src` on
each `<img>` and keep the `alt` text descriptive — search engines and screen readers both use
it. Local files work the same way:

```html
<img loading="lazy" decoding="async" src="assets/img/projects/marble-house.jpg"
     alt="Kitchen with full-height marble backsplash and integrated appliances">
```

Every photograph sits inside a `.frame`, which paints a warm stone/bronze material field
behind it (`data-tone="warm|stone|bronze"`). **If an image fails to load, the frame keeps that
field and a subtle woven texture instead of showing a broken-image icon** — so a slow network
or a dead URL degrades into something composed rather than something broken.

> Note: the network in the environment this site was built in blocks outbound image requests,
> so the Unsplash URLs could not be opened and verified here. Check each one in a browser and
> replace anything that does not resolve — the fallback keeps the layout intact either way.

### Art direction for replacements

Warm natural light · neutral palette · marble, wood, stone, textured plaster · contemporary
Indian homes · restrained styling. Avoid CGI-looking renders, oversaturated images, and
catalogue-style furniture shots. Keep one consistent grade across the whole set — it matters
more than any single image.

---

## Wiring up the enquiry form

`#enquiryForm` validates on the client (name, phone, email, project type) and then **simulates**
a send. There is no backend. Find the block marked `DEMO ONLY` in `assets/js/main.js` and
replace it with a real submission, e.g.:

```js
const res = await fetch('/api/enquiry', { method: 'POST', body: new FormData(form) });
```

Or point the `<form>` at Formspree, Netlify Forms, or your CRM's endpoint and delete the
`e.preventDefault()` path. Validation, error styling and the status message all stay as they are.

---

## Behaviour

- Transparent header over the hero that turns solid charcoal on scroll, and retreats when you
  scroll down / returns when you scroll up
- Fullscreen mobile menu with a clip-path reveal and staggered links
- Scroll-triggered reveals, animated statistics, subtle parallax on feature images
- Project filtering, hover zoom with a bronze rule that draws across on hover
- Scroll-linked progress line through the six-stage process timeline
- Draggable before/after slider — mouse, touch, and keyboard (arrow keys, Home, End)
- Auto-playing testimonial carousel that pauses on hover and supports swipe
- Sticky contact dock (WhatsApp, call, back-to-top) anchored bottom-right. The WhatsApp link
  carries a pre-filled message. The dock is bottom-anchored, so the back-to-top button fading
  in above never nudges the contact buttons; the hero rail and footer credit reserve space so
  nothing sits underneath it.

**Hover on touch devices** — every hover fill is gated behind `@media (hover:hover)`, with
`:active` and `:focus-visible` equivalents. Without this, iOS holds the `:hover` state after a
tap and the primary button stays filled bronze until you tap elsewhere.

**Accessibility** — skip link, visible focus rings, `aria` state on the menu, filters, slider
and form, and a full `prefers-reduced-motion` path that disables every animation and parallax.

**Responsive** — laid out for desktop, tablet landscape (≤1080px), tablet portrait (≤860px) and
mobile (≤640px). Mobile is composed rather than shrunk: the mosaic and portfolio grids
re-flow, hover-only content becomes permanently visible on touch devices, filters scroll
horizontally, and touch targets stay large. No horizontal overflow at any width.

---

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from the filesystem also works.
