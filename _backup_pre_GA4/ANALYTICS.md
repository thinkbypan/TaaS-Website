# THiNK site — analytics

Analytics is built into `app.js` using **Plausible** (privacy-first, cookieless — no
cookie-consent banner required). Pageviews and time-on-page are automatic; every
interaction is also tracked as a named custom event.

## Turn it on (one line)

1. Create a Plausible account at https://plausible.io and add your site using the
   **exact** domain you deploy to (for example `think.paneffect.co` — no `https://`,
   no trailing slash). Self-hosting Plausible works too.
2. In `app.js`, near the top, set your domain:

   ```js
   var ANALYTICS_DOMAIN = 'think.paneffect.co'; // <-- your Plausible domain
   ```

   Until this is set it stays a silent no-op, so the site runs normally with
   analytics off.
3. Deploy. Pageviews and time-on-page start immediately.

## See the custom events

Plausible captures the events below automatically. To view each as a conversion
count (and to build funnels), add it once under **Site settings → Goals → Add goal
→ Custom event**, using the exact event name:

| Event name          | Fires when…                                   | Property captured        |
|---------------------|-----------------------------------------------|--------------------------|
| `Offer Card Open`   | A TaaS offering is opened (hover or tap)      | `card` (Project/…)       |
| `Case Study View`   | A case-study slide is navigated to            | `case` (name)            |
| `Architecture Node` | An Architecture node or Purpose is selected   | `node` (name)            |
| `FAQ Open`          | An FAQ item is expanded                       | `question`               |
| `Home Panel Click`  | A home portal panel is clicked                | `panel` (Ideas/…)        |
| `CTA Click`         | A call-to-action button/link is clicked       | `label`, `page`          |
| `Nav Click`         | A menu navigation link is clicked             | `to` (destination)       |
| `Menu Open`         | The menu overlay is opened                    | —                        |
| `Waitlist Signup`   | The Exchange waitlist form submits OK         | —                        |
| `TaaS Enquiry`      | The TaaS enquiry form submits OK              | —                        |
| `Substack Subscribe`| The Ideas page subscribe form is submitted    | —                        |
| `Section View`      | A page section first scrolls ~half into view  | `section` (name)         |
| `Case Study Time`   | Dwell time on a case study (while on screen)   | `case`, `time` (bucket)  |
| `Ideas Content Click`| A specific Substack article/podcast is clicked| `type`, `title`          |

### The three "interest" events, explained

- **`Section View`** — fires once per section as the visitor scrolls it into view.
  Read as a drop-off funnel down a page: how many reach *Case Studies*, then how
  many make it to the *FAQ*. Answers "how far through the page do people get."
- **`Case Study Time`** — measures how long a visitor lingers on each case study
  while the carousel is on screen, reported as buckets (`0-5s`, `5-15s`, `15-30s`,
  `30-60s`, `60s+`). Answers "which case study did they actually spend time on,"
  not just which they clicked. (View the breakdown via the goal's Properties →
  `case`, and cross-reference `time`.)
- **`Ideas Content Click`** — which specific Substack article or podcast episode
  they clicked from the Ideas page feed, with the title.

Note: "which node / which FAQ / which card" needs no extra events — that detail is
already in the `node` / `question` / `card` property on the existing goals above.

To see a property breakdown (e.g. which card is opened most), click the goal in the
dashboard and open the **Properties** tab.

Outbound-link clicks (the footer PAN link, Substack links, `mailto:`) are tracked
automatically and appear under **Outbound Links** — no goal needed.

## Answering your questions

- **Which pages people look at** → dashboard *Top Pages*.
- **Which they spend the most time on** → *Top Pages* → *Time on Page* / *Visit
  Duration*.
- **Which card they open** → `Offer Card Open` goal → *Properties* → `card`.
- **Funnels** (e.g. Home Panel Click → TaaS Enquiry) → Plausible *Funnels* (paid plans).

## Switching providers later

Everything routes through one `track(name, props)` function and one injected snippet
at the top of `app.js`. To move to GA4/PostHog/etc., change only that block — the
event instrumentation across the site stays as-is.
