/* SORC Rule Set switch.
 *
 * One choice, held for the campaign, applied to the whole book. Bare Bones is the
 * default view: every Complex section shows its heading, its opening
 * paragraph and its note, with the rest collapsed. Complex opens them all.
 *
 * Sections are marked in the HTML with data-style="enthusiastic" on a
 * <details class="play-toggle">. That attribute is the source of truth, so the
 * PDF and box set builds can read the same markup and emit the Bare Bones book and
 * the Complex book from this one file.
 *
 * The choice persists per reader in localStorage and carries across pages.
 */
(function () {
  var KEY = 'sorcPlayStyle';
  var CASUAL = 'casual';
  var ENTHUSIASTIC = 'enthusiastic';

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === ENTHUSIASTIC ? ENTHUSIASTIC : CASUAL;
    } catch (e) {
      return CASUAL;
    }
  }

  function save(style) {
    try { localStorage.setItem(KEY, style); } catch (e) { /* private mode */ }
  }

  function apply(style) {
    var enthusiastic = style === ENTHUSIASTIC;
    document.body.classList.toggle('casual-mode', !enthusiastic);
    document.body.classList.toggle('enthusiastic-mode', enthusiastic);

    var toggles = document.querySelectorAll('details.play-toggle');
    for (var i = 0; i < toggles.length; i++) toggles[i].open = enthusiastic;

    var btn = document.getElementById('playStyleSwitch');
    if (btn) {
      btn.setAttribute('aria-pressed', String(enthusiastic));
      btn.textContent = enthusiastic
        ? 'Complex - Baseline to Modular'
        : 'Bare Bones - Base Features';
    }

    // The sections this affects are usually far below the fold, so say plainly
    // what just happened instead of leaving the reader to scroll and guess.
    var hint = document.querySelector('.play-style-hint');
    if (hint) {
      var n = toggles.length;
      if (!n) {
        hint.textContent = 'No Complex sections on this page.';
      } else {
        hint.textContent = enthusiastic
          ? n + ' Complex section' + (n === 1 ? '' : 's') + ' shown on this page. Set once, holds across every page.'
          : n + ' Complex section' + (n === 1 ? '' : 's') + ' collapsed on this page. Set once, holds across every page.';
      }
    }
  }

  function build() {
    // Only on pages that actually carry Rule Set sections.
    if (!document.querySelector('details.play-toggle')) return;

    var nav = document.querySelector('.page-nav');
    if (!nav) return;

    var wrap = document.createElement('div');
    wrap.className = 'play-style-bar';

    var btn = document.createElement('button');
    btn.id = 'playStyleSwitch';
    btn.type = 'button';
    btn.className = 'play-style-switch';
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Switch the whole book between Bare Bones and Complex';

    btn.addEventListener('click', function () {
      var next = read() === ENTHUSIASTIC ? CASUAL : ENTHUSIASTIC;
      save(next);
      apply(next);
    });

    var hint = document.createElement('span');
    hint.className = 'play-style-hint';

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    nav.parentNode.insertBefore(wrap, nav.nextSibling);

    apply(read());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
