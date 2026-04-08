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
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const ADMIN_EMAILS = ["markcorbett.mii@gmail.com", "corbett@sorcrpg.com"];

// ========== ROLE HELPERS ==========
function getRoleAbbr(role) {
  if (role === 'BOUNCER') return '[AD]';
  if (role === 'MASTER') return '[GM]';
  if (role === 'PLAYER') return '[PC]';
  return '[CIV]';
}

function getRoleColor(role) {
  if (role === 'BOUNCER') return { bg: '#d4af37', color: '#222' };
  if (role === 'MASTER') return { bg: '#1a6b1a', color: '#fff' };
  if (role === 'PLAYER') return { bg: '#1a3a6b', color: '#fff' };
  return { bg: '#333', color: '#e0cfc0' };
}

// ========== ROLE BADGE ==========
function showRoleBadge(email, username, role) {
  var existing = document.querySelector('.role-badge');
  if (existing) existing.remove();

  var signinLink = document.getElementById('signinLink');
  if (signinLink) signinLink.style.display = 'none';

  var badge = document.createElement('div');
  badge.className = 'role-badge';
  var colors = getRoleColor(role);
  badge.style.cssText = 'position:fixed;top:10px;right:10px;padding:8px 16px;border-radius:8px;font-weight:bold;z-index:9999;font-size:0.9rem;background:' + colors.bg + ';color:' + colors.color + ';';

  var displayName = username || email.split('@')[0];
  var abbr = getRoleAbbr(role);

  badge.innerHTML = displayName + ' ' + abbr +
    ' &nbsp;|&nbsp; <a href="profile.html" style="color:inherit;text-decoration:underline;">Profile</a>' +
    ' &nbsp;|&nbsp; <button onclick="sorcSignOut()" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;">Logout</button>';
  document.body.appendChild(badge);

  if (role === 'BOUNCER') showAdminPanel();
}

// ========== SIGN OUT ==========
window.sorcSignOut = function() {
  signOut(auth);
  localStorage.removeItem('sorc_google_user');
  window.location.reload();
};

// ========== GET OR SET USER ROLE ==========
async function getUserRoleFromDB(uid, email) {
  if (ADMIN_EMAILS.includes(email)) return { role: 'BOUNCER', username: 'Admin' };
  var docRef = doc(db, "users", uid);
  var docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return {
      role: docSnap.data().role || 'CIVILIAN',
      username: docSnap.data().username || docSnap.data().displayName || ''
    };
  }
  await setDoc(docRef, { email: email, role: 'CIVILIAN', displayName: '' });
  return { role: 'CIVILIAN', username: '' };
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
    showRoleBadge(user.email, data.username, data.role);
  }
});

// ========== CHECK PERSISTED GOOGLE SESSION ==========
document.addEventListener('DOMContentLoaded', async function() {
  var savedGoogle = localStorage.getItem('sorc_google_user');
  if (savedGoogle) {
    try {
      var userInfo = JSON.parse(savedGoogle);
      var role = userInfo.role || 'CIVILIAN';
      var username = userInfo.username || userInfo.name || '';
      if (ADMIN_EMAILS.includes(userInfo.email)) role = 'BOUNCER';
      showRoleBadge(userInfo.email, username, role);
    } catch(e) {
      localStorage.removeItem('sorc_google_user');
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
      if (ADMIN_EMAILS.includes(userInfo.email)) role = 'BOUNCER';
      showRoleBadge(userInfo.email, username, role);
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
      email: email,
      role: 'CIVILIAN',
      displayName: '',
      accountType: 'CIVILIAN'
    });
    signOut(auth);
    document.querySelectorAll('.verify-notice').forEach(function(n) {
      n.style.display = 'block';
    });
    document.querySelectorAll('#signupForm, #signupForm2').forEach(function(f) {
      f.style.display = 'none';
    });
  }).catch(function(error) {
    alert('Sign up failed: ' + error.message);
  });
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
    showRoleBadge(result.user.email, data.username, data.role);
  }).catch(function(error) {
    alert('Sign in failed: ' + error.message);
  });
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
    content.style.display = 'block';
    btn.textContent = '−';
  } else {
    content.style.display = 'none';
    btn.textContent = '+';
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
  var html = '<table style="width:100%;border-collapse:collapse;">' +
    '<tr style="color:#d4af37;border-bottom:1px solid #444;">' +
      '<th style="text-align:left;padding:4px;">Username</th>' +
      '<th style="text-align:left;padding:4px;">Role</th>' +
      '<th style="text-align:left;padding:4px;">ID</th>' +
    '</tr>';
  snap.forEach(function(d) {
    var data = d.data();
    html += '<tr style="border-bottom:1px solid #333;">' +
      '<td style="padding:4px;">' + (data.username || data.email || 'N/A') + '</td>' +
      '<td style="padding:4px;">' + (data.role || 'CIVILIAN') + '</td>' +
      '<td style="padding:4px;">#' + (data.userId || 'N/A') + '</td>' +
    '</tr>';
  });
  html += '</table>';
  userListEl.innerHTML = html;
};
