const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  
  // Take screenshot of index.html badge area
  await page.goto('http://localhost:8000/index.html');
  await page.screenshot({ 
    path: '/tmp/index-badge.png',
    clip: {
      x: 0,
      y: 0,
      width: 1280,
      height: 200
    }
  });
  console.log('Saved index.html badge screenshot');
  
  // Take screenshot of talents.html badge area
  await page.goto('http://localhost:8000/talents.html');
  await page.screenshot({ 
    path: '/tmp/talents-badge.png',
    clip: {
      x: 0,
      y: 0,
      width: 1280,
      height: 200
    }
  });
  console.log('Saved talents.html badge screenshot');
  
  await browser.close();
})().catch(console.error);
