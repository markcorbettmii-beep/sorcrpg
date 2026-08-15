// ========== FAVICON (site-wide) ==========
(function() {
  var existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  existing.forEach(function(el) { el.parentNode.removeChild(el); });
  var link = document.createElement('link');
  link.rel = 'icon';
  link.href = '/images/favicon-zailister-crown.png';
  document.head.appendChild(link);
  var touchLink = document.createElement('link');
  touchLink.rel = 'apple-touch-icon';
  touchLink.href = '/images/apple-touch-icon-crown.png';
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
  profileBtn.title = 'Profile';
  profileBtn.style.cssText = 'border:2px solid;width:44px;height:44px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;font-size:1.2rem;overflow:hidden;padding:0;';
  profileBtn.innerHTML = '&#128100;';

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

  window._profileBtn_loggedIn = function(avatarFilename) {
    if (avatarFilename) {
      profileBtn.innerHTML = '<img src="/images/avatars/' + avatarFilename + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML=\'&#128100;\'" />';
    } else {
      profileBtn.innerHTML = '&#128100;';
    }
    profileBtn.onclick = function(e) {
      e.stopPropagation();
      window.location.href = '/profile.html';
    };
  };

  window._profileBtn_loggedOut = function() {
    profileBtn.innerHTML = '&#128100;';
    profileBtn.onclick = function(e) {
      e.stopPropagation();
      window.location.href = '/signin.html';
    };
  };

  profileBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('sorc_user')); } catch (e2) {}
    window.location.href = (saved && saved.authKey) ? '/profile.html' : '/signin.html';
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
        '<a href="/forum.html">Forums</a>' +
        '<a href="/sorc-beyond.html">SORC Beyond</a>' +
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
    '<div style="font-weight:bold;color:#e0cfc0;margin-bottom:0.5rem;font-size:0.9rem;">' + escapeHtml(name) + '</div>' +
    '<a href="public-profile.html?uid=' + escapeHtml(uid) + '" style="display:flex;align-items:center;gap:0.5rem;color:#b9aa00;text-decoration:none;padding:4px 0;border-bottom:1px solid #2a2a2a;">👤 View Profile</a>' +
    '<a href="public-profile.html?uid=' + escapeHtml(uid) + '&msg=1" style="display:flex;align-items:center;gap:0.5rem;color:#b9aa00;text-decoration:none;padding:4px 0;">✉ Send Message</a>';
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
  window.location.href = '/signin.html?expired=true';
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

function getRoleColor(role) {
  if (role === 'OWNER') return { bg: '#b9aa00', color: '#222' };
  if (role === 'ADMIN') return { bg: '#c93f35', color: '#fff' };
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

  // Remove any leftover logged-out avatar span
  var oldAvatar = existing.querySelector('.badge-avatar-default');
  if (oldAvatar) oldAvatar.remove();

  var role = user.role || 'CIVILIAN';
  if (OWNER_EMAILS.includes(user.email)) role = 'OWNER';
  else if (ADMIN_EMAILS.includes(user.email)) role = 'ADMIN';

  var displayName = escapeHtml(user.username || user.display_name || user.email.split('@')[0]);
  var abbr = getRoleAbbr(role);
  var safeId = escapeHtml(String(user.id || ''));
  var isAdminUser = OWNER_EMAILS.includes(user.email) || ADMIN_EMAILS.includes(user.email);

  var isLawful = document.body.classList.contains('lawful-mode');
  var avatarHtml = '';
  if (user.avatar) {
    var avatarPath = getAvatarPath(user.avatar);
    var avatarBg = isLawful ? '#b9aa00' : '#c93f35';
    var avatarBorder = isLawful ? '#2196f3' : '#9c27b0';
    avatarHtml = '<img src="' + avatarPath + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;background:' + avatarBg + ';border:1px solid ' + avatarBorder + ';vertical-align:middle;margin-right:4px;" onerror="this.style.display=\'none\'" />';
  }
  var bgColor = isLawful ? '#2196f3' : '#9c27b0';
  var linkColor = isLawful ? '#ffffff' : '#c93f35';
  var shadowColor = isLawful ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  existing.style.cssText = 'display:inline-flex !important;align-items:center !important;gap:8px !important;padding:6px 14px !important;background:' + bgColor + ' !important;color:' + linkColor + ' !important;border-radius:20px !important;font-size:0.85rem !important;flex-wrap:wrap !important;margin:0.5rem 0 1rem 0 !important;';

  var adminLink = isAdminUser
    ? ' <a href="/admin.html" style="color:' + linkColor + ';text-decoration:underline;">' + (role === 'OWNER' ? 'Owner Panel' : 'Admin Panel') + '</a>'
    : '';

  var hasAssessed = !!(user.sorc_role) || isAdminUser || role === 'PLAYER' || role === 'MASTER';
  var lobbiesHref = hasAssessed ? '/lobbies.html' : '/assess.html';

  existing.innerHTML = avatarHtml + displayName +
    ' <span class="role-tag" data-username="' + displayName + '" data-userid="' + safeId + '" data-role="' + role + '" data-isadmin="' + isAdminUser + '" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;user-select:none;-webkit-user-select:none;color:' + linkColor + ' !important;background:transparent !important;">' + abbr + '</span>' +
    ' · <a href="/profile.html" style="color:' + linkColor + ';text-decoration:underline;">Profile</a>' +
    ' · <a href="' + lobbiesHref + '" style="color:' + linkColor + ';text-decoration:underline;">Lobbies</a>' +
    ' · <a id="badgeInboxLink" href="/inbox.html" style="color:' + linkColor + ';text-decoration:underline;">Inbox</a>' +
    ' · <a id="badgeFellowshipsLink" href="/fellowships.html" style="color:' + linkColor + ';text-decoration:underline;">Fellowships</a>' +
    ' · <a href="/forum.html" style="color:' + linkColor + ';text-decoration:underline;">Forums</a>' +
    ' · <a href="/content.html" style="color:' + linkColor + ';text-decoration:underline;">Content</a>' +
    adminLink +
    ' · <button onclick="sorcSignOut()" style="background:none;border:none;color:' + linkColor + ';cursor:pointer;font-size:0.85rem;text-decoration:underline;"><strong>Logout</strong></button>';

  var roleTag = existing.querySelector('.role-tag');
  if (roleTag) {
    roleTag.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      showRolePopup(this.dataset.username, this.dataset.userid, this.dataset.role);
    });
  }
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
      '<button id="closeRolePopup" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:0;">✕</button>' +
    '</div>' +
    '<div style="font-weight:bold;font-size:1rem;color:#e0cfc0;">' + escapeHtml(username) + '</div>' +
    '<div style="color:#888;font-size:0.8rem;margin-top:2px;">' + escapeHtml(roleLabel) + '</div>' +
    '<div style="color:#555;font-size:0.75rem;margin-top:4px;">ID: #' + escapeHtml(userId || 'N/A') + '</div>';
  document.body.appendChild(popup);
  document.getElementById('closeRolePopup').addEventListener('click', function(e) { e.stopPropagation(); popup.remove(); });
};

// ========== ADMIN PANEL ==========
window.showAdminPanel = function showAdminPanel() {
  if (document.querySelector('.admin-panel')) return;
  var panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.style.cssText = 'position:fixed;bottom:80px;right:10px;background:#222;color:#fff;padding:16px;border-radius:8px;z-index:9998;min-width:260px;border:2px solid #b9aa00;';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<h3 style="color:#b9aa00;margin:0;">Admin Panel</h3>' +
      '<button onclick="toggleAdminPanel()" style="background:none;border:none;color:#b9aa00;cursor:pointer;font-size:1.2rem;font-weight:bold;">−</button>' +
    '</div>' +
    '<div id="adminPanelContent">' +
      '<button onclick="generateGMCode()" style="background:#b9aa00;color:#222;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;margin-bottom:8px;">Generate Master Code</button>' +
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
  el.textContent = msg;
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

    // ---- Fellowship badge ----
    var lastSeen = parseInt(localStorage.getItem('sorc_f_last_seen') || '0');
    var incomingCount = data.fellowship_incoming_count || 0;
    var acceptedCount = (data.fellowship_recently_accepted || []).filter(function(f) {
      return f.accepted_at && new Date(f.accepted_at).getTime() > lastSeen;
    }).length;
    var fellowBadge = incomingCount + acceptedCount;

    // ---- CP change toast ----
    var newCp = data.community_points || 0;
    if (_lastNotifCp !== null && newCp > _lastNotifCp) {
      sorcToast('⚡ You earned ' + (newCp - _lastNotifCp) + ' Community Points!', '#b9aa00');
      // Update localStorage so profile page reflects new value
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
      sorcToast('📜 You have an Admin invitation! Visit your Profile to respond.', '#c93f35');
    }

    // ---- Update nav badges ----
    var badgeEl = document.getElementById('navRoleBadge');
    if (badgeEl) {
      var inboxLink = badgeEl.querySelector('#badgeInboxLink');
      if (inboxLink) {
        var isLawfulInbox = document.body.classList.contains('lawful-mode');
        var notifBg = '#fff';
        var notifColor = isLawfulInbox ? '#2196f3' : '#9c27b0';
        inboxLink.innerHTML = unread > 0
          ? 'Inbox <span style="background:' + notifBg + ' !important;color:' + notifColor + ' !important;border-radius:10px;padding:1px 6px;font-size:0.7rem;font-weight:bold;text-shadow:none !important;text-decoration:none !important;">' + unread + '</span>'
          : 'Inbox';
      }
      var fellowLink = badgeEl.querySelector('#badgeFellowshipsLink');
      if (fellowLink) {
        var isLawfulBadge = document.body.classList.contains('lawful-mode');
        var notifBg = '#fff';
        var notifColor = isLawfulBadge ? '#2196f3' : '#9c27b0';
        fellowLink.innerHTML = fellowBadge > 0
          ? 'Fellowships <span style="background:' + notifBg + ' !important;color:' + notifColor + ' !important;border-radius:10px;padding:1px 6px;font-size:0.7rem;font-weight:bold;text-shadow:none !important;text-decoration:none !important;">' + fellowBadge + '</span>'
          : 'Fellowships';
      }
      var profileLink = badgeEl.querySelector('a[href="/profile.html"]');
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
  var existing = document.getElementById('navRoleBadge');
  if (!existing) return;
  // Hide badge on signin page
  if (window.location.pathname.includes('signin')) {
    existing.style.display = 'none';
    return;
  }
  var isLawful = document.body.classList.contains('lawful-mode');
  var bgColor = isLawful ? '#2196f3' : '#9c27b0';
  var linkColor = isLawful ? '#ffffff' : '#c93f35';
  var shadowColor = isLawful ? 'none' : 'rgba(0,0,0,0.5)';
  // Default avatar icon (user circle) - mirror main login avatar colors
  var avatarBg = isLawful ? '#b9aa00' : '#c93f35';
  var avatarBorder = isLawful ? '#2196f3' : '#9c27b0';
  var defaultAvatar = '<span class="badge-avatar-default" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:' + avatarBg + ';border:1px solid ' + avatarBorder + ';font-size:0.9rem;margin-right:4px;">👤</span>';
  existing.style.cssText = 'display:inline-flex!important;align-items:center!important;gap:8px!important;padding:6px 14px!important;background:' + bgColor + '!important;border-radius:20px!important;font-size:0.85rem!important;flex-wrap:wrap!important;margin:0.5rem 0 1rem 0!important;';
  existing.innerHTML = defaultAvatar + 'User · Lobbies† · Inbox · <a href="#" style="color:' + linkColor + ' !important;text-decoration:underline;" onclick="event.preventDefault();checkKIDVerification(function(){window.location.href=\'/signin.html\';}, \'/signin.html\');">Login</a> (†Assess into role) · Fellowships · Forums · Content';
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
