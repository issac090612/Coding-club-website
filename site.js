/* Coding Club — shared behavior: footer year, meeting time rendered in the
   visitor's device time zone, and the showcase saved in the browser's
   local storage (this static site has no server). */

(function () {
  'use strict';

  /* ---------- Full-screen snap scrolling (home page only) ---------- */
  if (document.querySelector('main .screen')) {
    document.documentElement.classList.add('snap');
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Meeting time (device time zone) ----------
     The club meets every Saturday 07:30-08:00 China Standard Time (UTC+8).
     07:30 at UTC+8 is Friday 23:30 UTC. Find the next such instant and
     render it in the visitor's own time zone. */
  function nextMeetingUTC() {
    var now = new Date();
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 30, 0));
    var days = (5 - now.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + days);
    if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }

  var meetingEl = document.getElementById('meeting-next');
  if (meetingEl) {
    try {
      var start = nextMeetingUTC();
      var end = new Date(start.getTime() + 30 * 60 * 1000);
      var dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      var timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
      meetingEl.textContent = dateFmt.format(start) + ' · ' +
        timeFmt.format(start) + ' – ' + timeFmt.format(end) +
        ' · ' + tz + ' time';
    } catch (e) {
      /* Intl unavailable — the static UTC+8 time in the HTML stays visible. */
    }
  }

  /* ---------- Showcase (local storage) ---------- */
  var STORE_KEY = 'showcases';

  function readShowcases() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeShowcases(items) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      return false;
    }
  }

  var grid = document.getElementById('showcase-grid');
  if (grid) {
    var emptyEl = document.getElementById('showcase-empty');
    var items = readShowcases();
    emptyEl.hidden = items.length > 0;

    var dateFmt2 = null;
    try {
      dateFmt2 = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {}

    items.forEach(function (item, index) {
      var card = document.createElement('article');
      card.className = 'showcase-card reveal' + (index % 3 ? ' rd' + (index % 3) : '');

      var title = document.createElement('h3');
      title.textContent = item.title || 'Untitled project';
      card.appendChild(title);

      var desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = item.description || '';
      card.appendChild(desc);

      if (item.link) {
        var link = document.createElement('a');
        link.className = 'card-link';
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View project';
        card.appendChild(link);
      }

      var meta = document.createElement('div');
      meta.className = 'meta';
      var when = '';
      if (item.date) {
        var d = new Date(item.date);
        if (dateFmt2 && !isNaN(d.getTime())) when = ' · ' + dateFmt2.format(d);
      }
      meta.textContent = 'By ' + (item.name || 'a club member') + when;
      card.appendChild(meta);

      grid.appendChild(card);
    });
  }

  /* ---------- Submit form ---------- */
  var form = document.getElementById('submit-form');
  if (form) {
    var status = document.getElementById('submit-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('sc-title').value.trim();
      var name = document.getElementById('sc-name').value.trim();
      var desc = document.getElementById('sc-desc').value.trim();
      var link = document.getElementById('sc-link').value.trim();

      if (!title || !name || !desc) {
        status.textContent = 'Please fill in the required fields.';
        status.className = 'status error';
        return;
      }
      if (link && !/^https?:\/\//i.test(link)) {
        status.textContent = 'Links must start with http:// or https://';
        status.className = 'status error';
        return;
      }

      var items = readShowcases();
      items.unshift({
        title: title,
        name: name,
        description: desc,
        link: link || null,
        date: new Date().toISOString()
      });

      if (!writeShowcases(items)) {
        status.textContent = 'Could not save — your browser is blocking local storage.';
        status.className = 'status error';
        return;
      }

      form.reset();
      status.textContent = 'Thanks — your showcase is on the home page now. ';
      var view = document.createElement('a');
      view.href = 'index.html#showcase';
      view.textContent = 'See the showcase';
      status.appendChild(view);
      status.className = 'status success';
    });
  }

  /* ---------- Scroll-reveal animations ----------
     Elements with class "reveal" fade up as they enter the viewport.
     The anim-on class (set by the inline head script) hides them
     before JS runs only when animations are supported and wanted. */
  if (document.documentElement.classList.contains('anim-on') && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    var revealEls = document.querySelectorAll('.reveal');
    for (var k = 0; k < revealEls.length; k++) io.observe(revealEls[k]);

    /* Safety net: when a snap fling jumps clean over a section in a single
       frame, IntersectionObserver never sees it. Reveal anything that ends
       up fully above the viewport. */
    var unrevealed = Array.prototype.filter.call(revealEls, function (el) {
      return !el.classList.contains('is-visible');
    });

    function checkPassed() {
      if (!unrevealed.length) {
        window.removeEventListener('scroll', checkPassed);
        return;
      }
      unrevealed = unrevealed.filter(function (el) {
        if (el.classList.contains('is-visible')) return false;
        if (el.getBoundingClientRect().bottom <= 0) {
          el.classList.add('is-visible');
          io.unobserve(el);
          return false;
        }
        return true;
      });
    }

    window.addEventListener('scroll', checkPassed, { passive: true });
    checkPassed();
  }
})();
