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
const ADMIN_EMAIL = "markcorbett.mii@gmail.com";

// ========== ROLE BADGE ==========
function showRoleBadge(email, name, role) {
  var existing = document.querySelector('.role-badge');
  if (existing) existing.remove();

  // Hide sign in link
  var signinLink = document.getElementById('signinLink');
  if (signinLink) signinLink.style.display = 'none';

  var badge = document.createElement('div');
  badge.className = 'role-badge';
  badge.style.cssText = 'position:fixed;top:10px;right:10px;padding:8px 16px;border-radius:8px;font-weight:bold;z-index:9999;font-size:0.9rem;';

  var roleLabel = role === 'BOUNCER' ? 'BOUNCER' : role === 'MASTER' ? 'MASTER' : role === 'PLAYER' ? 'PLAYER' : 'CIVILIAN';

  if (role === 'BOUNCER') { badge.style.background = '#d4af37'; badge.style.color = '#222'; }
  else if (role === 'MASTER') { badge.style.background = '#1a6b1a'; badge.style.color = '#fff'; }
  else if (role === 'PLAYER') { badge.style.background = '#1a3a6b'; badge.style.color = '#fff'; }
  else { badge.style.background = '#333'; badge.style.color = '#e0cfc0'; }

  badge.innerHTML = 'Signed in as ' + roleLabel +
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
  if (email === ADMIN_EMAIL) return 'BOUNCER';
  var docRef = doc(db, "users", uid);
  var docSnap = await getDoc(docRef);
  if (docSnap.exists()) return docSnap.data().role || 'CIVILIAN';
  await setDoc(docRef, { email: email, role: 'CIVILIAN', displayName: '' });
  return 'CIVILIAN';
}

// ========== AUTH STATE (Firebase email/password) ==========
onAuthStateChanged(auth, async function(user) {
  if (user) {
    if (!user.emailVerified && user.providerData[0].providerId === 'password') {
      alert('Please verify your email before signing in. Check your inbox for a verification link.');
      signOut(auth);
      return;
    }
    var role = await getUserRoleFromDB(user.uid, user.email);
    showRoleBadge(user.email, user.displayName, role);
  }
});

// ========== CHECK PERSISTED GOOGLE SESSION ==========
document.addEventListener('DOMContentLoaded', async function() {
  var savedGoogle = localStorage.getItem('sorc_google_user');
  if (savedGoogle) {
    try {
      var userInfo = JSON.parse(savedGoogle);
      var role = userInfo.role || 'CIVILIAN';
      if (userInfo.email === ADMIN_EMAIL) role = 'BOUNCER';
      showRoleBadge(userInfo.email, userInfo.name, role);
    } catch(e) {
      localStorage.removeItem('sorc_google_user');
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
    var role = await getUserRoleFromDB(result.user.uid, result.user.email);
    showRoleBadge(result.user.email, result.user.displayName, role);
  }).catch(function(error) {
    alert('Sign in failed: ' + error.message);
  });
};

// ========== ADMIN PANEL ==========
function showAdminPanel() {
  if (document.querySelector('.admin-panel')) return;
  var panel = document.createElement('div');
  panel.className = 'admin-panel';
  // Position above cookie banner, with minimize
  panel.style.cssText = 'position:fixed;bottom:80px;right:10px;background:#222;color:#fff;padding:16px;border-radius:8px;z-index:9998;min-width:260px;border:2px solid #d4af37;';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<h3 style="color:#d4af37;margin:0;">Admin Panel</h3>' +
      '<button onclick="toggleAdminPanel()" style="background:none;border:none;color:#d4af37;cursor:pointer;font-size:1.2rem;font-weight:bold;">−</button>' +
    '</div>' +
    '<div id="adminPanelContent">' +
      '<button onclick="generateGMCode()" style="background:#d4af37;color:#222;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;">Generate Master Code</button>' +
      '<div id="gmCodeOutput" style="margin-top:10px;font-size:0.85rem;"></div>' +
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
