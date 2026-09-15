/* SORC Complex Rules presentation.
 *
 * Complex is the default online rules book. Bare Bones is a separate book reached
 * through its own Rules Index link, so the shared detailed pages show every
 * Complex section without a Bare Bones/Complex switch.
 */
(function () {
  function showComplexRules() {
    var toggles = document.querySelectorAll('details.play-toggle');
    document.body.classList.remove('casual-mode');
    document.body.classList.add('enthusiastic-mode');

    for (var i = 0; i < toggles.length; i++) {
      toggles[i].open = true;
      var summary = toggles[i].querySelector('summary');
      if (summary) {
        summary.hidden = true;
        summary.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function build() {
    showComplexRules();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();