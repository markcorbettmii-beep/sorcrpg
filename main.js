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

// ========== USER MINI POPUP (must be outside module scope) ==========
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

// ========== FIREBASE ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDu25MxYjeu-g6YjPjaOpfUSUw97yJj-Xg",
  authDomain: "sorc-a1393.firebaseapp.com",
  projectId: "sorc-a1393",
  storageBucket: "sorc-a1393.firebasestorage.app",
  messagingSenderId: "303646936307",
  appId: "1:303646936307:web:806bdcdc37c9e5c024bb86"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNER_EMAILS = ["corbett@sorcrpg.com"];
const ADMIN_EMAILS = ["markcorbett.mii@gmail.com"];

var googleUser = null;

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
  return 'assets/images/avatars/' + avatarId + '.png';
}

// ========== CHECK INBOX NOTIFICATIONS ==========
async function checkInboxNotifications(uid) {
  try {
    var snap = await getDocs(query(collection(db, "conversations"), where("receiverUid", "==", uid), where("status", "==", "pending")));
    if (snap.size > 0) {
      var notif = document.getElementById('inboxNotif');
      if (notif) {
        notif.textContent = snap.size;
        notif.style.display = 'inline-block';
      }
    }
  } catch(e) {}
}

// ========== ROLE BADGE ==========
function showRoleBadge(email, username, role, avatar, userId) {
  var existing = document.querySelector('.role-badge');
  if (existing) existing.remove();

  var existingPopup = document.querySelector('.role-popup');
  if (existingPopup) existingPopup.remove();

  var signinLink = document.getElementById('signinLink');
  if (signinLink) signinLink.style.display = 'none';

  var displayName = username || email.split('@')[0];
  var abbr = getRoleAbbr(role);
  var colors = getRoleColor(role);
  var safeUserId = String(userId || '');
  var isAdminUser = OWNER_EMAILS.includes(email) || ADMIN_EMAILS.includes(email);

  var avatarHtml = '';
  if (avatar) {
    var avatarPath = getAvatarPath(avatar);
    avatarHtml = '<img src="' + avatarPath + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);vertical-align:middle;margin-right:4px;" onerror="this.style.display=\'none\'" />';
  }

  // Insert badge below the theme toggle buttons in the nav
  var themeContainer = document.querySelector('.theme-toggle-container');
  if (themeContainer) {
    var existingNavBadge = document.getElementById('navRoleBadge');
    if (existingNavBadge) existingNavBadge.remove();

    var navBadge = document.createElement('div');
    navBadge.id = 'navRoleBadge';
    navBadge.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px;background:' + colors.bg + ';color:' + colors.color + ';border-radius:8px;font-size:0.8rem;font-weight:bold;flex-wrap:wrap;margin-top:4px;';

    navBadge.innerHTML =
      avatarHtml +
      displayName +
      ' <span class="role-tag" data-username="' + displayName + '" data-userid="' + safeUserId + '" data-role="' + role + '" data-isadmin="' + isAdminUser + '" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;">' + abbr + '</span>' +
      ' &nbsp;|&nbsp; <a href="profile.html" style="color:inherit;text-decoration:underline;">Profile</a>' +
      ' &nbsp;|&nbsp; <a href="inbox.html" style="color:inherit;text-decoration:underline;display:inline-flex;align-items:center;gap:3px;">Inbox <span id="inboxNotif" style="display:none;background:#fff;color:#d0021b;border-radius:10px;padding:0 5px;font-size:0.7rem;font-weight:bold;"></span></a>' +
      ' &nbsp;|&nbsp; <a href="forum.html" style="color:inherit;text-decoration:underline;">Forums</a>' +
      ' &nbsp;|&nbsp; <button onclick="sorcSignOut()" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;font-size:0.8rem;">Logout</button>';

    themeContainer.insertAdjacentElement('afterend', navBadge);

    navBadge.querySelector('.role-tag').addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      var isAdmin = this.dataset.isadmin === 'true';
      if (isAdmin) {
        showAdminMembersPopup();
      } else {
        showRolePopup(this.dataset.username, this.dataset.userid, this.dataset.role);
      }
    });
  }

  if (role === 'OWNER' || role === 'ADMIN') showAdminPanel();

  var uid = auth.currentUser ? auth.currentUser.uid : (googleUser ? googleUser.googleId : null);
  if (uid) checkInboxNotifications(uid);
}

// ========== OWN ROLE POPUP ==========
window.showRolePopup = function(username, userId, role) {
  var existing = document.querySelector('.role-popup');
  if (existing) { existing.remove(); return; }

  var popup = document.createElement('div');
  popup.className = 'role-popup';
  popup.style.cssText = 'position:fixed;top:80px;left:10px;background:#1a1a1a;border:1px solid #444;border-radius:8px;padding:1rem 1.2rem;z-index:99999;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';

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

  document.getElementById('closeRolePopup').addEventListener('click', function(e) {
    e.stopPropagation();
    popup.remove();
  });
};

// ========== ADMIN MEMBERS POPUP ==========
window.showAdminMembersPopup = async function() {
  var existing = document.querySelector('.role-popup');
  if (existing) { existing.remove(); return; }

  var popup = document.createElement('div');
  popup.className = 'role-popup';
  popup.style.cssText = 'position:fixed;top:80px;left:10px;background:#1a1a1a;border:1px solid #d4af37;border-radius:8px;padding:1rem 1.2rem;z-index:99999;min-width:260px;max-width:320px;max-height:400px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.5);';

  popup.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
      '<span style="color:#d4af37;font-size:0.85rem;font-weight:bold;">ALL MEMBERS</span>' +
      '<button id="closeRolePopup" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:0;">✕</button>' +
    '</div>' +
    '<div id="adminMembersList" style="font-size:0.8rem;">Loading...</div>';

  document.body.appendChild(popup);

  document.getElementById('closeRolePopup').addEventListener('click', function(e) {
    e.stopPropagation();
    popup.remove();
  });

  var snap = await getDocs(collection(db, "users"));
  var members = [];
  snap.forEach(function(d) {
    var data = d.data();
    var role = OWNER_EMAILS.includes(data.email) ? 'OWNER' : ADMIN_EMAILS.includes(data.email) ? 'ADMIN' : (data.role || 'CIVILIAN');
    var name = data.username || data.displayName || (data.email ? data.email.split('@')[0] : 'Unknown');
    members.push({ uid: d.id, name, role });
  });

  members.sort(function(a, b) { return a.name.localeCompare(b.name); });

  var html = members.map(function(m) {
    var colors = getRoleColor(m.role);
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a2a2a;">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span style="background:' + colors.bg + ';color:' + colors.color + ';padding:1px 5px;border-radius:4px;font-size:0.65rem;font-weight:bold;">' + getRoleAbbr(m.role) + '</span>' +
        '<span style="color:#e0cfc0;cursor:pointer;" onclick="showUserMiniPopup(event, \'' + m.uid + '\', \'' + m.name.replace(/'/g, "\\'") + '\')">' + m.name + '</span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<a href="public-profile.html?uid=' + m.uid + '" style="color:#d4af37;text-decoration:none;font-size:0.75rem;" title="View Profile">👤</a>' +
        '<a href="public-profile.html?uid=' + m.uid + '&msg=1" style="color:#d4af37;text-decoration:none;font-size:0.75rem;" title="Send Message">✉</a>' +
      '</div>' +
    '</div>';
  }).join('');

  document.getElementById('adminMembersList').innerHTML = html || '<span style="color:#555;">No members found.</span>';
};

// ========== SIGN OUT ==========
window.sorcSignOut = function() {
  signOut(auth);
  localStorage.removeItem('sorc_google_user');
  window.location.reload();
};

// ========== GET OR SET USER ROLE ==========
async function getUserRoleFromDB(uid, email) {
  var docRef = doc(db, "users", uid);
  var docSnap = await getDoc(docRef);
  var data = docSnap.exists() ? docSnap.data() : {};
  var username = data.username || data.displayName || '';
  var avatar = data.avatar || null;
  var userId = data.userId || '';
  var role = data.role || 'CIVILIAN';

  if (OWNER_EMAILS.includes(email)) role = 'OWNER';
  else if (ADMIN_EMAILS.includes(email)) role = 'ADMIN';

  if (!docSnap.exists()) {
    await setDoc(docRef, { email: email, role: 'CIVILIAN', displayName: '' });
  }

  return { role, username, avatar, userId };
}

// ========== AUTH STATE ==========
onAuthStateChanged(auth, async function(user) {
  if (user) {
    if (!user.emailVerified && user.providerData[0].providerId === 'password') {
      alert('Please verify your email before signing in. Check your inbox for a verification link.');
      signOut(auth);
      return;
    }
    var data = await getUserRoleFromDB(user.uid, user.email);
    showRoleBadge(user.email, data.username, data.role, data.avatar, data.userId);
  } else {
    try {
      var saved = localStorage.getItem('sorc_google_user');
      if (saved) googleUser = JSON.parse(saved);
    } catch(e) {}

    if (googleUser) {
      try {
        var role = googleUser.role || 'CIVILIAN';
        var username = googleUser.username || googleUser.name || '';
        var avatar = googleUser.avatar || null;
        var userId = googleUser.userId || '';

        if (OWNER_EMAILS.includes(googleUser.email)) role = 'OWNER';
        else if (ADMIN_EMAILS.includes(googleUser.email)) role = 'ADMIN';

        if (googleUser.googleId) {
          try {
            var docSnap = await getDoc(doc(db, "users", googleUser.googleId));
            if (docSnap.exists()) {
              username = docSnap.data().username || docSnap.data().displayName || username;
              avatar = docSnap.data().avatar || avatar;
              userId = docSnap.data().userId || userId;
              if (!OWNER_EMAILS.includes(googleUser.email) && !ADMIN_EMAILS.includes(googleUser.email)) {
                role = docSnap.data().role || role;
              }
              googleUser.username = username;
              googleUser.avatar = avatar;
              googleUser.userId = userId;
              googleUser.role = role;
              localStorage.setItem('sorc_google_user', JSON.stringify(googleUser));
            }
          } catch(e) {}
        }

        showRoleBadge(googleUser.email, username, role, avatar, userId);
      } catch(e) {
        localStorage.removeItem('sorc_google_user');
      }
    }
  }
});

// ========== LISTEN FOR GOOGLE LOGIN FROM SIGNIN TAB ==========
window.addEventListener('storage', async function(e) {
  if (e.key === 'sorc_google_user' && e.newValue) {
    try {
      var userInfo = JSON.parse(e.newValue);
      var role = userInfo.role || 'CIVILIAN';
      var username = userInfo.username || userInfo.name || '';
      var avatar = userInfo.avatar || null;
      var userId = userInfo.userId || '';
      if (OWNER_EMAILS.includes(userInfo.email)) role = 'OWNER';
      else if (ADMIN_EMAILS.includes(userInfo.email)) role = 'ADMIN';
      showRoleBadge(userInfo.email, username, role, avatar, userId);
    } catch(err) {
      console.error(err);
    }
  }
});

// ========== EMAIL SIGNUP ==========
window.sorcSignUp = function(email, password) {
  if (!email || !password) { alert('Please enter an email and password.'); return; }
  createUserWithEmailAndPassword(auth, email, password).then(async function(result) {
    await sendEmailVerification(result.user);
    await setDoc(doc(db, "users", result.user.uid), {
      email: email, role: 'CIVILIAN', displayName: '', accountType: 'CIVILIAN'
    });
    signOut(auth);
    document.querySelectorAll('.verify-notice').forEach(function(n) { n.style.display = 'block'; });
    document.querySelectorAll('#signupForm, #signupForm2').forEach(function(f) { f.style.display = 'none'; });
  }).catch(function(error) { alert('Sign up failed: ' + error.message); });
};

// ========== EMAIL SIGN IN ==========
window.sorcSignIn = function(email, password) {
  if (!email || !password) { alert('Please enter your email and password.'); return; }
  signInWithEmailAndPassword(auth, email, password).then(async function(result) {
    if (!result.user.emailVerified) {
      alert('Please verify your email first. Check your inbox for a verification link.');
      signOut(auth);
      return;
    }
    var data = await getUserRoleFromDB(result.user.uid, result.user.email);
    showRoleBadge(result.user.email, data.username, data.role, data.avatar, data.userId);
  }).catch(function(error) { alert('Sign in failed: ' + error.message); });
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
      '<button onclick="loadUsers()" style="background:#555;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;">View All Users</button>' +
      '<div id="gmCodeOutput" style="margin-top:10px;font-size:0.85rem;"></div>' +
      '<div id="userList" style="margin-top:10px;font-size:0.8rem;max-height:200px;overflow-y:auto;"></div>' +
    '</div>';
  document.body.appendChild(panel);
}

window.toggleAdminPanel = function() {
  var content = document.getElementById('adminPanelContent');
  var btn = document.querySelector('.admin-panel button');
  if (content.style.display === 'none') {
    content.style.display = 'block'; btn.textContent = '−';
  } else {
    content.style.display = 'none'; btn.textContent = '+';
  }
};

window.generateGMCode = async function() {
  var code = 'MASTER-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  await addDoc(collection(db, "gm_codes"), { code: code, used: false, createdAt: new Date() });
  document.getElementById('gmCodeOutput').innerHTML = 'New Master Code: <strong>' + code + '</strong><br><small>Share this with your Master</small>';
};

window.loadUsers = async function() {
  var userListEl = document.getElementById('userList');
  userListEl.innerHTML = 'Loading...';
  var snap = await getDocs(collection(db, "users"));
  var members = [];
  snap.forEach(function(d) {
    var data = d.data();
    var role = OWNER_EMAILS.includes(data.email) ? 'OWNER' : ADMIN_EMAILS.includes(data.email) ? 'ADMIN' : (data.role || 'CIVILIAN');
    var name = data.username || data.displayName || (data.email ? data.email.split('@')[0] : 'Unknown');
    members.push({ uid: d.id, name, role, userId: data.userId || '' });
  });
  members.sort(function(a, b) { return a.name.localeCompare(b.name); });

  var html = '<table style="width:100%;border-collapse:collapse;">' +
    '<tr style="color:#d4af37;border-bottom:1px solid #444;">' +
      '<th style="text-align:left;padding:4px;">Username</th>' +
      '<th style="text-align:left;padding:4px;">Role</th>' +
      '<th style="text-align:left;padding:4px;">ID</th>' +
    '</tr>';

  members.forEach(function(m) {
    html += '<tr style="border-bottom:1px solid #333;">' +
      '<td style="padding:4px;">' +
        '<span style="color:#d4af37;cursor:pointer;text-decoration:underline;" onclick="showUserMiniPopup(event, \'' + m.uid + '\', \'' + m.name.replace(/'/g, "\\'") + '\')">' + m.name + '</span>' +
      '</td>' +
      '<td style="padding:4px;">' + m.role + '</td>' +
      '<td style="padding:4px;">#' + m.userId + '</td>' +
    '</tr>';
  });

  html += '</table>';
  userListEl.innerHTML = html;
};
