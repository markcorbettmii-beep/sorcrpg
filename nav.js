// ========== THEME SYSTEM ==========
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
})();

document.addEventListener('DOMContentLoaded', function() {

  // ========== THEME BUTTONS ==========
  var evilBtn = document.querySelector('.theme-toggle-btn.evil');
  var lawfulBtn = document.querySelector('.theme-toggle-btn.lawful');
  if (evilBtn && lawfulBtn) {
    function updateButtonStates() {
      var currentTheme = localStorage.getItem('themeSelected') || 'evil';
      if (currentTheme === 'evil') {
        evilBtn.classList.add('active');
        lawfulBtn.classList.remove('active');
      } else {
        lawfulBtn.classList.add('active');
        evilBtn.classList.remove('active');
      }
    }
    updateButtonStates();
    evilBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'evil');
      document.body.classList.remove('lawful-mode');
      updateButtonStates();
    });
    lawfulBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'lawful');
      document.body.classList.add('lawful-mode');
      updateButtonStates();
    });
  }

  // ========== HAMBURGER MENU ==========
  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.getElementById('navLinks');
  var closeLink = document.getElementById('closeLink');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });
  }
  if (closeLink && navLinks) {
    closeLink.addEventListener('click', function(e) {
      e.preventDefault();
      navLinks.classList.remove('active');
    });
  }

  // ========== CURRENT PAGE NAV ==========
  var currentLinks = document.querySelectorAll('.current-section');
  currentLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
    });
  });

});
