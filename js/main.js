$(function () {

  /* ── Nav ────────────────────────────────────────────────── */
  $('#nav-placeholder').load('/components/nav.html', function () {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    $('nav a').each(function () {
      const href = $(this).attr('href').replace(/\/$/, '') || '/';
      if (href === path) $(this).addClass('active');
    });
  });

  /* ── Back link ──────────────────────────────────────────── */
  const parts = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const isHome  = parts.length === 0;
  const isLinks = parts.length === 1 && parts[0] === 'links';
  if (!isHome && !isLinks) {
    const back = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/links';
    $('main').prepend('<a href="' + back + '" style="display:inline-block;font-size:0.65rem;letter-spacing:0.06em;color:var(--muted);margin-bottom:40px;">← ' + back + '</a>');
  }

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

});
