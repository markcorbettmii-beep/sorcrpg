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

  if (!hasConsent && cookieConsent) {
    cookieConsent.style.display = 'block';
  }

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

    if (!ageVerified) {
      ageModal.style.display = 'flex';
    }

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

// ========== FIREBASE CONFIG ==========
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
  badge.style.cssText = 'position:fixed;top:10px;right:10px;background:#d0021b;color:#fff;padding:8px 16px;border-radius:8px;font-weight:bold;z-index:9999;font-size:0.9rem;';

  var roleLabel = role === 'admin' ? 'Admin' : role === 'gm' ? 'GM' : 'PC';
  badge.innerHTML = 'Signed in as ' + roleLabel + ' &nbsp;|&nbsp; <button onclick="sorcSignOut()" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;">Logout</button>';

  if (role === 'admin') badge.style.background = '#d4af37';
  if (role === 'gm') badge.style.background = '#1a6b1a';

  document.body.appendChild(badge);

  // Hide signup cards
  document.querySelectorAll('.signup-card.legend-signup').forEach(function(card) {
    card.style.display = 'none';
  });

  // Show admin panel if admin
  if (role === 'admin') showAdminPanel();
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
  if (user.email === ADMIN_EMAIL) return 'admin';
  var docRef = doc(db, "users", user.uid);
  var docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().role || 'pc';
  }
  // New user — save as PC by default
  await setDoc(docRef, { email: user.email, role: 'pc', displayName: user.displayName || '' });
  return 'pc';
}

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, async function(user) {
  if (user) {
    var role = await getUserRole(user);
    showRoleBadge(user, role);
  }
});

// ========== GOOGLE LOGIN ==========
document.addEventListener('DOMContentLoaded', function() {
  var googleBtns = document.querySelectorAll('.oauth-google');
  googleBtns.forEach(function(btn) {
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

// ========== EMAIL/PASSWORD SIGNUP ==========
window.sorcSignUp = function(email, password, gmCode) {
  createUserWithEmailAndPassword(auth, email, password).then(async function(result) {
    var role = 'pc';
    if (gmCode) {
      // Check GM code against Firestore
      var codesSnap = await getDocs(collection(db, "gm_codes"));
      codesSnap.forEach(function(d) {
        if (d.data().code === gmCode && !d.data().used) role = 'gm';
      });
    }
    await setDoc(doc(db, "users", result.user.uid), {
      email: email,
      role: role,
      displayName: ''
    });
    showRoleBadge(result.user, role);
  }).catch(function(error) {
    alert('Sign up failed: ' + error.message);
  });
};

// ========== EMAIL/PASSWORD SIGN IN ==========
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
