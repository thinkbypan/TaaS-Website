# THiNK forms → HubSpot

The Exchange waitlist (`exchange.html`) and TaaS enquiry (`taas.html`) forms feed
HubSpot as contacts using the **HubSpot Forms Submissions API**. The forms on
screen are unchanged — `exchange.html`, `taas.html` and `styles.css` are all
untouched. The only edited file is `app.js`.

## Why this approach

Instead of HubSpot's embed widget (which would drop HubSpot's own markup and
styling into the page), the existing THiNK forms post directly to HubSpot's
submissions endpoint. HubSpot records a real submission — creating/updating the
contact, logging it on the timeline, firing any workflow you attach — while the
form keeps the design you built.

- **Public, unauthenticated endpoint** — the same one HubSpot's embedded forms
  use. No API key in the site, nothing secret, no backend to run. The portal ID
  and form GUIDs are safe to commit.
- **No cookies** — no HubSpot script loads, so the site stays cookieless and
  consent-banner-free, consistent with the Plausible setup in `ANALYTICS.md`.
  The trade-off is no session attribution; if you ever add HubSpot's tracking
  code, `app.js` already forwards the `hubspotutk` cookie and attribution starts
  working with no further change.

The account is in HubSpot's **ap1** (Asia-Pacific) region, but the submission
endpoint `api.hsforms.com` is global and routes to the right region on its own —
so no region setting is needed anywhere in the code.

---

## Status

| Form | HubSpot form | Config in `app.js` | State |
|------|--------------|--------------------|-------|
| Exchange waitlist | ✅ created | ✅ portal + GUID filled in | **Ready — deploy & test** |
| TaaS enquiry | ✅ created | ✅ GUID filled in | **Ready — deploy & test** |

The config lives at the top of the `HUBSPOT` block in `app.js`:

```js
var HUBSPOT_PORTAL_ID          = '443645477';                            // done
var HUBSPOT_WAITLIST_FORM_GUID = '4996eac8-6423-4d14-bbb1-f10f8eac8931'; // done
var HUBSPOT_ENQUIRY_FORM_GUID  = '7a35dce4-7920-4a93-bed3-5ef87f4b2bae'; // done
```

Any form whose GUID is blank automatically falls back to emailing
`think@paneffect.co` through formsubmit.co, so nothing breaks in the meantime.

---

## 1. Waitlist — finish & test

The code is done. Two things to confirm in HubSpot, then deploy.

**a. Field names match.** HubSpot rejects the *entire* submission if the page
sends a property the form doesn't have. The page sends these four — each must be
a field on your waitlist form:

| Sent by the page | HubSpot property |
|------------------|------------------|
| First name       | `firstname`                  |
| Last name        | `lastname`                   |
| Email            | `email`                      |
| Curious-about text | `what_are_you_curious_about` (custom property) |

`what_are_you_curious_about` is a custom contact property — make sure it's added
to the waitlist form, or HubSpot rejects the submission.

**b. Email notifications.** The old formsubmit.co email is gone, so set where
submissions notify you: on the form, **Settings → Notifications**, add
`think@paneffect.co`. Or build a workflow (below) if you want more than an email.

**c. Deploy.** Commit and push `app.js` — Netlify redeploys automatically.

**d. Test live.** Submit the form with a real address you can check. The contact
should appear under **Contacts** within seconds, with the submission on its
timeline. If the success message doesn't show, open the browser console — a
failure logs as `[waitlist] HubSpot 400: ...` and names the offending field.

---

## 2. TaaS enquiry — finish & test

The code is done. Confirm the form has these five fields (internal names), then
deploy and test exactly as with the waitlist:

| Field       | HubSpot property | Notes |
|-------------|------------------|-------|
| First name  | `firstname`      | contact |
| Last name   | `lastname`       | contact |
| Email       | `email`          | contact |
| Company     | `company`        | creates/associates a **company** record |
| What they want to solve | `what_are_you_looking_to_solve` | custom property — must be on the form |

Set its email notification (**Settings → Notifications** → `think@paneffect.co`)
and test with a real submission. A failure logs to the console as
`[enquiry] HubSpot 400: ...`.

---

## Getting notified

Email now comes from HubSpot, not formsubmit.co:

- **Form notifications** — form **Settings → Notifications**, add
  `think@paneffect.co`. Simplest.
- **A workflow** — *Marketing → Automation → Workflows*, triggered on form
  submission, if you also want to set a lifecycle stage, assign an owner, add the
  contact to a THiNK Exchange list, or send an automated welcome email. Worth
  building a HubSpot list of waitlist signups now — it becomes the invite list
  when the first Exchange event opens.

## Field mapping lives in one place

Each form's mapping is a single object in `app.js` (left = HubSpot internal
property, right = the input's `name` on the page):

```js
// waitlist
firstname: get('fname'), lastname: get('lname'), email: get('email'),
what_are_you_curious_about: get('curious')
// enquiry
firstname: get('fname'), lastname: get('lname'), email: get('email'), company: get('company'),
what_are_you_looking_to_solve: get('message')
```

Each open-text answer now lands in its own custom contact property, so you can
filter and build lists on them (e.g. everyone curious about a given topic). The
`get('...')` argument on the right is the input's `name` on the page and never
changes; only the HubSpot property on the left would change if you renamed a
property.

## What changed

| File            | Change |
|-----------------|--------|
| `app.js`        | `HUBSPOT` config block + `submitToHubspot()` helper; both the waitlist and enquiry submit handlers now post to HubSpot when configured, with the formsubmit.co path kept as an automatic per-form fallback. Client-side honeypot on both. Phone added to both mappings. |
| `exchange.html` | Added an optional **Phone** field beside Email. |
| `taas.html`     | Added an optional **Phone** field (email + phone row; company moved to its own row). |
| `styles.css`    | One line: `input[type="tel"]` added to the field-style selector so the phone input matches the existing underline style. |

Phone is optional on both pages, mapped to HubSpot's built-in `phone` contact
property. Left blank, it's simply not sent — so keep the phone field **not
required** on the HubSpot forms, or empty-phone submissions get rejected.

Both `Waitlist Signup` and `TaaS Enquiry` Plausible events still fire on success,
so analytics is unaffected.
