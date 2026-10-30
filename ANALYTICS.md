# THiNK site — analytics (Google Analytics 4)

Measurement ID: **G-LXSZK10BWC** (GA4 property "THiNK website", Australia/Sydney time, AUD).

- The Google tag (gtag.js) sits at the top of `<head>` on every page.
- Pageviews, scrolls and outbound-link clicks come from GA4 **Enhanced Measurement**
  (keep *Form interactions* OFF — the site sends its own form-success events).
- Every interaction is a custom event sent through one `track(name, props)` function in
  the ANALYTICS block (in `app.js` and the inline copy on each page). It converts the
  readable name to GA4 snake_case, e.g. `track('Waitlist Signup')` → `waitlist_signup`.

Previous Plausible version is kept in `_backup_pre_GA4/`.

## Events sent

| GA4 event              | Fires when…                                   | Parameters            |
|------------------------|-----------------------------------------------|-----------------------|
| `offer_card_open`      | A TaaS offering is opened (hover or tap)      | `card`                |
| `case_study_view`      | A case-study slide is navigated to            | `case`                |
| `architecture_node`    | An Architecture node or Purpose is selected   | `node`                |
| `faq_open`             | An FAQ item is expanded                       | `question`            |
| `home_panel_click`     | A home portal panel is clicked                | `panel`               |
| `cta_click`            | A call-to-action button/link is clicked       | `label`, `page`       |
| `nav_click`            | A menu navigation link is clicked             | `to`                  |
| `menu_open`            | The menu overlay is opened                    | —                     |
| `waitlist_signup`      | The Exchange waitlist form submits OK         | —                     |
| `taas_enquiry`         | The TaaS enquiry form submits OK              | —                     |
| `substack_subscribe`   | The Ideas page subscribe form is submitted    | —                     |
| `section_view`         | A page section first scrolls ~half into view  | `section`             |
| `case_study_time`      | Dwell time on a case study (while on screen)  | `case`, `time`        |
| `ideas_content_click`  | A Substack article/podcast is clicked         | `type`, `title`       |

## One-off GA4 admin setup

1. **Admin → Events** (after events start arriving, up to 24h): mark `waitlist_signup`,
   `taas_enquiry` and `substack_subscribe` as **Key events**.
2. **Admin → Custom definitions → Create custom dimension** (scope: Event) for each
   parameter: `card`, `case`, `node`, `question`, `panel`, `label`, `page`, `to`,
   `section`, `time`, `type`, `title`. Without this the values are collected but not
   reportable. Not retroactive — do it early.
3. **Admin → Data retention**: raise from 2 to 14 months.
4. **Admin → Data streams → Configure tag settings → List unwanted referrals** isn't
   needed; but under *Define internal traffic* you can exclude the PAN office IP.

## Where to look

- Which pages / time on page → Reports → Engagement → **Pages and screens**.
- Which card / FAQ / case study → Explore → Free form, dimension = the custom
  dimension, filter Event name = the event.
- Funnels (e.g. home_panel_click → taas_enquiry) → Explore → **Funnel exploration**.
- Live check → Reports → **Realtime**, or Admin → **DebugView** with the
  Google Tag Assistant extension.
