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
  if (!hasConsent && cookieConsent) cookieConsent.style.display = 'block';
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

// ========== ACCOUNT TYPE SELECTOR ==========
var selectedAccountType = 'BASIC';
window.selectAccountType = function(type, btn) {
  selectedAccountType = type;
  // Update all account type button groups
  document.querySelectorAll('.account-type-selector').forEach(function(selector) {
    selector.querySelectorAll('.account-type-btn').forEach(function(b) {
      b.classList.remove('active');
    });
  });
  // Activate clicked button and its sibling group
  var parentSelector = btn.closest('.account-type-selector');
  parentSelector.querySelectorAll('.account-type-btn').forEach(function(b) {
    if (b.textContent === type) b.classList.add('active');
  });

  // Show/hide assessment message and signup form
  var msgs = document.querySelectorAll('.assessment-msg');
  var forms = document.querySelectorAll('#signupForm, #signupForm2');

  if (type === 'BASIC') {
    msgs.forEach(function(m) { m.style.display = 'none'; });
    forms.forEach(function(f) { f.style.display = 'block'; });
  } else {
    msgs.forEach(function(m) { m.style.display = 'block'; });
    forms.forEach(function(f) { f.style.display = 'none'; });
  }
};

// ========== FIREBASE ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
const googleProvider = new GoogleAuthProvider();
const ADMIN_EMAIL = "markcorbett.mii@gmail.com";

// ========== ROLE BADGE ==========
function showRoleBadge(user, role) {
  var existing = document.querySelector('.role-badge');
  if (existing) existing.remove();
  var badge = document.createElement('div');
  badge.className = 'role-badge';
  badge.style.cssText = 'position:fixed;top:10px;right:10px;padding:8px 16px;border-radius:8px;font-weight:bold;z-index:9999;font-size:0.9rem;cursor:pointer;';
  var roleLabel = role === 'ADMIN' ? 'ADMIN' : role === 'GM' ? 'GM' : role === 'PC' ? 'PC' : 'BASIC';
  if (role === 'ADMIN') badge.style.background = '#d4af37', badge.style.color = '#222';
  else if (role === 'GM') badge.style.background = '#1a6b1a', badge.style.color = '#fff';
  else if (role === 'PC') badge.style.background = '#1a3a6b', badge.style.color = '#fff';
  else badge.style.background = '#333', badge.style.color = '#e0cfc0';
  badge.innerHTML = 'Signed in as ' + roleLabel + ' &nbsp;|&nbsp; <a href="profile.html" style="color:inherit;text-decoration:underline;">Profile</a> &nbsp;|&nbsp; <button onclick="sorcSignOut()" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;">Logout</button>';
  document.body.appendChild(badge);
  document.querySelectorAll('.signup-card.legend-signup').forEach(function(card) {
    card.style.display = 'none';
  });
  if (role === 'ADMIN') showAdminPanel();
}

// ========== SIGN OUT ==========
window.sorcSignOut = function() {
  signOut(auth).then(function() {
    localStorage.removeItem('sorc_idToken');
    window.location.reload();
  });
};

// ========== GET OR SET USER ROLE ==========
async function getUserRole(user) {
  if (user.email === ADMIN_EMAIL) return 'ADMIN';
  var docRef = doc(db, "users", user.uid);
  var docSnap = await getDoc(docRef);
  if (docSnap.exists()) return docSnap.data().role || 'BASIC';
  await setDoc(docRef, { email: user.email, role: 'BASIC', displayName: user.displayName || '' });
  return 'BASIC';
}

// ========== AUTH STATE ==========
onAuthStateChanged(auth, async function(user) {
  if (user) {
    var role = await getUserRole(user);
    showRoleBadge(user, role);
  }
});

// ========== GOOGLE LOGIN ==========
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.oauth-google').forEach(function(btn) {
    btn.addEventListener('click', function() {
      signInWithPopup(auth, googleProvider).then(async function(result) {
        var role = await getUserRole(result.user);
        showRoleBadge(result.user, role);
      }).catch(function(error) {
        alert('Google sign-in failed: ' + error.message);
      });
    });
  });
});

// ========== EMAIL SIGNUP ==========
window.sorcSignUp = function(email, password) {
  createUserWithEmailAndPassword(auth, email, password).then(async function(result) {
    await setDoc(doc(db, "users", result.user.uid), {
      email: email,
      role: 'BASIC',
      displayName: '',
      accountType: selectedAccountType
    });
    showRoleBadge(result.user, 'BASIC');
  }).catch(function(error) {
    alert('Sign up failed: ' + error.message);
  });
};

// ========== EMAIL SIGN IN ==========
window.sorcSignIn = function(email, password) {
  signInWithEmailAndPassword(auth, email, password).then(async function(result) {
    var role = await getUserRole(result.user);
    showRoleBadge(result.user, role);
  }).catch(function(error) {
    alert('Sign in failed: ' + error.message);
  });
};

// ========== ADMIN PANEL ==========
function showAdminPanel() {
  if (document.querySelector('.admin-panel')) return;
  var panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#222;color:#fff;padding:16px;border-radius:8px;z-index:9999;min-width:260px;border:2px solid #d4af37;';
  panel.innerHTML = '<h3 style="color:#d4af37;margin:0 0 10px 0;">Admin Panel</h3>' +
    '<button onclick="generateGMCode()" style="background:#d4af37;color:#222;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;">Generate GM Code</button>' +
    '<div id="gmCodeOutput" style="margin-top:10px;font-size:0.85rem;"></div>';
  document.body.appendChild(panel);
}

window.generateGMCode = async function() {
  var code = 'GM-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  await addDoc(collection(db, "gm_codes"), { code: code, used: false, createdAt: new Date() });
  document.getElementById('gmCodeOutput').innerHTML = 'New GM Code: <strong>' + code + '</strong><br><small>Share this with your GM</small>';
};
