// Fetches the THiNK Substack RSS feed server-side and returns it with a CORS
// header, so the Ideas page can load it from ANY domain (thinkbypan.co on
// GitHub Pages as well as thinkbypan.netlify.app). Served at /substack-feed
// via the redirect in netlify.toml.
const FEED_URL = 'https://thinkbypan.substack.com/feed';

export default async () => {
  try {
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'THiNK-site-feed/1.0' } });
    const body = await res.text();
    return new Response(body, {
      status: res.ok ? 200 : 502,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        // cache at Netlify's edge for 15 min so Substack isn't hit on every view
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600'
      }
    });
  } catch (err) {
    return new Response('Feed unavailable', { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};
