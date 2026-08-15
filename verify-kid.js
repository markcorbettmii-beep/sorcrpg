// K-ID Verification Script
// Include this script on pages that have downloads to verify age via K-ID

function checkKIDVerification(downloadCallback) {
  // Check if kidVerified cookie exists
  var kidVerified = document.cookie.split('; ').find(row => row.startsWith('kidVerified='));

  // If cookie exists, proceed with download
  if (kidVerified) {
    downloadCallback();
    return;
  }

  // If no cookie, redirect to K-ID verification page
  var returnUrl = window.location.pathname + window.location.search;
  window.location.href = '/k-id-status.html?return=' + encodeURIComponent(returnUrl);
}

// Export for use in other scripts
window.checkKIDVerification = checkKIDVerification;
