  // ==========================================================================
  // ANALYTICS
  // --------------------------------------------------------------------------
  // One place to configure analytics for the whole site. Set ANALYTICS_DOMAIN
  // to the exact domain you register in your Plausible account (for example
  // 'think.paneffect.co' — no https://, no trailing slash). Until it is set,
  // every call below is a silent no-op, so the site works normally before
  // analytics is switched on.
  //
  // Pageviews and time-on-page are tracked automatically once the domain is
  // set. Everything else is a custom event sent through track(name, props).
  // Because all tracking flows through track(), you can switch providers later
  // by editing only this block (e.g. swap the injected snippet + track body).
  // ==========================================================================
  var ANALYTICS_DOMAIN = 'thinkbypan.netlify.app'; // <-- set to your Plausible domain to turn analytics on

  (function(){
    if(!ANALYTICS_DOMAIN) return;
    var s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', ANALYTICS_DOMAIN);
    // This Plausible build also auto-tracks outbound-link clicks (the footer
    // PAN link, Substack links, mailto), so those need no manual code.
    s.src = 'https://plausible.io/js/script.outbound-links.js';
    document.head.appendChild(s);
  })();
  // queue stub so events fired before the script loads are not lost
  window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments); };

  // track(name, props?) — the single entry point for every custom event.
  function track(name, props){
    try { window.plausible(name, props ? { props: props } : undefined); } catch(e){}
  }
  var clean = function(s){ return (s || '').replace(/\s+/g, ' ').trim().slice(0, 80); };

  // --- Global interactions present on every page ---------------------------
  // Menu open
  var _mOpen = document.getElementById('menuOpen');
  if(_mOpen) _mOpen.addEventListener('click', function(){ track('Menu Open'); });
  // Overlay nav links (each link is "<span>→</span>Label"; the arrow span is
  // stripped so the property is just the destination name)
  document.querySelectorAll('#overlay nav a').forEach(function(a){
    a.addEventListener('click', function(){ track('Nav Click', { to: clean(a.textContent).replace(/^[^A-Za-z0-9]+/, '') }); });
  });
  // Home hero/section CTAs that are links (exclude form submit buttons — those
  // are tracked as conversions on successful submit instead)
  document.querySelectorAll('.btn:not([type="submit"])').forEach(function(b){
    b.addEventListener('click', function(){ track('CTA Click', { label: clean(b.textContent), page: document.title }); });
  });
  // Home page: the three portal panels (Ideas / Exchange / TaaS)
  document.querySelectorAll('.panel-btn').forEach(function(p){
    var emph = p.querySelector('.panel-emphasis');
    p.addEventListener('click', function(){ track('Home Panel Click', { panel: clean(emph ? emph.textContent : p.textContent) }); });
  });
  // Ideas page: Substack subscribe form
  var _sub = document.querySelector('.ideas-subscribe-form');
  if(_sub) _sub.addEventListener('submit', function(){ track('Substack Subscribe'); });

  // Ideas page: clicks on specific Substack articles / podcast episodes. The
  // feed is rendered asynchronously, so we delegate from the list containers.
  function feedDelegate(id, type){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', function(e){
      var item = e.target.closest && e.target.closest('.feed-item');
      if(!item || !el.contains(item)) return;
      var t = item.querySelector('.feed-item-title');
      track('Ideas Content Click', { type: type, title: clean(t ? t.textContent : '') });
    });
  }
  feedDelegate('articlesList', 'Article');
  feedDelegate('podcastList', 'Podcast');

  // Section reached: how far through a page visitors get. Fires once, the first
  // time each section is ~50% on screen, so you can see the drop-off down a page
  // (e.g. how many reach Case Studies, then the FAQ). More reliable here than a
  // scroll-percentage, and more useful — it names the actual section.
  (function(){
    if(!('IntersectionObserver' in window)) return;
    var sections = document.querySelectorAll('section[id]');
    if(!sections.length) return;
    function sectionName(sec){
      var num = sec.querySelector('.num');
      if(num) return clean(num.textContent);
      var eye = sec.querySelector('.eyebrow');
      if(eye) return clean(eye.textContent);
      return sec.id || 'section';
    }
    var seen = {};
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        var id = en.target.id;
        if(seen[id]) return;
        seen[id] = true;
        track('Section View', { section: sectionName(en.target) });
        io.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    sections.forEach(function(s){ io.observe(s); });
  })();

  // nav overlay
  const overlay = document.getElementById('overlay');
  document.getElementById('menuOpen').onclick = () => overlay.classList.add('open');
  document.getElementById('menuClose').onclick = () => overlay.classList.remove('open');
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.classList.remove('open')));


  // ===== Cross-page navigation =====
  // The site was originally a single-page app that swapped in-page "views".
  // Now each view is its own HTML file, so nav links are real hrefs. Any
  // remaining [data-view] elements (e.g. <button> CTAs) are wired up here to
  // navigate to the matching page, preserving optional data-anchor scroll.
  const VIEW_TO_PAGE = { home:'index.html', media:'ideas.html', exchange:'exchange.html', business:'taas.html', about:'about.html' };
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = VIEW_TO_PAGE[el.dataset.view] || 'index.html';
      const anchor = el.dataset.anchor ? ('#' + el.dataset.anchor) : '';
      window.location.href = page + anchor;
    });
  });

  // ===== IDEAS PAGE: live Substack feed (Articles + Podcast) =====
  // Pulls the THiNK Substack RSS feed client-side so the Articles/Podcast
  // lists on the Ideas page always reflect what's live on Substack, with
  // no need to edit this file when new posts go out.
  //
  // Substack doesn't send CORS headers on its raw RSS XML, so we go through
  // a public proxy that fetches the feed server-side and hands it back in a
  // CORS-friendly way. rss2json.com's free tier is rate-limited (and can be
  // unavailable outright at times), so it's tried first and then backed up
  // by a second proxy (allorigins) that returns the raw XML, which we parse
  // ourselves — this way one proxy having a bad day doesn't take the whole
  // feed down. Results are cached in localStorage for 30 minutes to keep
  // requests low. If this publication's podcast episodes ever move to their
  // own dedicated RSS feed, swap SUBSTACK_FEED_URL below for that feed's
  // address.
  (function(){
    const articlesEl = document.getElementById('articlesList');
    const podcastEl = document.getElementById('podcastList');
    if(!articlesEl || !podcastEl) return;

    const SUBSTACK_FEED_URL = 'https://thinkbypan.substack.com/feed';
    const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(SUBSTACK_FEED_URL);
    // Same-origin path that netlify.toml proxies straight to the Substack feed.
    // Being same-origin means no CORS problem and no third-party proxy to go down.
    const SAME_ORIGIN_FEED = '/substack-feed';
    // thinkbypan.co is served by GitHub Pages, where /substack-feed doesn't exist,
    // so fall back to the Netlify Function directly (it sends a CORS header).
    const NETLIFY_FEED = 'https://thinkbypan.netlify.app/substack-feed';
    const FETCH_TIMEOUT_MS = 8000;
    // v2: drops any stale v1 cache phones may still be holding
    const CACHE_KEY = 'think_substack_feed_v2';
    const CACHE_TTL_MS = 30 * 60 * 1000;

    function stripHtml(html){
      const tmp = document.createElement('div');
      tmp.innerHTML = html || '';
      return (tmp.textContent || tmp.innerText || '').replace(/\s+/g,' ').trim();
    }
    function truncate(text, len){
      if(!text) return '';
      if(text.length <= len) return text;
      return text.slice(0, len).replace(/\s+\S*$/, '') + '\u2026';
    }
    function formatDate(dateStr){
      const d = new Date(dateStr);
      if(isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-AU', {day:'numeric', month:'short', year:'numeric'});
    }
    function escapeHtml(str){
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }
    function parseRssXml(xmlText){
      // Fallback path: parse a raw RSS 2.0 document into the same
      // {title, link, pubDate, description} shape rss2json normally gives us.
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      if(doc.querySelector('parsererror')) throw new Error('Feed XML failed to parse');
      return Array.from(doc.querySelectorAll('item')).map(item => {
        const get = (tag) => { const n = item.querySelector(tag); return n ? n.textContent : ''; };
        return {
          title: get('title'),
          link: get('link'),
          pubDate: get('pubDate'),
          description: get('description') || get('encoded') || ''
        };
      });
    }
    function isPodcastItem(item){
      // Substack doesn't expose a distinct "subtitle" field via RSS, so the
      // post's subtitle/dek text lives inside the description. An episode is
      // classified as podcast content whenever that subtitle text mentions
      // "podcast" — anywhere in the word (e.g. "Podcast", "podcasts",
      // "THiNK Podcast: ..."). Everything else is treated as an article.
      const subtitle = stripHtml(item.description).toLowerCase();
      return subtitle.indexOf('podcast') !== -1;
    }
    function renderItems(el, items){
      el.innerHTML = items.map(item => {
        const sub = truncate(stripHtml(item.description), 110);
        return '<a class="feed-item" href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener noreferrer">'
          + '<span class="feed-item-date">' + escapeHtml(formatDate(item.pubDate)) + '</span>'
          + '<h4 class="feed-item-title">' + escapeHtml(item.title) + '</h4>'
          + (sub ? '<p class="feed-item-sub">' + escapeHtml(sub) + '</p>' : '')
          + '</a>';
      }).join('');
    }
    function renderFallback(el, message){
      el.innerHTML = '<p class="feed-status">' + message + '</p>';
    }
    function byNewest(items){
      // always newest first, whatever order the feed or a proxy returns
      return items.slice().sort((a, b) => (new Date(b.pubDate).getTime() || 0) - (new Date(a.pubDate).getTime() || 0));
    }
    function applyFeed(items){
      items = byNewest(items);
      const podcasts = items.filter(isPodcastItem).slice(0, 3);
      const articles = items.filter(i => !isPodcastItem(i)).slice(0, 3);

      if(articles.length){
        renderItems(articlesEl, articles);
      } else {
        renderFallback(articlesEl, 'New articles will appear here as soon as they\u2019re published. <a href="https://thinkbypan.substack.com" target="_blank" rel="noopener noreferrer">Visit THiNK Media &rarr;</a>');
      }
      if(podcasts.length){
        renderItems(podcastEl, podcasts);
      } else {
        renderFallback(podcastEl, 'New episodes will appear here as soon as they\u2019re published. <a href="https://thinkbypan.substack.com" target="_blank" rel="noopener noreferrer">Visit THiNK Media &rarr;</a>');
      }
    }
    function loadFromCache(){
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if(cached && cached.items && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.items;
      } catch(err){ /* localStorage unavailable or corrupt cache — ignore */ }
      return null;
    }
    function saveToCache(items){
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items: items})); }
      catch(err){ /* storage full or unavailable — non-fatal */ }
    }

    // Show any cached posts straight away, but ALWAYS fetch the live feed as well, so a
    // phone never keeps showing an older set of posts (mobile browsers hold on to caches).
    const cachedItems = loadFromCache();
    if(cachedItems) applyFeed(cachedItems);

    // Every request gets a timeout, so a proxy that hangs can never leave the
    // lists stuck on "Loading…" — it just falls through to the next source.
    function fetchWithTimeout(url){
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;
      // cache-busting query + no-store so mobile browsers can't serve an old copy of the feed
      const fresh = url + (url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
      const opts = { cache: 'no-store' };
      if(ctrl) opts.signal = ctrl.signal;
      return fetch(fresh, opts)
        .finally(() => { if(timer) clearTimeout(timer); });
    }
    // 1st choice: the site's own Netlify proxy (see netlify.toml).
    function fetchViaNetlify(){
      return fetchFeedXml(SAME_ORIGIN_FEED).catch(() => fetchFeedXml(NETLIFY_FEED));
    }
    function fetchFeedXml(url){
      return fetchWithTimeout(url)
        .then(res => { if(!res.ok) throw new Error('Feed proxy ' + res.status); return res.text(); })
        .then(xmlText => {
          const items = parseRssXml(xmlText);
          if(!items.length) throw new Error('Empty feed from Netlify proxy');
          return items;
        });
    }
    // Backup: rss2json (rate-limited public service).
    function fetchViaRss2json(){
      return fetchWithTimeout(RSS2JSON_API)
        .then(res => res.json())
        .then(data => {
          if(data.status !== 'ok' || !Array.isArray(data.items) || !data.items.length){
            throw new Error('Unexpected feed response from rss2json');
          }
          return data.items;
        });
    }

    fetchViaNetlify()
      .catch(() => fetchViaRss2json())
      .then(items => {
        applyFeed(items);
        saveToCache(items);
      })
      .catch(() => {
        if(cachedItems) return; // live fetch failed: keep showing the cached posts
        const msg = 'The latest posts are on THiNK Media. <a href="https://thinkbypan.substack.com" target="_blank" rel="noopener noreferrer">Read on Substack &rarr;</a>';
        renderFallback(articlesEl, msg);
        renderFallback(podcastEl, msg);
      });
  })();

  // ===== Flip banners: Chase the Dreams / Change the World =====
  (function(){
    const flipEls = document.querySelectorAll('.flip-inner');
    if(!flipEls.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion) return;
    setInterval(() => flipEls.forEach(el => el.classList.toggle('flipped')), 2800);
  })();

  // scroll reveal
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => { o.classList.remove('open'); o.querySelector('.faq-a').style.maxHeight = null; });
      if (!isOpen) {
        item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px';
        const qt = item.querySelector('.faq-q-text');
        track('FAQ Open', { question: clean(qt ? qt.textContent : q.textContent) });
      }
    });
  });

  // ==========================================================================
  // HUBSPOT
  // --------------------------------------------------------------------------
  // Waitlist signups are written straight into HubSpot as contacts using the
  // Forms Submissions API. Two things worth knowing about why it's done this way:
  //
  //  1. This endpoint is PUBLIC and unauthenticated by design — it's the same
  //     one HubSpot's own embedded forms use. There is no API key in this file
  //     and nothing secret to leak. The portal ID and form GUID are safe to
  //     commit and safe to see in the browser's network tab.
  //  2. No HubSpot script is loaded and no HubSpot cookie is set, so the site
  //     stays cookieless and needs no consent banner (see ANALYTICS.md). The
  //     trade-off is that HubSpot can't attribute a signup to an earlier
  //     browsing session — it just gets the contact. If HubSpot's tracking code
  //     is ever added, the `hutk` cookie below is picked up automatically and
  //     attribution starts working with no further change here.
  //
  // SETUP — these values come from the HubSpot embed code (see HUBSPOT.md).
  // The account is region ap1; the submissions endpoint below (api.hsforms.com)
  // is global and routes to the right region on its own, so no region is needed.
  var HUBSPOT_PORTAL_ID = '443645477';  // <-- PAN/THiNK HubSpot account (hub) ID
  var HUBSPOT_WAITLIST_FORM_GUID = '4996eac8-6423-4d14-bbb1-f10f8eac8931'; // Exchange waitlist form
  var HUBSPOT_ENQUIRY_FORM_GUID  = '7a35dce4-7920-4a93-bed3-5ef87f4b2bae'; // TaaS enquiry form (taas.html)
  //
  // Each form falls back to emailing think@paneffect.co through formsubmit.co
  // whenever its GUID (or the portal ID) is blank, so the live site keeps
  // working while HubSpot is being set up.
  // ==========================================================================
  var HUBSPOT_ENDPOINT = 'https://api.hsforms.com/submissions/v3/integration/submit';

  // Read HubSpot's tracking cookie if it happens to exist. Absent on this site
  // today (no HubSpot script), which is fine — the field is simply omitted.
  function hubspotUtk(){
    var m = document.cookie.match(/(^|;)\s*hubspotutk=([^;]*)/);
    return m ? decodeURIComponent(m[2]) : null;
  }

  // Post a set of {hubspotProperty: value} pairs to a HubSpot form. Returns a
  // Promise that rejects on any non-2xx response, so the caller can show the
  // error note that already exists in the markup.
  function submitToHubspot(formGuid, values){
    var fields = Object.keys(values)
      .filter(function(k){ return values[k] != null && String(values[k]).trim() !== ''; })
      .map(function(k){ return { objectTypeId: '0-1', name: k, value: String(values[k]).trim() }; });

    var context = { pageUri: window.location.href, pageName: document.title };
    var utk = hubspotUtk();
    if(utk) context.hutk = utk;

    return fetch(HUBSPOT_ENDPOINT + '/' + HUBSPOT_PORTAL_ID + '/' + formGuid, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedAt: Date.now(), fields: fields, context: context })
    }).then(function(res){
      if(!res.ok) return res.text().then(function(t){ throw new Error('HubSpot ' + res.status + ': ' + t); });
      return res.json();
    });
  }

  // ===== THiNK Exchange: waitlist form =====
  (function(){
    const form = document.getElementById('waitlistForm');
    if(!form) return;
    const success = document.getElementById('formSuccess');
    const errorNote = document.getElementById('waitlistError');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', e => {
      e.preventDefault();

      // Honeypot: the hidden _honey field is invisible to people and irresistible
      // to bots. formsubmit.co used to enforce this server-side; now that the
      // submission goes to HubSpot it is checked here instead. If it's filled we
      // show the success state and send nothing.
      const honey = form.querySelector('[name="_honey"]');
      if(honey && honey.value){
        form.hidden = true;
        if(success) success.hidden = false;
        return;
      }

      if(errorNote) errorNote.hidden = true;
      const originalLabel = submitBtn ? submitBtn.textContent : '';
      if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      const get = n => { const el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };

      let request;
      if(HUBSPOT_PORTAL_ID && HUBSPOT_WAITLIST_FORM_GUID){
        // Left side = the HubSpot contact property's INTERNAL name, right side =
        // the field on this page. Every property listed here must also exist as
        // a field on the HubSpot form, or HubSpot rejects the whole submission.
        request = submitToHubspot(HUBSPOT_WAITLIST_FORM_GUID, {
          firstname: get('fname'),
          lastname:  get('lname'),
          email:     get('email'),
          phone:     get('phone'),
          think_audience: 'Exchange',                 // tags the contact's source
          what_are_you_curious_about: get('curious')  // custom contact property
        });
      } else {
        // Fallback while HubSpot isn't configured yet — original behaviour.
        request = fetch('https://formsubmit.co/ajax/think@paneffect.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
        }).then(res => { if(!res.ok) throw new Error('Request failed'); return res.json(); });
      }

      request
        .then(() => {
          form.hidden = true;
          if(success) success.hidden = false;
          track('Waitlist Signup');
        })
        .catch((err) => {
          if(window.console && console.warn) console.warn('[waitlist]', err);
          if(errorNote) errorNote.hidden = false;
          if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
        });
    });
  })();

  // ===== TaaS page: enquiry form =====
  (function(){
    const form = document.getElementById('enquiryForm');
    if(!form) return;
    const success = document.getElementById('enquirySuccess');
    const errorNote = document.getElementById('enquiryError');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', e => {
      e.preventDefault();

      // Honeypot — same as the waitlist form.
      const honey = form.querySelector('[name="_honey"]');
      if(honey && honey.value){
        form.hidden = true;
        if(success) success.hidden = false;
        return;
      }

      if(errorNote) errorNote.hidden = true;
      const originalHTML = submitBtn ? submitBtn.innerHTML : '';
      if(submitBtn){ submitBtn.disabled = true; submitBtn.innerHTML = '<span>Sending…</span>'; }

      const get = n => { const el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };

      let request;
      if(HUBSPOT_PORTAL_ID && HUBSPOT_ENQUIRY_FORM_GUID){
        // `company` is a HubSpot company property; including it on the form makes
        // HubSpot create/associate a company record alongside the contact.
        request = submitToHubspot(HUBSPOT_ENQUIRY_FORM_GUID, {
          firstname: get('fname'),
          lastname:  get('lname'),
          email:     get('email'),
          phone:     get('phone'),
          company:   get('company'),
          think_audience: 'TaaS',                         // tags the contact's source
          what_are_you_looking_to_solve_: get('message')  // custom contact property
        });
      } else {
        // Fallback while the enquiry form isn't configured yet — original behaviour.
        request = fetch('https://formsubmit.co/ajax/think@paneffect.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
        }).then(res => { if(!res.ok) throw new Error('Request failed'); return res.json(); });
      }

      request
        .then(() => {
          form.hidden = true;
          if(success) success.hidden = false;
          track('TaaS Enquiry');
        })
        .catch((err) => {
          if(window.console && console.warn) console.warn('[enquiry]', err);
          if(errorNote) errorNote.hidden = false;
          if(submitBtn){ submitBtn.disabled = false; submitBtn.innerHTML = originalHTML; }
        });
    });
  })();

  // ===== TaaS page: offerings grid (Project / Execution / Lab / Bespoke) — tap-to-flip for touch =====
  (function(){
    const grid = document.getElementById('offerGrid');
    if(!grid) return;
    const cards = Array.from(grid.querySelectorAll('.offer-flip'));
    if(!cards.length) return;

    // Record the first time each card's detail is revealed this pageview —
    // whether by tap (mobile) or hover (desktop, where the CSS flips the card
    // on :hover without a click). Deduped so a hover then tap counts once.
    var openedCards = {};
    function markOpen(card){
      var t = card.querySelector('.offer-title');
      var name = clean(t ? t.textContent : '');
      if(openedCards[name]) return;
      openedCards[name] = true;
      track('Offer Card Open', { card: name });
    }
    function toggleCard(card){
      card.classList.toggle('flipped');
      if(card.classList.contains('flipped')) markOpen(card); // count opens, not closes
    }
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => markOpen(card));
      card.addEventListener('click', () => toggleCard(card));
      card.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleCard(card); }
      });
    });

    // Make every offer card the same height as the tallest one, sized to its
    // content so no card ever needs to scroll. --offer-h drives min-height in
    // the CSS. Recomputed on resize and once web fonts have loaded (font swap
    // changes text height). The cards auto-size to content (align-items:start
    // on the grid), so reading offsetHeight with the var cleared gives each
    // card's natural height.
    let raf = null;
    function equalizeOfferCards(){
      grid.style.setProperty('--offer-h', 'auto');
      cards.forEach(c => c.style.minHeight = 'auto');
      // force reflow so natural heights are current
      void grid.offsetHeight;
      let max = 0;
      cards.forEach(c => { max = Math.max(max, c.offsetHeight); });
      cards.forEach(c => c.style.minHeight = '');
      grid.style.setProperty('--offer-h', max + 'px');
    }
    function scheduleEqualize(){
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(equalizeOfferCards);
    }
    scheduleEqualize();
    window.addEventListener('resize', scheduleEqualize);
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(scheduleEqualize); }
    window.addEventListener('load', scheduleEqualize);
  })();

  // ===== TaaS page: What THiNK Does — fade cycle through Insight / Ideas / Innovation =====
  (function(){
    const stage = document.getElementById('doesFadeStage');
    if(!stage) return;
    const words = Array.from(stage.querySelectorAll('.does-fade-word'));
    if(!words.length) return;
    let i = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion) return;
    setInterval(() => {
      words[i].classList.remove('is-active');
      i = (i + 1) % words.length;
      words[i].classList.add('is-active');
    }, 2600);
  })();

  // ===== TaaS page: case study carousel (Why THiNK is Different) =====
  // All six case tiles are rendered in the markup from the start (see #caseStripTrack).
  // Arrows/dots slide the track; there is no scroll listener of any kind here, so
  // normal page scrolling is never captured.
  (function(){
    const wrap = document.getElementById('caseStripWrap');
    if(!wrap) return;
    const track = document.getElementById('caseStripTrack');
    const tiles = Array.from(track.querySelectorAll('.case-tile'));
    const dots = Array.from(document.querySelectorAll('.case-dot'));
    const prevBtn = wrap.querySelector('.case-prev');
    const nextBtn = wrap.querySelector('.case-next');
    const windowEl = wrap.querySelector('.case-strip-window');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = tiles.length;
    let index = 0;

    function layout(){
      // centre the active tile within the visible window, so neighbouring
      // tiles peek at both edges — this is what lets people see there is
      // more to explore without needing to interact first.
      const tile = tiles[index];
      if(!tile) return;
      const windowWidth = windowEl.clientWidth;
      const offset = tile.offsetLeft - (windowWidth - tile.offsetWidth) / 2;
      track.style.transition = reduceMotion ? 'none' : '';
      track.style.transform = 'translateX(' + (-offset) + 'px)';
    }

    function render(){
      tiles.forEach((t, i) => t.classList.toggle('is-active', i === index));
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
      layout();
    }

    // --- Dwell time on each case study --------------------------------------
    // How long the visitor lingers on a given case, so you can see which ones
    // actually hold attention (not just which were clicked). Timing only runs
    // while the carousel is on screen, and is flushed when they switch case,
    // scroll it out of view, or leave the page. Reported as coarse buckets to
    // keep the property low-cardinality. NB: local `track` is the DOM strip, so
    // the analytics fn is called via window.track.
    function caseTitle(i){
      var t = tiles[i] && tiles[i].querySelector('.case-title');
      return clean(t ? t.textContent : ('Case ' + (i + 1)));
    }
    function bucket(sec){
      if(sec < 5) return '0-5s';
      if(sec < 15) return '5-15s';
      if(sec < 30) return '15-30s';
      if(sec < 60) return '30-60s';
      return '60s+';
    }
    var dwellStart = null, dwellCase = null, inView = false;
    function endDwell(){
      if(dwellStart != null && dwellCase != null){
        var sec = Math.round((Date.now() - dwellStart) / 1000);
        if(sec >= 3) window.track('Case Study Time', { case: dwellCase, time: bucket(sec) });
      }
      dwellStart = null; dwellCase = null;
    }
    function startDwell(){ dwellCase = caseTitle(index); dwellStart = Date.now(); }

    function goTo(i){
      var inViewNow = inView;
      if(inViewNow) endDwell();               // close out time on the case we're leaving
      index = (i + count) % count;
      render();
      var title = tiles[index] && tiles[index].querySelector('.case-title');
      window.track('Case Study View', { case: clean(title ? title.textContent : ('Case ' + (index + 1))) });
      if(inViewNow) startDwell();             // begin timing the newly shown case
    }

    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    if(nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1));
    if(prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1));
    tiles.forEach((t, i) => t.addEventListener('click', () => { if(i !== index) goTo(i); }));

    // start/stop timing as the carousel enters / leaves the viewport
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting && !inView){ inView = true; startDwell(); }
          else if(!en.isIntersecting && inView){ inView = false; endDwell(); }
        });
      }, { threshold: 0.4 }).observe(wrap);
    }
    // flush the current case's time when the visitor leaves the page
    window.addEventListener('pagehide', endDwell);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) endDwell(); });

    window.addEventListener('resize', layout);
    render();
  })();

  // ===== THiNK Exchange: audience flip cards (tap support for touch) =====
  document.querySelectorAll('.audience-flip').forEach(card => {
    card.addEventListener('click', e => {
      if(e.target.closest('a')) return; // let CTA links work normally
      card.classList.toggle('flipped');
    });
    card.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });

  // ===== THiNK Architecture: solar system visual =====
  (function(){
    const essences = [
      { title:"Neither Humble Nor Arrogant", text:"The balance between confidence and intellectual flexibility." },
      { title:"The Question Is More Powerful Than The Answer", text:"Better questions create better thinking." },
      { title:"Question For Yes", text:"A mindset that looks for possibility." },
      { title:"The Best Idea Is Yet To Be Created", text:"Better ideas emerge when thinking is challenged and expanded." },
      { title:"People With Passion Can Change The World", text:"Passion is the conviction to keep moving toward a meaningful purpose, even when the path forward is unclear." },
      { title:"There Is Always Another Mountain", text:"A commitment to progress, growth and what's next." }
    ];
    const PLANET_COLOR = '#eb1c24';   // brand red
    const RING_COLOR = 'rgba(150,140,130,0.16)'; // charcoal/beige, neutral orbit lines

    const stage = document.getElementById('archStage');
    const canvas = document.getElementById('archCanvas');
    const labelsEl = document.getElementById('archLabels');
    const captionEl = document.getElementById('archCaption');
    const purposeTag = document.querySelector('.arch-purpose-tag');
    if(!stage || !canvas) return;
    const ctx = canvas.getContext('2d');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionScale = reduceMotion ? 0.15 : 1;

    let W = 0, H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let activeIndex = null, hoverIndex = null, purposeActive = false;
    let speedMul = 1, speedMulTarget = 1;

    const deg = d => d*Math.PI/180;
    // each orbit sits on its own tilted plane and inclination, for a gyroscopic, non-flat feel
    const orbitDefs = [
      { rx:0.30, period:18, tilt:deg(15),  incl:0.82 },
      { rx:0.42, period:24, tilt:deg(58),  incl:0.50 },
      { rx:0.54, period:30, tilt:deg(102), incl:0.34 },
      { rx:0.66, period:36, tilt:deg(136), incl:0.70 },
      { rx:0.78, period:42, tilt:deg(163), incl:0.48 },
      { rx:0.88, period:50, tilt:deg(34),  incl:0.62 }
    ];

    const planets = essences.map((ess, i) => {
      const def = orbitDefs[i % orbitDefs.length];
      return Object.assign({}, ess, {
        color: PLANET_COLOR,
        rx: def.rx, ry: def.rx * def.incl, tilt: def.tilt,
        angle: Math.random()*Math.PI*2,
        speed: (Math.PI*2)/def.period,
        baseRadius: 5 + (i%3),
        x:0, y:0, depth:0, screenR:6, labelX:null, labelY:null
      });
    });

    // background stars
    const stars = [];
    for(let i=0;i<80;i++){
      stars.push({ x:Math.random(), y:Math.random(), r:Math.random()*1.2+0.3, phase:Math.random()*Math.PI*2, speed:0.4+Math.random()*0.6 });
    }

    // ambient bokeh orbs (inspired by the floating light halos on paneffect.co)
    const orbs = [];
    for(let i=0;i<5;i++){
      orbs.push({
        x:Math.random(), y:Math.random(), r:0.10+Math.random()*0.16,
        vx:(Math.random()-0.5)*0.006, vy:(Math.random()-0.5)*0.006,
        hue: i%2===0 ? '235,28,36' : '242,240,234',
        alpha:0.05+Math.random()*0.05, phase:Math.random()*Math.PI*2
      });
    }

    function hexToRgba(hex, a){
      const v = hex.replace('#','');
      const r = parseInt(v.substring(0,2),16), g = parseInt(v.substring(2,4),16), b = parseInt(v.substring(4,6),16);
      return 'rgba('+r+','+g+','+b+','+a+')';
    }

    function resize(){
      const rect = stage.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W*DPR);
      canvas.height = Math.round(H*DPR);
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    window.addEventListener('resize', resize);
    resize();

    function buildLabels(){
      labelsEl.innerHTML = '';
      planets.forEach((p,i) => {
        const el = document.createElement('div');
        el.className = 'arch-label';
        el.dataset.i = i;
        el.style.color = p.color;
        el.innerHTML = p.title;
        el.addEventListener('click', () => setActive(i));
        el.addEventListener('mouseenter', () => { hoverIndex = i; speedMulTarget = 0.35; });
        el.addEventListener('mouseleave', () => { hoverIndex = null; if(activeIndex===null && !purposeActive) speedMulTarget = 1; });
        labelsEl.appendChild(el);
      });
    }
    buildLabels();

    // The caption under the stage is the only place the selected essence is
    // explained, so the title is split out as a red uppercase heading with a
    // rule under it, and the whole caption becomes a bordered panel while
    // something is selected. Re-writing the markup replays the entrance
    // animation, which is what makes the change register as a change.
    const DEFAULT_CAPTION = '<span class="cap-prompt">Select an essence to learn more about the <strong class="brand-logo">TH<span class="brand-logo-i">i</span>NK</strong> Architecture.</span>';
    function escapeCaption(str){
      const d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }
    function setCaption(title, text){
      captionEl.classList.add('is-selected');
      captionEl.innerHTML = '<span class="cap-title">' + escapeCaption(title) + '</span>'
        + '<span class="cap-text">' + escapeCaption(text) + '</span>';
    }
    function resetCaption(){
      captionEl.classList.remove('is-selected');
      captionEl.innerHTML = DEFAULT_CAPTION;
    }
    resetCaption();

    function setActive(i){
      activeIndex = (activeIndex === i) ? null : i;
      document.querySelectorAll('.arch-label').forEach(l => l.classList.remove('active'));
      if(activeIndex !== null){
        purposeActive = false;
        if(purposeTag) purposeTag.classList.remove('active');
        document.querySelector('.arch-label[data-i="'+activeIndex+'"]').classList.add('active');
        track('Architecture Node', { node: clean(planets[activeIndex].title) });
        speedMulTarget = 0.35;
        captionEl.style.opacity = 0;
        setTimeout(() => {
          setCaption(planets[activeIndex].title, planets[activeIndex].text);
          captionEl.style.opacity = 1;
        }, 150);
      } else {
        speedMulTarget = 1;
        captionEl.style.opacity = 0;
        setTimeout(() => {
          resetCaption();
          captionEl.style.opacity = 1;
        }, 150);
      }
    }

    const PURPOSE_DEFINITION = 'The reason for which something is done or created or for which something exists. Oxford Dictionary.';

    function setPurposeActive(){
      purposeActive = !purposeActive;
      if(purposeActive){
        activeIndex = null;
        document.querySelectorAll('.arch-label').forEach(l => l.classList.remove('active'));
        if(purposeTag) purposeTag.classList.add('active');
        track('Architecture Node', { node: 'Purpose' });
        speedMulTarget = 0.35;
        captionEl.style.opacity = 0;
        setTimeout(() => {
          setCaption('Purpose', PURPOSE_DEFINITION);
          captionEl.style.opacity = 1;
        }, 150);
      } else {
        if(purposeTag) purposeTag.classList.remove('active');
        speedMulTarget = 1;
        captionEl.style.opacity = 0;
        setTimeout(() => {
          resetCaption();
          captionEl.style.opacity = 1;
        }, 150);
      }
    }

    if(purposeTag){
      purposeTag.addEventListener('click', setPurposeActive);
      purposeTag.addEventListener('mouseenter', () => { if(!purposeActive) speedMulTarget = 0.35; });
      purposeTag.addEventListener('mouseleave', () => { if(!purposeActive && activeIndex===null) speedMulTarget = 1; });
    }

    function drawSpoke(cx,cy,p){
      const alpha = 0.05 + 0.22*((p.depth+1)/2);
      const grad = ctx.createLinearGradient(cx,cy,p.x,p.y);
      grad.addColorStop(0, 'rgba(235,28,36,'+(alpha*0.9).toFixed(3)+')');
      grad.addColorStop(1, 'rgba(235,28,36,0)');
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y);
      ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.stroke();
    }

    function drawPlanet(cx,cy,p,i,t){
      drawSpoke(cx,cy,p);
      const isActive = (activeIndex===i || hoverIndex===i);
      const glowR = p.screenR * 3.2;
      const glowAlpha = (0.35+0.25*((p.depth+1)/2)) * (isActive?1.6:1);
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,glowR);
      g.addColorStop(0, hexToRgba(p.color, glowAlpha));
      g.addColorStop(1, hexToRgba(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x,p.y,glowR,0,Math.PI*2); ctx.fill();

      const pulse = 1 + 0.12*Math.sin(t*2.4 + i*1.7);
      const rad = p.screenR*(isActive?1.35:1)*pulse;
      ctx.beginPath(); ctx.arc(p.x,p.y,rad,0,Math.PI*2);
      ctx.fillStyle = hexToRgba('#0a0806', 0.4); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x,p.y,rad*0.72,0,Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
    }

    let last = performance.now();
    function frame(now){
      let dt = (now-last)/1000; last = now;
      dt = Math.min(dt, 0.05);
      speedMul += (speedMulTarget - speedMul) * Math.min(1, dt*3);
      const t = now/1000;

      ctx.clearRect(0,0,W,H);
      const cx = W/2, cy = H/2, R = Math.min(W,H)/2;

      // ambient bokeh halos
      orbs.forEach(o => {
        o.x += o.vx*dt*motionScale; o.y += o.vy*dt*motionScale;
        if(o.x<-0.2) o.x=1.2; if(o.x>1.2) o.x=-0.2;
        if(o.y<-0.2) o.y=1.2; if(o.y>1.2) o.y=-0.2;
        const a = o.alpha * (0.7+0.3*Math.sin(t*0.5+o.phase));
        const g = ctx.createRadialGradient(o.x*W,o.y*H,0,o.x*W,o.y*H,o.r*R);
        g.addColorStop(0, 'rgba('+o.hue+','+a.toFixed(3)+')');
        g.addColorStop(1, 'rgba('+o.hue+',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x*W,o.y*H,o.r*R,0,Math.PI*2); ctx.fill();
      });

      // stars
      stars.forEach(s => {
        const tw = 0.5+0.5*Math.sin(t*s.speed+s.phase);
        ctx.fillStyle = 'rgba(242,240,234,'+(0.15+0.5*tw).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
      });

      // orbit paths are no longer drawn: the essences move on invisible orbits

      // advance planets along their own tilted orbital plane
      planets.forEach(p => {
        p.angle += p.speed*dt*motionScale*speedMul;
        const ex = Math.cos(p.angle)*p.rx*R;
        const ey = Math.sin(p.angle)*p.ry*R;
        p.x = cx + ex*Math.cos(p.tilt) - ey*Math.sin(p.tilt);
        p.y = cy + ex*Math.sin(p.tilt) + ey*Math.cos(p.tilt);
        p.depth = Math.sin(p.angle);
        p.screenR = p.baseRadius * (0.75+0.35*(p.depth+1)/2) * (R/260);
      });

      const withIndex = planets.map((p,i) => ({p,i}));
      const back = withIndex.filter(o => o.p.depth < 0).sort((a,b)=>a.p.depth-b.p.depth);
      const front = withIndex.filter(o => o.p.depth >= 0).sort((a,b)=>a.p.depth-b.p.depth);

      back.forEach(o => drawPlanet(cx,cy,o.p,o.i,t));

      // Purpose: a soft ambient pulse behind the label, no solid sun body
      const pulseR = R*0.22*(1+0.05*Math.sin(t*1.4));
      const pg = ctx.createRadialGradient(cx,cy,0,cx,cy,pulseR);
      pg.addColorStop(0, 'rgba(235,28,36,0.14)');
      pg.addColorStop(1, 'rgba(235,28,36,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(cx,cy,pulseR,0,Math.PI*2); ctx.fill();

      front.forEach(o => drawPlanet(cx,cy,o.p,o.i,t));

      // sync labels to planet positions, with collision avoidance so labels never overlap
      const targets = planets.map((p,i) => {
        const dx = p.x-cx, dy = p.y-cy;
        const dist = Math.hypot(dx,dy) || 1;
        const offsetPx = 22 + i*10;
        return { x: p.x + (dx/dist)*offsetPx, y: p.y + (dy/dist)*offsetPx };
      });
      const minDist = 128;
      for(let iter=0; iter<4; iter++){
        for(let a=0; a<targets.length; a++){
          for(let b=a+1; b<targets.length; b++){
            const dx = targets[b].x-targets[a].x, dy = targets[b].y-targets[a].y;
            const d = Math.hypot(dx,dy) || 0.01;
            if(d < minDist){
              const push = (minDist-d)/2;
              const nx = dx/d, ny = dy/d;
              targets[a].x -= nx*push; targets[a].y -= ny*push;
              targets[b].x += nx*push; targets[b].y += ny*push;
            }
          }
        }
      }
      planets.forEach((p,i) => {
        const el = labelsEl.children[i];
        if(!el) return;
        if(p.labelX === null){ p.labelX = targets[i].x; p.labelY = targets[i].y; }
        p.labelX += (targets[i].x - p.labelX) * Math.min(1, dt*4);
        p.labelY += (targets[i].y - p.labelY) * Math.min(1, dt*4);
        el.style.left = ((p.labelX/W)*100)+'%';
        el.style.top = ((p.labelY/H)*100)+'%';
        const depthNorm = (p.depth+1)/2;
        el.style.opacity = (0.62+0.38*depthNorm).toFixed(2);
        el.style.zIndex = Math.round(depthNorm*100)+1;
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ===== Ambient ember flicker background =====
  (function(){
    const canvas = document.getElementById('emberCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionScale = reduceMotion ? 0.15 : 1;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;

    function resize(){
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W*DPR);
      canvas.height = Math.round(H*DPR);
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    window.addEventListener('resize', resize);
    resize();

    // deep, slow-breathing ember pools low in the composition
    const embers = [];
    const emberCount = 0; // red glow pools removed: background stays flat black
    for(let i=0;i<emberCount;i++){
      embers.push({
        x: Math.random(),
        y: 0.5 + Math.random()*0.5,
        r: 0.22 + Math.random()*0.26,
        baseAlpha: 0.11 + Math.random()*0.09,
        phase: Math.random()*Math.PI*2,
        speed: 0.15 + Math.random()*0.25,
        flickerSeed: Math.random()*1000
      });
    }

    // fire sparks: fast, motion-blurred red streaks thrown up from a fire, drawn at different depths
    // (far = small and sharp, near = larger and out of focus), echoing the PAN site's flying-ember footage
    const sparks = [];
    const sparkCount = 46;
    function spawnSpark(initial){
      const depth = Math.random(); // 0 far .. 1 near
      const speed = (80 + Math.random()*200) * (0.6 + depth*0.9); // px per second
      const ang = -Math.PI/2 + (Math.random()-0.5)*1.4; // mostly upward, fanned out like an updraft
      return {
        x: Math.random()*W,
        y: initial ? Math.random()*H : H + 10 + Math.random()*80,
        vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed,
        depth: depth,
        width: 0.7 + depth*2.2,
        turbSeed: Math.random()*1000,
        turbSpeed: 0.8 + Math.random()*1.4,
        life: 0,
        maxLife: 1.8 + Math.random()*3.4,
        flicker: Math.random()*Math.PI*2
      };
    }
    for(let i=0;i<sparkCount;i++) sparks.push(spawnSpark(true));

    // draws one spark as a streak along its direction of travel: a hot head with a tail that fades to nothing
    function drawStreak(x, y, vx, vy, width, alpha){
      const sp = Math.sqrt(vx*vx+vy*vy) || 1;
      const len = Math.min(46, 4 + sp*0.07);
      const tx = x - vx/sp*len, ty = y - vy/sp*len;
      const g = ctx.createLinearGradient(tx,ty,x,y);
      g.addColorStop(0, 'rgba(235,28,36,0)');
      g.addColorStop(0.6, 'rgba(235,28,36,'+(alpha*0.7).toFixed(3)+')');
      g.addColorStop(1, 'rgba(255,110,80,'+alpha.toFixed(3)+')');
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(x,y);
      ctx.globalAlpha = 0.3; ctx.lineWidth = width*3.2; ctx.stroke(); // soft glow
      ctx.globalAlpha = 1;   ctx.lineWidth = width;     ctx.stroke(); // bright core
    }

    // mouse-reactive embers: a warm glow follows the cursor, stirring up hotter sparks nearby
    const mouse = { x: 0.5, y: 0.5, lastMove: -99999 };
    window.addEventListener('pointermove', function(e){
      mouse.x = e.clientX / (W || window.innerWidth);
      mouse.y = e.clientY / (H || window.innerHeight);
      mouse.lastMove = performance.now();
    }, {passive:true});

    const mouseSparks = [];
    const maxMouseSparks = 14;
    function spawnMouseSpark(px, py){
      const speed = 60 + Math.random()*120;
      const ang = -Math.PI/2 + (Math.random()-0.5)*1.6;
      return {
        x: px, y: py,
        vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed,
        width: 0.6 + Math.random()*0.9,
        turbSeed: Math.random()*1000,
        turbSpeed: 0.8 + Math.random()*1.3,
        life: 0,
        maxLife: 0.8 + Math.random()*1.0,
        flicker: Math.random()*Math.PI*2
      };
    }

    // simple deterministic pseudo-noise for organic flicker (cheap, no allocations)
    function flicker(t, seed){
      return 0.5 + 0.25*Math.sin(t*1.7+seed) + 0.15*Math.sin(t*4.3+seed*1.3) + 0.1*Math.sin(t*9.1+seed*0.7);
    }
    // signed pseudo-noise (roughly -1..1) built from incommensurate sine waves,
    // used to make spark movement feel turbulent and unpredictable rather than a clean sine wobble
    function noise(t, seed){
      return 0.5*Math.sin(t*0.9+seed) + 0.3*Math.sin(t*2.3+seed*1.7) + 0.2*Math.sin(t*5.1+seed*0.4);
    }

    let last = performance.now();
    function frame(now){
      let dt = (now-last)/1000; last = now;
      dt = Math.min(dt, 0.05);
      const t = now/1000;

      // dark base fill so the layer reads correctly even before/without particles
      ctx.fillStyle = '#0a0a09';
      ctx.fillRect(0,0,W,H);

      // mouse presence: fades out ~1.2s after the cursor stops moving
      const sinceMove = now - mouse.lastMove;
      const mouseFade = 1200;
      const mouseInfluence = Math.max(0, 1 - sinceMove/mouseFade);
      const mx = mouse.x*W, my = mouse.y*H;
      const proximityR = 170;

      // deep ember glow pools
      embers.forEach(e => {
        const f = flicker(t*e.speed, e.flickerSeed);
        const a = e.baseAlpha * f * motionScale;
        const cx = e.x*W, cy = e.y*H, r = e.r*Math.max(W,H);
        const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
        g.addColorStop(0, 'rgba(235,28,36,'+a.toFixed(3)+')');
        g.addColorStop(1, 'rgba(235,28,36,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fill();
      });

      // soft warm glow that follows the cursor, like embers glowing hotter where you linger
      if(mouseInfluence > 0.01){
        const a = 0.035*mouseInfluence;
        const g = ctx.createRadialGradient(mx,my,0,mx,my,proximityR);
        g.addColorStop(0, 'rgba(255,130,95,'+a.toFixed(3)+')');
        g.addColorStop(0.5, 'rgba(235,28,36,'+(a*0.55).toFixed(3)+')');
        g.addColorStop(1, 'rgba(235,28,36,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx,my,proximityR,0,Math.PI*2);
        ctx.fill();
      }

      // stir up a few faint sparks right where the cursor moves
      if(mouseInfluence > 0.05 && mouseSparks.length < maxMouseSparks && Math.random() < 0.1){
        mouseSparks.push(spawnMouseSpark(
          mx + (Math.random()-0.5)*20,
          my + (Math.random()-0.5)*20
        ));
      }

      // moves a spark through a turbulent updraft: sideways gusts, a little lift, light drag
      function stepSpark(s){
        const step = dt*motionScale;
        s.life += step;
        s.vx += noise(t*s.turbSpeed, s.turbSeed)*240*step;
        s.vy += (noise(t*s.turbSpeed*0.8, s.turbSeed+40)*110 - 25)*step;
        const drag = Math.pow(0.82, step);
        s.vx *= drag; s.vy *= drag;
        s.x += s.vx*step; s.y += s.vy*step;
      }

      sparks.forEach((s, i) => {
        stepSpark(s);
        const lifeRatio = s.life / s.maxLife;
        const fadeIn = Math.min(1, s.life*4);
        const fadeOut = lifeRatio > 0.65 ? Math.max(0, (1 - lifeRatio)/0.35) : 1;
        const tw = 0.65 + 0.35*Math.sin(t*7 + s.flicker);
        // near sparks read as out of focus: wider and softer
        const focus = s.depth > 0.78 ? 0.45 : (0.55 + s.depth*0.45);
        let alpha = 0.6 * focus * fadeIn * fadeOut * tw;
        let width = s.depth > 0.78 ? s.width*1.6 : s.width;
        if(mouseInfluence > 0.01){
          const dx = s.x-mx, dy = s.y-my;
          const proximity = mouseInfluence * Math.max(0, 1 - Math.sqrt(dx*dx+dy*dy)/proximityR);
          if(proximity > 0) alpha = Math.min(1, alpha*(1+proximity*0.3));
        }
        if(alpha > 0.01) drawStreak(s.x, s.y, s.vx, s.vy, width, alpha);
        if(s.y < -60 || s.x < -60 || s.x > W+60 || s.life > s.maxLife){
          sparks[i] = spawnSpark(false);
        }
      });

      // faint cursor sparks: short-lived streaks that flick up and vanish
      for(let i=mouseSparks.length-1;i>=0;i--){
        const s = mouseSparks[i];
        stepSpark(s);
        const lifeRatio = s.life / s.maxLife;
        const fadeIn = Math.min(1, s.life*6);
        const fadeOut = Math.max(0, 1 - lifeRatio);
        const tw = 0.7 + 0.3*Math.sin(t*8 + s.flicker);
        const alpha = fadeIn * fadeOut * tw * 0.28;
        if(alpha > 0.01) drawStreak(s.x, s.y, s.vx, s.vy, s.width, alpha);
        if(s.life > s.maxLife) mouseSparks.splice(i,1);
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ===== Touch screens: scrolling lights up panels =====
  // Phones and tablets have no hover, so whichever panel sits across the middle of the
  // screen gets the same beige state the mouse gives on a computer.
  (function(){
    if(!window.matchMedia) return;
    var touchQuery = window.matchMedia('(hover: none)');
    var SELECTOR = '.panel-btn, .feed-item, .pillar, .help-card, .faq-item, .ideas-more, .case-tile, .join-panel';
    var ticking = false;
    function update(){
      ticking = false;
      var nodes = document.querySelectorAll(SELECTOR);
      if(!touchQuery.matches){
        for(var j=0;j<nodes.length;j++) nodes[j].classList.remove('is-lit');
        return;
      }
      var line = window.innerHeight * 0.5;
      for(var i=0;i<nodes.length;i++){
        var r = nodes[i].getBoundingClientRect();
        var lit = r.height > 0 && r.top <= line && r.bottom >= line;
        nodes[i].classList.toggle('is-lit', lit);
      }
    }
    function request(){ if(!ticking){ ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, {passive:true});
    window.addEventListener('resize', request);
    window.addEventListener('load', request);
    if(touchQuery.addEventListener) touchQuery.addEventListener('change', request);
    // feed items arrive later from Substack, so re-check once they render
    setTimeout(request, 1500); setTimeout(request, 4000);
    request();
  })();
