// ========== FAVICON (site-wide) ==========
(function() {
  var protectedPaths = {
    '/lobbies.html': true,
    '/library.html': true,
    '/content/features/achievements.html': true,
    '/content/features/ai-chat.html': true,
    '/content/features/armor-system.html': true,
    '/content/features/call-to-arms.html': true,
    '/content/features/characters-home.html': true,
    '/content/features/collection.html': true,
    '/content/features/exchange.html': true,
    '/content/features/fellowships.html': true,
    '/content/features/forum.html': true,
    '/content/features/inbox.html': true,
    '/content/features/leaderboard.html': true,
    '/content/features/lobbies.html': true,
    '/content/features/room.html': true,
    '/content/features/sorc-store.html': true,
    '/content/features/threads.html': true,
    '/content/features/trading-post.html': true,
    '/content/features/trials-of-combat.html': true
  };
  var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (!protectedPaths[currentPath]) return;
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('sorc_user') || 'null'); } catch (e) {}
  if (!saved || !saved.authKey) {
    window.location.replace('/content/auth/wanderer.html');
  }
})();

(function() {
  var existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  existing.forEach(function(el) { el.parentNode.removeChild(el); });
  var link = document.createElement('link');
  link.rel = 'icon';
  link.href = '/content/site-presentation/assets/branding/favicons/favicon-zailister-crown.png';
  document.head.appendChild(link);
  var touchLink = document.createElement('link');
  touchLink.rel = 'apple-touch-icon';
  touchLink.href = '/content/site-presentation/assets/branding/favicons/apple-touch-icon-crown.png';
  document.head.appendChild(touchLink);
})();

var SORC_API = 'https://api.sorcrpg.com';

var OWNER_EMAILS = ["corbett@sorcrpg.com"];
var ADMIN_EMAILS = ["markcorbett.mii@gmail.com"];

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========== THEME SYSTEM ==========
function sorcSyncHtmlBg(isLawful) {
  document.documentElement.style.background = isLawful ? '#f5f5f0' : '#0a0a0a';
}
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'lawful';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
  sorcSyncHtmlBg(savedTheme === 'lawful');
})();

document.addEventListener('DOMContentLoaded', function() {
  var evilBtn = document.querySelector('.theme-toggle-btn.evil') || document.getElementById('theme-evil');
  var lawfulBtn = document.querySelector('.theme-toggle-btn.lawful') || document.getElementById('theme-lawful');
  if (evilBtn && lawfulBtn) {
    function updateButtonStates() {
      var currentTheme = localStorage.getItem('themeSelected') || 'lawful';
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
      location.reload();
    });
    lawfulBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'lawful');
      location.reload();
    });
  }
});

// ========== PROFILE BUTTON (site-wide, floats/follows scroll) ==========
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('headerControls')) return;

  var headerControls = document.createElement('div');
  headerControls.id = 'headerControls';
  headerControls.style.cssText = 'position:fixed;top:1.2rem;right:1.5rem;display:flex;gap:0.75rem;align-items:center;z-index:500;';

  var profileBtn = document.createElement('button');
  profileBtn.id = 'profileBtn';
  profileBtn.title = 'User Space';
  profileBtn.style.cssText = 'border:2px solid;width:44px;height:44px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;font-size:1.2rem;overflow:hidden;padding:0;';
  profileBtn.textContent = 'W';

  window._updateProfileBtnColors = function() {
    var isLawful = document.body.classList.contains('lawful-mode');
    if (isLawful) {
      profileBtn.style.backgroundColor = '#2196f3';
      profileBtn.style.borderColor = '#b9aa00';
      profileBtn.style.color = '#b9aa00';
    } else {
      profileBtn.style.backgroundColor = '#c93f35';
      profileBtn.style.borderColor = '#c93f35';
      profileBtn.style.color = '#9889e0';
    }
  };
  window._updateProfileBtnColors();

  var propertySpacePath = '/content/features/space.html?tab=property';
  window._profileBtn_loggedIn = function(avatarFilename, displayName) {
    var initial = (displayName || '').trim().charAt(0).toUpperCase() || 'S';
    if (avatarFilename) {
      profileBtn.innerHTML = '<img src="/images/avatars/' + avatarFilename + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.textContent=\'' + initial + '\'" />';
    } else {
      profileBtn.textContent = initial;
    }
    profileBtn.onclick = function(e) {
      e.stopPropagation();
      window.location.href = propertySpacePath;
    };
  };

  window._profileBtn_loggedOut = function() {
    profileBtn.textContent = 'W';
    profileBtn.onclick = function(e) {
      e.stopPropagation();
      window.location.href = '/content/auth/signin.html';
    };
  };

  profileBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('sorc_user')); } catch (e2) {}
    window.location.href = (saved && saved.authKey) ? propertySpacePath : '/content/auth/signin.html';
  });

  headerControls.appendChild(profileBtn);
  document.body.appendChild(headerControls);
});

// ========== HOME ICON INJECTION ==========
document.addEventListener('DOMContentLoaded', function() {
  var path = window.location.pathname;
  var isHome = path === '/' || path.endsWith('/index.html');
  if (isHome) return;
  if (document.querySelector('.page-nav')) return;
  var homeHref = '/index.html';
  var ul = document.createElement('ul');
  ul.className = 'page-nav';
  ul.innerHTML = '<li><a href="' + homeHref + '">&#8962;</a></li>';
  var nav = document.querySelector('nav');
  if (nav) { nav.insertAdjacentElement('afterend', ul); }
});

// ========== FOOTER INJECTION ==========
document.addEventListener('DOMContentLoaded', function() {
  var footerDiv = document.getElementById('footer');
  if (footerDiv) {
    footerDiv.innerHTML = '<div class="footer-top-links">' +
      '<nav class="footer-links">' +
        '<a href="/terms.html">Terms of Service</a>' +
        '<a href="/privacy.html">Privacy Policy</a>' +
        '<a href="/conduct.html">Code of Conduct</a>' +
        '<a href="/content/features/forum.html">Forums</a>' +
        '<a href="/sorc-web.html">SORC Web</a>' +
        '<a href="mailto:corbett@sorcrpg.com">Contact</a>' +
      '</nav>' +
    '</div>' +
    '<footer>' +
      '<div class="container">' +
        '<p class="footer-copyright">&copy; Slayers of Rings &sect; Crowns [sorcrpg.com], by Ogre Adventurer, holds all rights reserved to all published content through this website.</p>' +
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
    // Close menu when clicking anywhere outside it
    document.addEventListener('click', function(e) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        navLinks.classList.remove('active');
      }
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

// ========== NEWS CARDS SLIDER ==========
document.addEventListener("DOMContentLoaded", function() {
  const newsCards = document.querySelectorAll('.news-card');
  let currentIndex = 0;
  if (newsCards.length > 0) {
    function showCard(index) {
      newsCards.forEach((card, i) => {
        card.style.display = i === index ? 'flex' : 'none';
      });
    }
    showCard(currentIndex);
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

// ========== EXPIRED SESSION HANDLER ==========
window.sorcHandleExpiredSession = function() {
  localStorage.removeItem('sorc_user');
  window.location.href = '/content/auth/signin.html?expired=true';
};

// ========== ONLINE PRESENCE HEARTBEAT ==========
(function() {
  var _heartbeatInterval = null;
  function sendHeartbeat() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('sorc_user')); } catch(e) {}
    if (!user || !user.authKey) return;
    fetch(SORC_API + '/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Key': user.authKey },
      body: JSON.stringify({ status: 'online' })
    }).then(function(r) {
      if (r.status === 401) r.json().then(function(d) { if (d.expired) window.sorcHandleExpiredSession(); });
    }).catch(function(){});
  }
  document.addEventListener('DOMContentLoaded', function() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('sorc_user')); } catch(e) {}
    if (!user || !user.authKey) return;
    sendHeartbeat();
    _heartbeatInterval = setInterval(sendHeartbeat, 30000);
    window.addEventListener('beforeunload', function() {
      if (_heartbeatInterval) clearInterval(_heartbeatInterval);
      try {
        var u = JSON.parse(localStorage.getItem('sorc_user'));
        if (u && u.authKey) {
          navigator.sendBeacon(SORC_API + '/api/presence', JSON.stringify({ status: 'offline', auth_key: u.authKey }));
        }
      } catch(e) {}
    });
  });
})();

// ========== ROLE HELPERS ==========
function getRoleAbbr(role) {
  if (role === 'OWNER') return '[OWN]';
  if (role === 'ADMIN') return '[AD]';
  if (role === 'MASTER') return '[GM]';
  if (role === 'PLAYER') return '[PC]';
  return '[CIV]';
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
function showRoleBadge() {
  var existing = document.getElementById('navRoleBadge');
  if (existing) existing.remove();
}

// ========== ROLE POPUP ==========
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
      '<button id="closeRolePopup" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:0;"></button>' +
    '</div>' +
    '<div style="font-weight:bold;font-size:1rem;color:#e0cfc0;">' + escapeHtml(username) + '</div>' +
    '<div style="color:#888;font-size:0.8rem;margin-top:2px;">' + escapeHtml(roleLabel) + '</div>' +
    '<div style="color:#555;font-size:0.75rem;margin-top:4px;">ID: #' + escapeHtml(userId || 'N/A') + '</div>';
  document.body.appendChild(popup);
  document.getElementById('closeRolePopup').addEventListener('click', function(e) { e.stopPropagation(); popup.remove(); });
};

// ========== TOAST NOTIFICATIONS ==========
var _toastQueue = [];
var _toastShowing = false;
function sorcToast(msg, color) {
  _toastQueue.push({ msg: msg, color: color || '#b9aa00' });
  if (!_toastShowing) _showNextToast();
}
function _showNextToast() {
  if (!_toastQueue.length) { _toastShowing = false; return; }
  _toastShowing = true;
  var t = _toastQueue.shift();
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%) translateY(80px);background:' + t.color + ';color:' + (t.color === '#b9aa00' ? '#222' : '#fff') + ';padding:0.65rem 1.2rem;border-radius:24px;font-size:0.85rem;font-weight:bold;z-index:99999;box-shadow:0 4px 18px rgba(0,0,0,0.5);transition:transform 0.3s ease;max-width:90vw;text-align:center;';
  document.body.appendChild(el);
  el.textContent = t.msg;
  setTimeout(function() { el.style.transform = 'translateX(-50%) translateY(0)'; }, 30);
  setTimeout(function() {
    el.style.transform = 'translateX(-50%) translateY(80px)';
    setTimeout(function() { el.remove(); _showNextToast(); }, 320);
  }, 3500);
}

// ========== NOTIFICATION BADGE ==========
var _lastNotifCp = null;
async function checkNotifications(user) {
  if (!user || !user.authKey) return;
  try {
    var res = await fetch(SORC_API + '/api/notifications', { headers: { 'X-Auth-Key': user.authKey } });
    if (!res.ok) return;
    var data = await res.json();

    // ---- Inbox badge ----
    // pending requests + unread messages in accepted conversations
    var unread = data.inbox_unread || 0;
    try {
      var convRes = await fetch(SORC_API + '/api/conversations', { headers: { 'X-Auth-Key': user.authKey } });
      if (convRes.ok) {
        var convData = await convRes.json();
        var convs = convData.conversations || [];
        convs.forEach(function(conv) {
          if (!conv.last_message_at) return;
          var lastRead = parseInt(localStorage.getItem('sorc_conv_read_' + conv.id) || '0');
          var rawTs = conv.last_message_at;
          var msgTime = new Date(rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T') + 'Z').getTime();
          if (msgTime > lastRead) unread++;
        });
      }
    } catch(e) {}

    // ---- Cohort badge ----
    var lastSeen = parseInt(localStorage.getItem('sorc_f_last_seen') || '0');
    var incomingCount = data.fellowship_incoming_count || 0;
    var acceptedCount = (data.fellowship_recently_accepted || []).filter(function(f) {
      return f.accepted_at && new Date(f.accepted_at).getTime() > lastSeen;
    }).length;
    var fellowBadge = incomingCount + acceptedCount;

    // ---- CP change toast ----
    var newCp = data.community_points || 0;
    if (_lastNotifCp !== null && newCp > _lastNotifCp) {
      sorcToast('You earned ' + (newCp - _lastNotifCp) + ' Community Points!', '#b9aa00');
      // Update localStorage so space page reflects new value
      try {
        var cached = JSON.parse(localStorage.getItem('sorc_user') || '{}');
        cached.community_points = newCp;
        localStorage.setItem('sorc_user', JSON.stringify(cached));
      } catch(e) {}
    }
    _lastNotifCp = newCp;

    // ---- Admin invite toast (once per session) ----
    if (data.admin_invite && !sessionStorage.getItem('sorc_invite_toasted')) {
      sessionStorage.setItem('sorc_invite_toasted', '1');
      sorcToast('You have an Admin invitation! Visit your User Space to respond.', '#c93f35');
    }

    // ---- Update nav badges ----
    var badgeEl = document.getElementById('navRoleBadge');
    if (badgeEl) {
      var inboxLink = badgeEl.querySelector('#badgeInboxLink');
      if (inboxLink) {
        var isLawfulInbox = document.body.classList.contains('lawful-mode');
        var notifBg = '#fff';
        var notifColor = isLawfulInbox ? '#222' : '#222';
        inboxLink.innerHTML = unread > 0
          ? 'Inbox <span style="background:' + notifBg + ' !important;color:' + notifColor + ' !important;border-radius:10px;padding:1px 6px;font-size:0.7rem;font-weight:bold;text-shadow:none !important;text-decoration:none !important;">' + unread + '</span>'
          : 'Inbox';
      }
      var fellowLink = badgeEl.querySelector('#badgeFellowshipsLink');
      if (fellowLink) {
        var isLawfulBadge = document.body.classList.contains('lawful-mode');
        var notifBg = '#fff';
        var notifColor = isLawfulBadge ? '#222' : '#222';
        fellowLink.innerHTML = fellowBadge > 0
          ? 'Cohorts <span style="background:' + notifBg + ' !important;color:' + notifColor + ' !important;border-radius:10px;padding:1px 6px;font-size:0.7rem;font-weight:bold;text-shadow:none !important;text-decoration:none !important;">' + fellowBadge + '</span>'
          : 'Cohorts';
      }
      var profileLink = badgeEl.querySelector('a[href="/content/features/space.html"]');
      if (profileLink) {
        profileLink.innerHTML = data.admin_invite
          ? 'Profile <span style="background:#c93f35;color:#fff;border-radius:10px;padding:1px 6px;font-size:0.7rem;font-weight:bold;">!</span>'
          : 'Profile';
      }
    }
  } catch(e) {}
}

// ========== PUBLIC NOTIFICATION UPDATE (for inbox.html, etc.) ==========
// Call this immediately after resolving a notification so badge updates right away
window.sorcUpdateNotifications = function() {
  try {
    var saved = localStorage.getItem('sorc_user');
    if (saved) {
      var user = JSON.parse(saved);
      if (user && user.authKey) {
        checkNotifications(user);
      }
    }
  } catch(e) {}
};

// ========== LOGGED-OUT BADGE ==========
function showLoggedOutBadge() {
  showRoleBadge();
}

// ========== AUTH STATE ==========
document.addEventListener('DOMContentLoaded', function() {
  try {
    var saved = localStorage.getItem('sorc_user');
    if (saved) {
      var user = JSON.parse(saved);
      if (user && user.authKey) {
        showRoleBadge(user);
        checkNotifications(user);
        // Second check after 3s to catch D1 replica lag on fresh requests
        setTimeout(function() { checkNotifications(user); }, 3000);
        setInterval(function() { checkNotifications(user); }, 15000);
        if (window._profileBtn_loggedIn) window._profileBtn_loggedIn(user.avatar || null);
      } else {
        showLoggedOutBadge();
        if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
      }
    } else {
      showLoggedOutBadge();
      if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
    }
  } catch(e) {
    localStorage.removeItem('sorc_user');
    showLoggedOutBadge();
    if (window._profileBtn_loggedOut) window._profileBtn_loggedOut();
  }
});

// ========== DETAILS "SELECT TO EXPAND" / "COLLAPSE" TOGGLE TEXT ==========
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('details').forEach(function(det) {
    var summary = det.querySelector(':scope > summary');
    if (!summary) return;
    var hint = summary.querySelector('.tree-hint');
    if (!hint) return;
    var arrow = hint.querySelector('.tree-hint-arrow');

    var hintClone = hint.cloneNode(true);
    var arrowClone = hintClone.querySelector('.tree-hint-arrow');
    if (arrowClone) arrowClone.remove();
    var expandText = hintClone.textContent.replace(/\s+/g, ' ').trim();
    if (!/^(?:select to )?expand/i.test(expandText)) return;
    var collapseText = expandText.replace(/^(?:select to )?expand/i, 'Collapse');

    function render() {
      while (hint.lastChild && hint.lastChild !== arrow) hint.removeChild(hint.lastChild);
      hint.appendChild(document.createTextNode(' ' + (det.open ? collapseText : expandText)));
    }
    det.addEventListener('toggle', render);
  });
});
