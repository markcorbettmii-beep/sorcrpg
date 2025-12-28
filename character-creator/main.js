// --- SAVE AS JPEG BUTTON ---
const showJpegBtn = document.getElementById("showJpegBtn");
showJpegBtn.addEventListener("click", function() {
  const aiPortraitChk = document.getElementById("aiPortraitChk");
  const usePortrait = (aiPortraitChk && aiPortraitChk.checked) || isPortraitView;
  
  // Open blank window immediately
  const win = window.open('', '_blank');
  
  renderCharacter(function(charCanvas) {
    // Create composite canvas
    const profileCanvas = document.createElement('canvas');
    const profileCtx = profileCanvas.getContext('2d');
    
    // Profile sheet dimensions (10" x 14.5" at 210 DPI)
    profileCanvas.width = 2100;
    profileCanvas.height = 3045;
    
    // Load the profile sheet template
    const profileSheet = new Image();
    profileSheet.src = `${BASE}profile-sheet-template.png`;
    
    profileSheet.onload = function() {
      // Fill with white background first
      profileCtx.fillStyle = 'white';
      profileCtx.fillRect(0, 0, profileCanvas.width, profileCanvas.height);
      
      // Draw the profile sheet background
      profileCtx.drawImage(profileSheet, 0, 0, profileCanvas.width, profileCanvas.height);
      
      // Portrait frame position and size (adjusted to fit between text)
      const portraitX = 730;
      const portraitY = 640;
      const portraitWidth = 640;
      const portraitHeight = 1000;
      
      if (usePortrait) {
        // Load and draw portrait example
        const portraitImg = new Image();
        portraitImg.src = PORTRAIT_EXAMPLE;
        portraitImg.onload = function() {
          profileCtx.drawImage(portraitImg, portraitX, portraitY, portraitWidth, portraitHeight);
          const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
        portraitImg.onerror = function() {
          // Fallback to character canvas
          profileCtx.drawImage(charCanvas, portraitX, portraitY, portraitWidth, portraitHeight);
          const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
      } else {
        // Draw the character canvas in the portrait frame
        profileCtx.drawImage(charCanvas, portraitX, portraitY, portraitWidth, portraitHeight);
        const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
        win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
      }
    };
    
    profileSheet.onerror = function() {
      console.error('Failed to load profile sheet template');
      win.document.write('<p>Error: Could not load profile sheet. Make sure profile-sheet-template.png is in the assets folder.</p>');
    };
  });
});
