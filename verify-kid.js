// K-ID Verification Script
// Include this script on pages that have downloads to verify age via K-ID

function checkKIDVerification(downloadCallback) {
  // Check if kidVerified cookie exists
  function hasCookie(name) {
    var nameEQ = name + "=";
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return true;
      }
    }
    return false;
  }

  // If cookie exists, proceed with download
  if (hasCookie('kidVerified')) {
    downloadCallback();
    return;
  }

  // If no cookie, redirect to K-ID verification page
  var returnUrl = window.location.pathname + window.location.search;
  window.location.href = '/k-id-status.html?return=' + encodeURIComponent(returnUrl);
}

// Export for use in other scripts
window.checkKIDVerification = checkKIDVerification;
