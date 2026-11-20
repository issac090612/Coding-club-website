/* Theme handling — follows the system by default.
   The toggle cycles: system -> dark -> light -> system.
   A forced choice is stored in localStorage and applied as
   data-theme="dark" | "light" on <html> (the inline <head> script
   in each page applies it before first paint). */

(function () {
  'use strict';

  var KEY = 'theme';
  var root = document.documentElement;

  function getStoredTheme() {
    try { return localStorage.getItem(KEY); }
    catch (e) { return null; }
  }

  var stored = getStoredTheme();
  if (stored === 'dark' || stored === 'light') {
    root.setAttribute('data-theme', stored);
  } else {
    root.removeAttribute('data-theme');
  }

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      root.setAttribute('data-theme', theme);
      try { localStorage.setItem(KEY, theme); } catch (e) {}
    } else {
      root.removeAttribute('data-theme');
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  }

  function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveDark() {
    var forced = root.getAttribute('data-theme');
    if (forced) return forced === 'dark';
    return systemPrefersDark();
  }

  /* Cycle: system -> dark -> light -> system. */
  function nextTheme(current) {
    if (!current) return systemPrefersDark() ? 'light' : 'dark';
    if (current === 'dark') return 'light';
    return null;
  }

  function updateToggles() {
    var dark = effectiveDark();
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var sun = btn.querySelector('.icon-sun');
      var moon = btn.querySelector('.icon-moon');
      if (sun) sun.style.display = dark ? 'block' : 'none';
      if (moon) moon.style.display = dark ? 'none' : 'block';
      var label = dark ? 'Switch to light theme' : 'Switch to dark theme';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  var toggleBtns = document.querySelectorAll('.theme-toggle');
  for (var j = 0; j < toggleBtns.length; j++) {
    toggleBtns[j].addEventListener('click', function () {
      applyTheme(nextTheme(getStoredTheme()));
      updateToggles();
    });
  }

  /* If we're following the system, react live when the OS theme changes. */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var onSystemChange = function () {
    if (!getStoredTheme()) updateToggles();
  };
  if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
  else if (mq.addListener) mq.addListener(onSystemChange);

  updateToggles();
})();
