/* Coding Club — shared behavior: footer year, meeting time in the visitor's
   device time zone, the showcase and members lists (saved in the browser's
   local storage — this static site has no server), the home-page command
   terminal, and scroll-reveal animations. */

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

  /* ---------- Members (local storage) ---------- */
  var MEMBERS_KEY = 'members';

  function readMembers() {
    try {
      var raw = JSON.parse(localStorage.getItem(MEMBERS_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeMembers(list) {
    try {
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  var memberList = document.getElementById('member-list');

  function renderMembers() {
    if (!memberList) return;
    var members = readMembers();
    memberList.innerHTML = '';
    var memberEmpty = document.getElementById('member-empty');
    if (memberEmpty) memberEmpty.hidden = members.length > 0;

    var dateFmtM = null;
    try {
      dateFmtM = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {}

    members.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'member-item';

      var name = document.createElement('span');
      name.className = 'member-name';
      name.textContent = m.name || 'member';
      item.appendChild(name);

      var when = document.createElement('span');
      when.className = 'member-date';
      var d = m.date ? new Date(m.date) : null;
      when.textContent = (d && !isNaN(d.getTime()) && dateFmtM) ? 'joined ' + dateFmtM.format(d) : '';
      item.appendChild(when);

      memberList.appendChild(item);
    });

    updateMemberLayout();
    updateMemberEffect();
  }

  /* ---------- Circular smartwatch-style member list ----------
     Page scrolling rotates the members around a vertical arc. The section's
     extra height gives the list one full circuit, then normal page scrolling
     resumes. Positions wrap modulo the member count, so the last member is
     followed by the first. */
  var memberEffectPending = false;
  var membersSection = document.getElementById('members');

  function updateMemberLayout() {
    if (!membersSection || !memberList) return;
    var count = memberList.children.length;
    var extra = count > 4 ? count * 110 : 0;
    membersSection.style.setProperty('--members-scroll', extra + 'px');
  }

  function updateMemberEffect() {
    if (!memberList) return;
    var els = memberList.querySelectorAll('.member-item');
    var count = els.length;
    if (!count) return;
    var listRect = memberList.getBoundingClientRect();
    if (listRect.height <= 0) return;

    var circular = count > 4;
    var position = 0;
    if (circular && membersSection) {
      var sectionTop = membersSection.getBoundingClientRect().top + window.scrollY;
      var distance = Math.max(membersSection.offsetHeight - window.innerHeight, 1);
      var progress = Math.min(Math.max((window.scrollY - sectionTop) / distance, 0), 1);
      position = progress * count;
    }

    var radius = listRect.height * 0.42;
    for (var i = 0; i < count; i++) {
      var el = els[i];
      var centered = circular
        ? ((i - position + count / 2) % count + count) % count - count / 2
        : i - (count - 1) / 2;
      var angle = centered * Math.PI / 6;
      var depth = Math.max(Math.cos(angle), 0);
      var visible = Math.abs(centered) < 2.6;
      var y = Math.sin(angle) * radius;
      var scale = 0.55 + 0.45 * depth;
      var opacity = 0.25 + 0.75 * depth;

      el.style.transform = 'translate(-50%, -50%) translateY(' + y.toFixed(2) + 'px) scale(' + scale.toFixed(3) + ')';
      el.style.opacity = visible ? opacity.toFixed(3) : '0';
      el.style.visibility = visible ? 'visible' : 'hidden';
      el.style.zIndex = String(100 - Math.round(Math.abs(centered) * 10));
    }
  }

  function scheduleMemberEffect() {
    if (memberEffectPending) return;
    memberEffectPending = true;
    window.requestAnimationFrame(function () {
      memberEffectPending = false;
      updateMemberEffect();
    });
  }

  if (memberList) {
    window.addEventListener('scroll', scheduleMemberEffect, { passive: true });
    window.addEventListener('resize', scheduleMemberEffect, { passive: true });
  }

  renderMembers();

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

  /* ---------- Command terminal (home page) ----------
     A tiny shell in the hero. "register" walks through the same questions
     as the register form and adds the member; other commands jump around
     the page or open the submit form. */
  var termInput = document.getElementById('term-input');
  if (termInput) {
    var termOut = document.getElementById('term-out');
    var termState = { step: 'idle', data: {} };
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function termPrint(text, cls) {
      var line = document.createElement('div');
      line.className = 'term-line' + (cls ? ' ' + cls : '');
      line.textContent = text;
      termOut.appendChild(line);
      termOut.scrollTop = termOut.scrollHeight;
    }

    function termEcho(cmd) {
      termPrint('$ ' + cmd, 'term-echo');
    }

    function termSetPlaceholder(text) {
      termInput.placeholder = text;
    }

    function resetFlow() {
      termState = { step: 'idle', data: {} };
      termSetPlaceholder('type "help" for commands');
    }

    function handleRegisterAnswer(value) {
      if (value.toLowerCase() === 'cancel') {
        termPrint('cancelled.', 'term-muted');
        resetFlow();
        return;
      }
      if (termState.step === 'name') {
        if (!value) {
          termPrint('please enter your name.', 'term-muted');
          termSetPlaceholder('your name');
          return;
        }
        termState.data.name = value;
        termState.step = 'email';
        termSetPlaceholder('email (optional — enter to skip)');
      } else if (termState.step === 'email') {
        if (value && !EMAIL_RE.test(value)) {
          termPrint('that does not look like an email — try again, or press enter to skip.', 'term-muted');
          termSetPlaceholder('email (optional — enter to skip)');
          return;
        }
        termState.data.email = value;
        termState.step = 'make';
        termSetPlaceholder('what would you like to make? (optional — enter to skip)');
      } else if (termState.step === 'make') {
        termState.data.make = value;
        termState.step = 'confirm';
        termPrint('name: ' + termState.data.name +
          (termState.data.email ? ' · email: ' + termState.data.email : ''), 'term-muted');
        termSetPlaceholder("type 'confirm' to join, or 'cancel'");
      } else if (termState.step === 'confirm') {
        if (value.toLowerCase() !== 'confirm') {
          termPrint("type 'confirm' to join, or 'cancel'.", 'term-muted');
          return;
        }
        var members = readMembers();
        members.push({
          name: termState.data.name,
          email: termState.data.email || '',
          make: termState.data.make || '',
          date: new Date().toISOString()
        });
        writeMembers(members);
        renderMembers();
        termPrint('welcome to the club, ' + termState.data.name +
          '. see you saturday — you are now in the members section.', 'term-success');
        resetFlow();
      }
    }

    function meetingText() {
      try {
        var start = nextMeetingUTC();
        var end = new Date(start.getTime() + 30 * 60 * 1000);
        var dateFmtT = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        var timeFmtT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
        return 'next meeting: ' + dateFmtT.format(start) + ' · ' +
          timeFmtT.format(start) + ' – ' + timeFmtT.format(end) +
          ' · ' + tz + ' time';
      } catch (e) {
        return 'next meeting: Saturdays · 7:30–8:00 AM · UTC+8';
      }
    }

    function goSection(name) {
      if (name === 'home' || name === '~' || name === '/') {
        termPrint('moving to home...', 'term-muted');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      var target = document.getElementById(name);
      if (!target) {
        termPrint('cd: no such directory: ' + name, 'term-muted');
        return;
      }
      termPrint('moving to ' + name + '...', 'term-muted');
      target.scrollIntoView({ behavior: 'smooth' });
    }

    function runCommand(raw) {
      var cmd = raw.trim();
      if (termState.step !== 'idle') {
        handleRegisterAnswer(cmd);
        return;
      }
      var parts = cmd.split(/\s+/);
      var low = parts[0].toLowerCase();
      var arg = parts.slice(1).join(' ').toLowerCase();

      if (low === 'help') {
        termPrint('commands:');
        termPrint('  join            become a member');
        termPrint('  new showcase    share a project');
        termPrint('  ls              list sections');
        termPrint('  cd <section>    go to a section');
        termPrint('  date            next meeting time');
        termPrint('  whoami          who you are');
        termPrint('  clear           clear the terminal');
      } else if (low === 'join' || low === 'register') {
        termState.step = 'name';
        termPrint('registration — answer a few questions. (type cancel anytime)', 'term-muted');
        termSetPlaceholder('your name');
      } else if (low === 'new' || low === 'submit') {
        /* new [showcase] — open the submit page */
        termPrint('opening the submit page...', 'term-muted');
        window.location.href = 'submit.html';
      } else if (low === 'ls') {
        termPrint('home/  showcase/  members/  meetings/');
      } else if (low === 'cd') {
        if (!arg) {
          termPrint('cd: missing operand', 'term-muted');
        } else {
          goSection(arg.replace(/\/+$/, ''));
        }
      } else if (low === 'date') {
        termPrint(meetingText());
      } else if (low === 'whoami') {
        var members = readMembers();
        if (members.length) {
          termPrint(members[members.length - 1].name);
        } else {
          termPrint("guest — type 'join' to become a member", 'term-muted');
        }
      } else if (low === 'showcase' || low === 'members' || low === 'home') {
        goSection(low);
      } else if (low === 'clear') {
        termOut.innerHTML = '';
      } else if (cmd !== '') {
        termPrint("command not found: " + parts[0] + " — try 'help'", 'term-muted');
      }
    }

    termInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var value = termInput.value;
        termEcho(value.trim());
        runCommand(value);
        termInput.value = '';
      } else if (e.key === 'Escape' && termState.step !== 'idle') {
        termPrint('cancelled.', 'term-muted');
        resetFlow();
      }
    });

    var examples = document.querySelectorAll('.term-example');
    for (var m = 0; m < examples.length; m++) {
      examples[m].addEventListener('click', function () {
        if (termState.step !== 'idle') {
          termInput.focus();
          return;
        }
        var value = this.textContent.trim();
        termEcho(value);
        termInput.focus();
        runCommand(value);
      });
    }
  }

  /* ---------- Scroll-reveal animations ----------
     Elements with class "reveal" fade up (with a small spring) as they
     enter the viewport. The anim-on class (set by the inline head script)
     hides them before JS runs only when animations are supported. */
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

    /* Safety net: when a fling jumps clean over a section in a single
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
