const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:3000/index.html');
  
  await page.evaluate(async () => {
    try {
        const { FFmpeg } = window.FFmpegWASM;
        const ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => console.log('FFMPEG LOG:', message));
        
        await ffmpeg.load({
            coreURL: '/lib/ffmpeg/ffmpeg-core.js',
            wasmURL: '/lib/ffmpeg/ffmpeg-core.wasm'
        });
        
        console.log('Testing dummy merge...');
        // Create 1-second dummy video and audio
        await ffmpeg.exec(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=30', 'video.mp4']);
        await ffmpeg.exec(['-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1', '-c:a', 'aac', 'audio.m4a']);
        
        const ret = await ffmpeg.exec(['-i', 'video.mp4', '-i', 'audio.m4a', '-c', 'copy', 'output.mp4']);
        console.log('Merge exit code:', ret);
    } catch (err) {
        console.error('Test failed:', err.message);
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  await browser.close();
})();
