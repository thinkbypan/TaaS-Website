# THiNK website

The original single-file site has been split into five standalone pages that
share one stylesheet and one script file. This is a plain static site — no
build step required.

## Files

| File            | Page                     |
|-----------------|--------------------------|
| `index.html`    | Home                     |
| `ideas.html`    | Ideas (Substack feed)    |
| `exchange.html` | THiNK Exchange + waitlist|
| `taas.html`     | THiNK-as-a-Service       |
| `about.html`    | Who is THiNK             |
| `styles.css`    | Shared styles + fonts    |
| `app.js`        | Shared JavaScript        |
| `netlify.toml`  | Netlify deploy config    |

The navigation links point directly to the `.html` files, so every page works
on any static host with no configuration.

## Deploy to Netlify via GitHub

1. Create a new GitHub repository and push these files to it (keep them at the
   repository root):

   ```bash
   git init
   git add .
   git commit -m "Split THiNK site into separate pages"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. In Netlify: **Add new site → Import an existing project → GitHub**, and pick
   this repository.

3. Leave **Build command** empty and set **Publish directory** to `.` (the
   `netlify.toml` already sets this). Click **Deploy**.

Every push to `main` will redeploy automatically.

## Notes

- The Ideas page pulls the THiNK Substack RSS feed live in the browser through
  public CORS proxies, with a graceful fallback link if they're unavailable.
- The waitlist and enquiry forms submit through formsubmit.co to
  `think@paneffect.co`.
- Fonts are embedded in `styles.css` as base64, so the site has no external
  font dependency beyond the Google Fonts `<link>` in each page head.
