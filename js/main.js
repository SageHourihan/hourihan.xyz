$(function () {

  /* ── Theme toggle ──────────────────────────────────────── */
  const $toggle = $('#themeToggle');
  const $root   = $('html');
  const sys     = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : sys.matches;
  }

  function applyTheme(dark) {
    $root.attr('data-theme', dark ? 'dark' : 'light');
    $toggle.text(dark ? 'light' : 'dark');
  }

  applyTheme(isDark());

  $toggle.on('click', function () {
    const dark = $root.attr('data-theme') !== 'dark';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    applyTheme(dark);
  });

  sys.addEventListener('change', function (e) {
    if (!localStorage.getItem('theme')) applyTheme(e.matches);
  });

  /* ── Active nav link ───────────────────────────────────── */
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  $('nav a').each(function () {
    const href = $(this).attr('href').replace(/\/$/, '') || '/';
    if (href === path) $(this).addClass('active');
  });

});
