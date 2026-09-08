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
api/                           serverless endpoints (enquiries, admin session)
admin/                         the password-protected enquiry dashboard
```

---

## Enquiry dashboard

Form submissions are stored and read back at **`/admin`** — a password-protected
dashboard with the pipeline, a weekly volume chart and CSV export.

```
api/enquiry.js            public POST endpoint behind the contact form
api/admin/session.js      sign in / sign out
api/admin/enquiries.js    list, update status + notes, delete
api/_lib/store.js         storage adapter (the only file that knows Redis)
api/_lib/auth.js          signed session cookie
admin/                    the dashboard itself
```

Vercel deploys anything under `/api` as a Serverless Function with no build step
and no dependencies, so the project stays framework-free.

### Setting it up (about five minutes)

1. **Add a database.** Vercel dashboard → your project → **Storage** → **Upstash
   Redis** → Create. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   automatically. (`UPSTASH_REDIS_REST_URL` / `_TOKEN` are also accepted — the
   integration has used both names over time.)
2. **Set two environment variables** under Settings → Environment Variables:

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | the dashboard password — make it long and random |
   | `SESSION_SECRET` | any long random string, e.g. `openssl rand -hex 32` |

3. **Redeploy.** Environment variables are baked in at build time, so a redeploy
   is required — the dashboard will keep saying it is not configured otherwise.
4. Open `https://your-domain/admin` and sign in.

Until step 1 is done the contact form answers with "please call or WhatsApp us"
rather than pretending to have saved anything, so no lead is silently lost.

### What the dashboard does

- **Summary** — total, awaiting reply, last 7 days (with a change against the
  previous 7), in conversation, won.
- **Enquiries per week**, last 12 weeks. Hover any week for its count; *Show
  data* opens the same numbers as a table.
- **Pipeline**: New → Contacted → Quoted → Won / Lost. Filter by status or
  project type, or search across name, phone, email, message and notes.
- **Detail drawer** — the full message, one-tap call / WhatsApp / email (the
  WhatsApp link opens with a greeting already typed), an editable status and
  internal notes.
- **Export CSV** of whatever is currently filtered.

### Security

- The password is compared in **constant time**; `===` leaks length and prefix
  through timing.
- The session is an **HMAC-signed cookie** — `HttpOnly`, `SameSite=Strict`,
  `Secure` over HTTPS, eight-hour expiry. There is no session store to leak, and
  the cookie cannot be forged without `SESSION_SECRET`.
- **Login throttling**: eight failed attempts per IP locks sign-in for fifteen
  minutes. If the store is unreachable the endpoint fails closed rather than
  handing out unlimited guesses.
- The public endpoint has a **rate limit** (six per IP per hour), a **honeypot**
  field, length caps on every field and an allowlist for project type.
- Enquiry text is written by strangers, so the dashboard puts it in the DOM
  through `textContent` only — never `innerHTML`. Injected markup renders as
  literal text.
- CSV cells beginning `=`, `+`, `-` or `@` are prefixed with `'` so a submitted
  formula cannot execute when the export is opened in Excel.
- Stored IPs are **hashed**, not kept in the clear — enough to correlate spam,
  not a retained personal identifier.
- `/admin` and `/api/` are disallowed in `robots.txt`, and the dashboard sends
  `noindex`.

**One shared password is the right weight for a studio of this size, not for a
larger team.** There is no per-user login and no audit trail of who changed what.
If several people need access, move to real accounts before that matters.

### Changing where enquiries are stored

Everything Redis-specific lives in `api/_lib/store.js`. Reimplement its exported
functions against Postgres, Supabase or anything else and nothing above it
changes. Records are plain objects:

```js
{ id, submittedAt, name, phone, email, projectType, message,
  status, notes, source, userAgent, ipHash, updatedAt }
```

### Worth adding next

Nobody is notified when an enquiry arrives — someone has to open the dashboard.
A single `fetch` to Resend, Postmark or a WhatsApp Business webhook inside
`api/enquiry.js`, right after `saveEnquiry`, would email or message you on each
new lead. That is the difference between a dashboard people check and one they
forget.

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
