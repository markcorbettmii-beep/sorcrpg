var SORC_API = 'https://api.sorcrpg.com';

var OWNER_EMAILS = ["corbett@sorcrpg.com"];
var ADMIN_EMAILS = ["markcorbett.mii@gmail.com"];

// ========== THEME SYSTEM ==========
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
})();

document.addEventListener('DOMContentLoaded', function() {
  var evilBtn = document.querySelector('.theme-toggle-btn.evil') || document.getElementById('theme-evil');
  var lawfulBtn = document.querySelector('.theme-toggle-btn.lawful') || document.getElementById('theme-lawful');
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
});

// ========== FOOTER INJECTION ==========
document.addEventListener('DOMContentLoaded', function() {
  var footerDiv = document.getElementById('footer');
  if (footerDiv) {
    footerDiv.innerHTML = '<footer>' +
      '<div class="container">' +
        '<p>&copy; 2025 Slayers of Rings &sect; Crowns by Ogre Adventurer. All rights reserved.</p>' +
        '<nav class="footer-links">' +
          '<a href="/terms.html">Terms of Service</a>' +
          '<a href="/privacy.html">Privacy Policy</a>' +
          '<a href="/conduct.html">Code of Conduct</a>' +
          '<a href="/forum.html">Forums</a>' +
          '<a href="/sorc-beyond.html">SORC Beyond</a>' +
          '<a href="mailto:corbett@sorcrpg.com">Contact</a>' +
        '</nav>' +
      '</div>' +
    '</footer>';
  }
});

// ========== NAVIGATION MENU ==========
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const closeLink = document.getElementById('closeLink');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });
    if (closeLink) {
      closeLink.addEventListener('click', function(e) {
        e.preventDefault();
        navLinks.classList.remove('active');
      });
    }
  }
});

// ========== COOKIE CONSENT ==========
document.addEventListener("DOMContentLoaded", function() {
  var cookieConsent = document.getElementById('cookieConsent');
  var acceptBtn = document.getElementById('acceptCookiesBtn');
  var hasConsent = localStorage.getItem('sorcCookieConsent') === 'true';
  if (!hasConsent && cookieConsent) cookieConsent.style.display = 'flex';
  if (acceptBtn) {
    acceptBtn.onclick = function() {
      localStorage.setItem('sorcCookieConsent', 'true');
      cookieConsent.style.display = 'none';
    };
  }
});

// ========== USER MINI POPUP ==========
window.showUserMiniPopup = function(e, uid, name) {
  e.stopPropagation();
  var existing = document.querySelector('.user-mini-popup');
  if (existing) { existing.remove(); return; }
  var popup = document.createElement('div');
  popup.className = 'user-mini-popup';
  popup.style.cssText = 'position:fixed;background:#1a1a1a;border:1px solid #444;border-radius:8px;padding:0.75rem 1rem;z-index:999999;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.6);font-size:0.85rem;';
  var rect = e.target.getBoundingClientRect();
  popup.style.top = (rect.bottom + 8) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  popup.innerHTML =
    '<div style="font-weight:bold;color:#e0cfc0;margin-bottom:0.5rem;font-size:0.9rem;">' + name + '</div>' +
    '<a href="public-profile.html?uid=' + uid + '" style="display:flex;align-items:center;gap:0.5rem;color:#d4af37;text-decoration:none;padding:4px 0;border-bottom:1px solid #2a2a2a;">👤 View Profile</a>' +
    '<a href="public-profile.html?uid=' + uid + '&msg=1" style="display:flex;align-items:center;gap:0.5rem;color:#d4af37;text-decoration:none;padding:4px 0;">✉ Send Message</a>';
  document.body.appendChild(popup);
  setTimeout(function() {
    document.addEventListener('click', function removePopup() {
      var p = document.querySelector('.user-mini-popup');
      if (p) p.remove();
      document.removeEventListener('click', removePopup);
    });
  }, 100);
};

// ========== NEWS CARDS SLIDER ==========
document.addEventListener("DOMContentLoaded", function() {
  const newsCards = document.querySelectorAll('.news-card');
  const rightArrows = document.querySelectorAll('.arrow-right');
  const leftArrows = document.querySelectorAll('.arrow-left');
  let currentIndex = 0;
  if (newsCards.length > 0) {
    function showCard(index) {
      newsCards.forEach((card, i) => {
        card.style.display = i === index ? 'flex' : 'none';
      });
    }
    showCard(currentIndex);
    rightArrows.forEach(arrow => {
      arrow.style.pointerEvents = 'auto';
      arrow.addEventListener('click', function(e) {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % newsCards.length;
        showCard(currentIndex);
      });
    });
    leftArrows.forEach(arrow => {
      arrow.style.pointerEvents = 'auto';
      arrow.addEventListener('click', function(e) {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + newsCards.length) % newsCards.length;
        showCard(currentIndex);
      });
    });
  }
});

// ========== AGE VERIFICATION ==========
document.addEventListener('DOMContentLoaded', function() {
  const ageModal = document.getElementById('age-verification');
  const btnYes = document.getElementById('age-yes');
  const btnNo = document.getElementById('age-no');
  if (ageModal && btnYes && btnNo) {
    const ageVerified = sessionStorage.getItem('ageVerified');
    if (!ageVerified) ageModal.style.display = 'flex';
    btnYes.onclick = function() {
      sessionStorage.setItem('ageVerified', 'true');
      ageModal.style.display = 'none';
    };
    btnNo.onclick = function() {
      alert('You must be of age to view this site.');
      window.location.href = 'https://www.google.com';
    };
  }
});

// ========== ROLE HELPERS ==========
function getRoleAbbr(role) {
  if (role === 'OWNER') return '[OWN]';
  if (role === 'ADMIN') return '[AD]';
  if (role === 'MASTER') return '[GM]';
  if (role === 'PLAYER') return '[PC]';
  return '[CIV]';
}

function getRoleColor(role) {
  if (role === 'OWNER') return { bg: '#d4af37', color: '#222' };
  if (role === 'ADMIN') return { bg: '#8B0000', color: '#fff' };
  if (role === 'MASTER') return { bg: '#1a6b1a', color: '#fff' };
  if (role === 'PLAYER') return { bg: '#1a3a6b', color: '#fff' };
  return { bg: '#333', color: '#e0cfc0' };
}

function getAvatarPath(avatarId) {
  if (!avatarId) return null;
  return 'images/avatars/' + avatarId;
}

// ========== SIGN OUT ==========
window.sorcSignOut = function() {
  localStorage.removeItem('sorc_user');
  if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
  window.location.reload();
};

// ========== ROLE BADGE ==========
function showRoleBadge(user) {
  var existing = document.getElementById('navRoleBadge');
  if (!existing) return;

  var role = user.role || 'CIVILIAN';
  if (OWNER_EMAILS.includes(user.email)) role = 'OWNER';
  else if (ADMIN_EMAILS.includes(user.email)) role = 'ADMIN';

  var displayName = user.username || user.display_name || user.email.split('@')[0];
  var abbr = getRoleAbbr(role);
  var colors = getRoleColor(role);
  var safeId = String(user.id || '');
  var isAdminUser = OWNER_EMAILS.includes(user.email) || ADMIN_EMAILS.includes(user.email);

  var avatarHtml = '';
  if (user.avatar) {
    var avatarPath = getAvatarPath(user.avatar);
    avatarHtml = '<img src="' + avatarPath + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);vertical-align:middle;margin-right:4px;" onerror="this.style.display=\'none\'" />';
  }

  existing.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:' + colors.bg + ';color:' + colors.color + ';border-radius:20px;font-size:0.85rem;font-weight:bold;flex-wrap:wrap;margin:0.5rem 0 1rem 0;';

  existing.innerHTML = avatarHtml + displayName +
    ' <span class="role-tag" data-username="' + displayName + '" data-userid="' + safeId + '" data-role="' + role + '" data-isadmin="' + isAdminUser + '" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;">' + abbr + '</span>' +
    ' &nbsp;|&nbsp; <a href="profile.html" style="color:inherit;text-decoration:underline;">Profile</a>' +
    ' &nbsp;|&nbsp; <a href="inbox.html" style="color:inherit;text-decoration:underline;">Inbox</a>' +
    ' &nbsp;|&nbsp; <a href="fellowships.html" style="color:inherit;text-decoration:underline;">Fellowships</a>' +
    ' &nbsp;|&nbsp; <a href="forum.html" style="color:inherit;text-decoration:underline;">Forums</a>' +
    ' &nbsp;|&nbsp; <button onclick="sorcSignOut()" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;font-size:0.85rem;">Logout</button>';

  existing.querySelector('.role-tag').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var isAdmin = this.dataset.isadmin === 'true';
    if (isAdmin) { showAdminPanel(); }
    else { showRolePopup(this.dataset.username, this.dataset.userid, this.dataset.role); }
  });
}

// ========== OWN ROLE POPUP ==========
window.showRolePopup = function(username, userId, role) {
  var existing = document.querySelector('.role-popup');
  if (existing) { existing.remove(); return; }
  var popup = document.createElement('div');
  popup.className = 'role-popup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;border:1px solid #444;border-radius:8px;padding:1rem 1.2rem;z-index:99999;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
  var roleLabel = role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Admin' : role === 'MASTER' ? 'Game Master' : role === 'PLAYER' ? 'Player Character' : 'Civilian';
  popup.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">' +
      '<span style="color:#888;font-size:0.8rem;">ACCOUNT INFO</span>' +
      '<button id="closeRolePopup" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:0;">✕</button>' +
    '</div>' +
    '<div style="font-weight:bold;font-size:1rem;color:#e0cfc0;">' + username + '</div>' +
    '<div style="color:#888;font-size:0.8rem;margin-top:2px;">' + roleLabel + '</div>' +
    '<div style="color:#555;font-size:0.75rem;margin-top:4px;">ID: #' + (userId || 'N/A') + '</div>';
  document.body.appendChild(popup);
  document.getElementById('closeRolePopup').addEventListener('click', function(e) { e.stopPropagation(); popup.remove(); });
};

// ========== ADMIN PANEL ==========
function showAdminPanel() {
  if (document.querySelector('.admin-panel')) return;
  var panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.style.cssText = 'position:fixed;bottom:80px;right:10px;background:#222;color:#fff;padding:16px;border-radius:8px;z-index:9998;min-width:260px;border:2px solid #d4af37;';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<h3 style="color:#d4af37;margin:0;">Admin Panel</h3>' +
      '<button onclick="toggleAdminPanel()" style="background:none;border:none;color:#d4af37;cursor:pointer;font-size:1.2rem;font-weight:bold;">−</button>' +
    '</div>' +
    '<div id="adminPanelContent">' +
      '<button onclick="generateGMCode()" style="background:#d4af37;color:#222;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;margin-bottom:8px;">Generate Master Code</button>' +
      '<div id="gmCodeOutput" style="margin-top:10px;font-size:0.85rem;"></div>' +
    '</div>';
  document.body.appendChild(panel);
}

window.toggleAdminPanel = function() {
  var content = document.getElementById('adminPanelContent');
  var btn = document.querySelector('.admin-panel button');
  if (content.style.display === 'none') { content.style.display = 'block'; btn.textContent = '−'; }
  else { content.style.display = 'none'; btn.textContent = '+'; }
};

window.generateGMCode = function() {
  var code = 'MASTER-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  document.getElementById('gmCodeOutput').innerHTML = 'New Master Code: <strong>' + code + '</strong><br><small>Share this with your Master</small>';
};

// ========== AUTH STATE — reads from localStorage, no Firebase ==========
document.addEventListener('DOMContentLoaded', function() {
  try {
    var saved = localStorage.getItem('sorc_user');
    if (saved) {
      var user = JSON.parse(saved);
      if (user && user.authKey) {
        // Show role badge
        showRoleBadge(user);
        // Update profile button
        if (window._profileBtn_loggedIn) window._profileBtn_loggedIn(user.avatar || null);
      } else {
        if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
      }
    } else {
      if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
    }
  } catch(e) {
    localStorage.removeItem('sorc_user');
    if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
  }
});
