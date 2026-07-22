const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  
  await page.evaluate(async () => {
    try {
        console.log('Fetching file-examples via allorigins get...');
        let res = await fetch('https://api.allorigins.win/get?url=https://file-examples.com/wp-content/storage/2017/04/file_example_MP4_480_1_5MG.mp4');
        let json = await res.json();
        console.log('Length of base64 contents:', json.contents.length);
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
  });
  
  await browser.close();
})();
