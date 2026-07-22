document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const extractForm = document.getElementById('extract-form');
  const sourceCodeInput = document.getElementById('source-code');
  const charCounter = document.getElementById('char-counter');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');
  const submitBtn = document.getElementById('submit-btn');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const resultCard = document.getElementById('result-card');
  const resTitle = document.getElementById('res-title');
  const videoPreviewPlayer = document.getElementById('video-preview-player');
  const downloadOptions = document.getElementById('download-options');
  const historyList = document.getElementById('history-list');
  const emptyHistory = document.getElementById('empty-history');
  const toast = document.getElementById('toast');

  // Modals
  const helpModal = document.getElementById('help-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalOkBtn = document.getElementById('modal-ok-btn');

  const disclaimerModal = document.getElementById('disclaimer-modal');
  const disclaimerLink = document.getElementById('terms-link');
  const disclaimerCloseBtn = document.getElementById('disclaimer-close-btn');
  const disclaimerOkBtn = document.getElementById('disclaimer-ok-btn');

  // --- 1. Guide Tabs Switcher ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // --- 2. Input Helpers (Char Counter, Paste, Clear) ---
  const updateCharCount = () => {
    const len = sourceCodeInput.value.length;
    charCounter.textContent = `${len.toLocaleString()} character${len === 1 ? '' : 's'}`;
  };

  sourceCodeInput.addEventListener('input', updateCharCount);

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      sourceCodeInput.value = text;
      updateCharCount();
      showToast('Pasted from clipboard!');
    } catch (err) {
      console.warn('Clipboard read failed: ', err);
      showToast('Permission denied or clipboard empty. Please paste manually.', true);
    }
  });

  clearBtn.addEventListener('click', () => {
    sourceCodeInput.value = '';
    updateCharCount();
    showToast('Input cleared');
  });

  // --- 3. URL Extraction Engine ---
  const cleanUrl = (url) => {
    let cleaned = url;

    // 1. Strip trailing XML tags like \u003c/BaseURL or </BaseURL if captured
    cleaned = cleaned.split(/[\\/]u003c/i)[0].split('<')[0];

    // 2. Decode unicode escapes first (e.g. \u0026 -> &)
    try {
      cleaned = JSON.parse('"' + cleaned + '"');
    } catch (e) {
      cleaned = cleaned
        .replace(/\\u0026/g, '&')
        .replace(/\\u0025/g, '%')
        .replace(/\\u0022/g, '"')
        .replace(/\\u0027/g, "'");
    }

    // 3. Replace escaped slashes (\/ -> /)
    cleaned = cleaned.replace(/\\\//g, '/');

    // 4. Decode html entities like &amp; using temporary element
    const txt = document.createElement("textarea");
    txt.innerHTML = cleaned;
    cleaned = txt.value;

    // 5. Clean up any accidental wrapping symbols
    cleaned = cleaned.replace(/^["'\\]+|["'\\]+$/g, '');

    return cleaned;
  };

  const isValidVideoUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();

    // Must contain fbcdn.net
    if (!lower.includes('fbcdn.net')) return false;

    // Exclude static resources and domains
    if (lower.includes('static.xx.fbcdn.net') || lower.includes('/rsrc.php/')) return false;

    // Exclude common static asset file types unless they explicitly contain video streaming extensions
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.svg', '.json'];
    const hasStaticExt = staticExtensions.some(ext => lower.includes(ext));

    if (hasStaticExt) {
      if (!lower.includes('.mp4') && !lower.includes('.mpd') && !lower.includes('.m4v') && !lower.includes('.m4a') && !lower.includes('.m3u8')) {
        return false;
      }
    }

    return true;
  };

  const safeAtob = (str) => {
    try {
      const cleaned = str.replace(/[^A-Za-z0-9+/=]/g, '');
      return atob(cleaned);
    } catch (e) {
      return '';
    }
  };

  const classifyUrl = (url, sourceName) => {
    const lowerUrl = url.toLowerCase();

    // Default values
    let type = 'video_with_audio';
    let label = 'Full Video (with Audio)';
    let quality = 'SD';

    // 1. Try decoding the efg parameter first to inspect the internal stream tag
    let vencodeTag = '';
    const efgMatch = url.match(/[?&]efg=([^&]+)/);
    if (efgMatch && efgMatch[1]) {
      let rawEfg = efgMatch[1];
      // Normalize double-escaped or malformed percent signs (e.g. /u0025 or \u0025 to %)
      rawEfg = rawEfg.replace(/[\/\\]u0025/gi, '%');
      try {
        rawEfg = decodeURIComponent(rawEfg);
      } catch (e) {
        try {
          rawEfg = unescape(rawEfg);
        } catch (err) { }
      }

      const decoded = safeAtob(rawEfg);
      try {
        const efgObj = JSON.parse(decoded);
        vencodeTag = efgObj.vencode_tag || '';
      } catch (e) {
        vencodeTag = decoded;
      }
    }

    const tagLower = vencodeTag.toLowerCase();

    // 2. Classify based on the decoded vencode_tag if successfully parsed
    if (tagLower) {
      if (tagLower.includes('audio')) {
        type = 'audio_only';
        label = 'Audio Only (High Quality)';
        quality = 'Audio';
      } else if (tagLower.includes('progressive') || tagLower.includes('tag=sd') || tagLower.includes('tag=hd')) {
        type = 'video_with_audio';
        label = 'Full Video (with Audio)';
        quality = (tagLower.includes('hd') || lowerUrl.includes('tag=hd')) ? 'HD' : 'SD';
      } else if (tagLower.includes('video')) {
        type = 'video_only';
        label = 'HD Video Only (No Audio)';
        quality = 'HD';
      } else {
        type = 'video_with_audio';
        label = 'Full Video (with Audio)';
        quality = (tagLower.includes('hd') || lowerUrl.includes('tag=hd')) ? 'HD' : 'SD';
      }
      return { type, label, quality };
    }

    // 3. Fallback to key-based or heuristic classification if no vencode_tag exists
    if (sourceName && sourceName !== 'General CDN Scan') {
      quality = sourceName.toLowerCase().includes('hd') ? 'HD' : 'SD';
      // Progressive browser-native URLs usually contain audio
      if (sourceName.toLowerCase().includes('hd_url') || sourceName.toLowerCase().includes('sd_url') || sourceName.toLowerCase().includes('playable')) {
        type = 'video_with_audio';
        label = 'Full Video (with Audio)';
      } else {
        type = 'video_only';
        label = 'HD Video Only (No Audio)';
      }
      return { type, label, quality };
    }

    // Heuristics from URL text
    if (lowerUrl.includes('audio') || lowerUrl.includes('.m4a')) {
      type = 'audio_only';
      label = 'Audio Only (High Quality)';
      quality = 'Audio';
    } else if (lowerUrl.includes('progressive') || lowerUrl.includes('tag=sd') || lowerUrl.includes('tag=hd')) {
      type = 'video_with_audio';
      label = 'Full Video (with Audio)';
      quality = lowerUrl.includes('tag=hd') ? 'HD' : 'SD';
    } else if (lowerUrl.includes('video') || lowerUrl.includes('.mp4')) {
      type = 'video_only';
      label = 'HD Video Only (No Audio)';
      quality = 'HD';
    }

    return { type, label, quality };
  };

  const extractVideoUrls = (htmlContent) => {
    const foundUrls = {}; // Key: type_quality to allow separate HD-silent, SD-audio, and audio-only streams
    const seenUrls = new Set();

    // A. Search by specific metadata keys (these are always progressive)
    const keyPatterns = [
      { name: 'browser_native_hd_url', regex: /"browser_native_hd_url"\s*:\s*"([^"]+)"/g },
      { name: 'browser_native_sd_url', regex: /"browser_native_sd_url"\s*:\s*"([^"]+)"/g },
      { name: 'playable_url_quality_hd', regex: /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g },
      { name: 'playable_url', regex: /"playable_url"\s*:\s*"([^"]+)"/g },
      { name: 'hd_src', regex: /"hd_src"\s*:\s*"([^"]+)"/g },
      { name: 'sd_src', regex: /"sd_src"\s*:\s*"([^"]+)"/g }
    ];

    keyPatterns.forEach(pattern => {
      let match;
      pattern.regex.lastIndex = 0;
      while ((match = pattern.regex.exec(htmlContent)) !== null) {
        let rawUrl = match[1];
        let cleaned = cleanUrl(rawUrl);
        if (isValidVideoUrl(cleaned) && !seenUrls.has(cleaned)) {
          seenUrls.add(cleaned);
          const classification = classifyUrl(cleaned, pattern.name);
          const key = `${classification.type}_${classification.quality}`;
          foundUrls[key] = {
            url: cleaned,
            source: pattern.name,
            ...classification
          };
        }
      }
    });

    // B. Fallback Scan: General CDN search
    const cdnRegex = /https?:(?:\\?\/|\\+\/){2}[a-zA-Z0-9.-]*fbcdn\.net(?:\\?\/|\\+\/)[^\s"'>]+/gi;
    let cdnMatch;

    while ((cdnMatch = cdnRegex.exec(htmlContent)) !== null) {
      let rawUrl = cdnMatch[0];
      let cleaned = cleanUrl(rawUrl);

      if (isValidVideoUrl(cleaned) && !seenUrls.has(cleaned)) {
        seenUrls.add(cleaned);
        const classification = classifyUrl(cleaned, 'General CDN Scan');
        const key = `${classification.type}_${classification.quality}`;

        // Prioritize mp4 over other extensions (like .kf)
        const isMp4 = cleaned.toLowerCase().includes('.mp4');
        const currentUrl = foundUrls[key] ? foundUrls[key].url.toLowerCase() : '';
        const currentIsMp4 = currentUrl.includes('.mp4');

        if (!foundUrls[key] || (isMp4 && !currentIsMp4)) {
          foundUrls[key] = {
            url: cleaned,
            source: 'General CDN Scan',
            ...classification
          };
        }
      }
    }

    return Object.values(foundUrls);
  };

  const extractVideoTitle = (htmlContent) => {
    // 1. og:title
    const ogTitleMatch = htmlContent.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      htmlContent.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      const temp = document.createElement("textarea");
      temp.innerHTML = ogTitleMatch[1];
      return temp.value.trim();
    }

    // 2. HTML Title tag
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const temp = document.createElement("textarea");
      temp.innerHTML = titleMatch[1];
      let t = temp.value.trim();
      // Clean up common suffix
      t = t.replace(/\s*\|\s*Facebook$/i, '');
      return t;
    }

    return `FB Video - ${new Date().toLocaleDateString()}`;
  };

  // --- 4. Main Submission Logic ---
  extractForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const htmlContent = sourceCodeInput.value.trim();
    if (!htmlContent) {
      showToast('Please paste the page source code first.', true);
      return;
    }

    // Reset UI states
    resultCard.style.display = 'none';
    videoPreviewPlayer.src = '';

    // Show loading flow
    loadingOverlay.style.display = 'flex';
    submitBtn.disabled = true;

    // Simulate loader steps for a realistic progress indication
    const stages = [
      { text: 'Analyzing page source HTML structures...', delay: 400 },
      { text: 'Searching for FB video signatures and CDN streams...', delay: 800 },
      { text: 'Decoding and cleaning URL keys...', delay: 1200 },
      { text: 'Finalizing extraction results...', delay: 1500 }
    ];

    stages.forEach((stage, idx) => {
      setTimeout(() => {
        loadingText.textContent = stage.text;
        if (idx === stages.length - 1) {
          // Process extraction
          executeExtraction(htmlContent);
        }
      }, stage.delay);
    });
  });

  const mergeVideoAudio = async (videoUrl, audioUrl, title) => {
    const mergeOverlay = document.getElementById('merge-overlay');
    const mergeText = document.getElementById('merge-text');
    const mergeProgressContainer = document.getElementById('merge-progress-container');
    const mergeProgressFill = document.getElementById('merge-progress-fill');
    
    mergeOverlay.style.display = 'flex';
    mergeProgressContainer.style.display = 'block';
    mergeProgressFill.style.width = '0%';
    
    try {
      if (!window.FFmpegWASM || !window.FFmpegUtil) {
        throw new Error('FFmpeg libraries not loaded.');
      }
      
      const { FFmpeg } = window.FFmpegWASM;
      const { fetchFile } = window.FFmpegUtil;
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('progress', ({ progress }) => {
        mergeText.textContent = 'Merging in browser...';
        mergeProgressFill.style.width = `${Math.round(progress * 100)}%`;
      });
      
      mergeText.textContent = 'Loading FFmpeg Core (this may take a moment)...';
      
      // Since we are running on a local server, we can load the files directly
      // Use absolute path so the worker resolves it correctly
      const coreBase = '/lib/ffmpeg';
      
      await ffmpeg.load({
        coreURL: `${coreBase}/ffmpeg-core.js`,
        wasmURL: `${coreBase}/ffmpeg-core.wasm`
      });
      
      mergeText.textContent = 'Downloading Video & Audio streams into memory...';
      
      // Use our local proxy server to bypass FB CDN CORS restrictions
      const proxyVideoUrl = '/proxy?url=' + encodeURIComponent(videoUrl);
      const proxyAudioUrl = '/proxy?url=' + encodeURIComponent(audioUrl);
      
      const videoData = await fetchFile(proxyVideoUrl);
      const audioData = await fetchFile(proxyAudioUrl);
      
      mergeText.textContent = 'Downloading video stream...';
      await ffmpeg.writeFile('video.mp4', videoData);
      
      mergeText.textContent = 'Downloading audio stream...';
      await ffmpeg.writeFile('audio.m4a', audioData);
      
      mergeText.textContent = 'Merging streams...';
      const ret = await ffmpeg.exec([
        '-i', 'video.mp4',
        '-i', 'audio.m4a',
        '-map', '0:v', // Map video stream from first input
        '-map', '1:a', // Map audio stream from second input
        '-c:v', 'copy', // Copy video as-is
        '-c:a', 'aac',  // Re-encode audio to AAC to ensure MP4/Mac compatibility
        'output.mp4'
      ]);
      
      if (ret !== 0) {
        throw new Error(`FFmpeg exited with code ${ret}`);
      }
      
      mergeText.textContent = 'Finalizing file...';
      const data = await ffmpeg.readFile('output.mp4');
      
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_merged.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      URL.revokeObjectURL(url);
      showToast('Merge and download complete!');
    } catch (err) {
      console.error('Merge failed:', err);
      showToast('Merge failed. This might be due to CORS restrictions or memory limits.', true);
    } finally {
      mergeOverlay.style.display = 'none';
      mergeProgressFill.style.width = '0%';
    }
  };

  const executeExtraction = (htmlContent) => {
    try {
      const results = extractVideoUrls(htmlContent);
      const title = extractVideoTitle(htmlContent);

      loadingOverlay.style.display = 'none';
      submitBtn.disabled = false;

      if (results.length === 0) {
        showToast('No video streams found. Make sure you copied the correct View Page Source code.', true);
        return;
      }

      // Display results card
      resultCard.style.display = 'block';
      resTitle.textContent = title;

      // Select progressive stream with audio for preview if available, otherwise fallback
      const previewSource = results.find(r => r.type === 'video_with_audio') ||
        results.find(r => r.type === 'video_only') ||
        results[0];

      const previewContainer = document.querySelector('.video-preview');
      if (previewSource && previewSource.type !== 'audio_only') {
        previewContainer.style.display = 'flex';
        videoPreviewPlayer.src = previewSource.url;
      } else {
        previewContainer.style.display = 'none';
      }

      // Render Download option boxes
      downloadOptions.innerHTML = '';
      
      // Check if we can merge video + audio
      let bestVideoRes = results.find(r => r.type === 'video_only' && r.quality === 'HD') ||
                         results.find(r => r.type === 'video_with_audio' && r.quality === 'HD') ||
                         results.find(r => r.type === 'video_with_audio') ||
                         results.find(r => r.type === 'video_only');
      let audioRes = results.find(r => r.type === 'audio_only');
      
      if (bestVideoRes && audioRes) {
        const mergeBox = document.createElement('div');
        mergeBox.className = 'download-box';
        mergeBox.style.border = '2px solid var(--accent-blue)';
        mergeBox.style.background = 'rgba(74, 144, 226, 0.05)';
        
        mergeBox.innerHTML = `
          <div class="quality-badge hd" style="background: var(--accent-blue);">
            Merge HD Video + Audio (Recommended)
          </div>
          <div class="download-actions">
            <button type="button" class="action-btn btn-merge" data-video="${bestVideoRes.url}" data-audio="${audioRes.url}" style="background: var(--accent-blue); width: 100%;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Merge & Download Full HD
            </button>
            <span style="font-size: 0.8rem; color: var(--accent-blue); margin-top: -0.25rem; text-align: center; font-weight: 500;">Combines DASH streams in browser</span>
          </div>
        `;
        downloadOptions.appendChild(mergeBox);
        
        mergeBox.querySelector('.btn-merge').addEventListener('click', (e) => {
          const vUrl = e.currentTarget.dataset.video;
          const aUrl = e.currentTarget.dataset.audio;
          mergeVideoAudio(vUrl, aUrl, title);
        });
      }

      results.forEach(res => {
        const dBox = document.createElement('div');
        dBox.className = 'download-box';

        let badgeClass = res.quality.toLowerCase();
        if (res.type === 'audio_only') {
          badgeClass = 'audio';
        }

        let downloadLabel = 'Download video';
        let subText = '';
        if (res.type === 'audio_only') {
          downloadLabel = 'Download audio';
          subText = '<span style="font-size: 0.8rem; color: var(--accent-pink); margin-top: -0.25rem; text-align: center; font-weight: 500;">M4A Audio Format</span>';
        } else if (res.type === 'video_only') {
          downloadLabel = 'Download silent video';
          subText = '<span style="font-size: 0.8rem; color: var(--accent-pink); margin-top: -0.25rem; text-align: center; font-weight: 500;">Silent DASH stream (No Sound)</span>';
        } else {
          subText = '<span style="font-size: 0.8rem; color: var(--accent-teal); margin-top: -0.25rem; text-align: center; font-weight: 500;">Contains both video & sound</span>';
        }

        dBox.innerHTML = `
          <div class="quality-badge ${badgeClass}">
            ${res.label}
          </div>
          <div class="download-actions">
            <a href="${res.url}" target="_blank" rel="noopener noreferrer" download="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${res.type === 'audio_only' ? 'm4a' : 'mp4'}" class="action-btn">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              ${downloadLabel}
            </a>
            ${subText}
            <button type="button" class="action-btn secondary btn-copy" data-url="${res.url}">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0A2.25 2.25 0 0 1 13.5 4.75h-3a2.25 2.25 0 0 1-2.248-2.112m7.332 0c.007.1.008.201.008.303 0 1.25-.978 2.25-2.25 2.25h-3A2.247 2.247 0 0 1 7.5 3c0-.102.001-.202.008-.303M18 9v11.25A2.25 2.25 0 0 1 15.75 22H8.25A2.25 2.25 0 0 1 6 19.75V9M12 18.75V9m-3.75 4.5L12 9.75l3.75 3.75" />
              </svg>
              Copy direct link
            </button>
            <button type="button" class="action-btn secondary btn-help">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              Download instructions
            </button>
          </div>
        `;
        downloadOptions.appendChild(dBox);
      });

      // Bind dynamic button events
      dBoxListeners();

      // Save to local history
      saveToHistory({
        title,
        date: new Date().toLocaleDateString(),
        links: results.map(r => ({ quality: r.quality, url: r.url }))
      });

      // Scroll smoothly to results card
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Extraction successful!');

    } catch (err) {
      console.error(err);
      loadingOverlay.style.display = 'none';
      submitBtn.disabled = false;
      showToast('An unexpected error occurred during extraction.', true);
    }
  };

  const dBoxListeners = () => {
    // Copy URL button listeners
    const copyButtons = downloadOptions.querySelectorAll('.btn-copy');
    copyButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        navigator.clipboard.writeText(url)
          .then(() => showToast('Link copied to clipboard!'))
          .catch(err => {
            console.error('Clipboard write failed:', err);
            showToast('Failed to copy. Please copy the link manually.', true);
          });
      });
    });

    // Help button listeners
    const helpButtons = downloadOptions.querySelectorAll('.btn-help');
    helpButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        helpModal.showModal();
      });
    });
  };

  // --- 5. History Logger (LocalStorage) ---
  const saveToHistory = (item) => {
    let history = JSON.parse(localStorage.getItem('fb_downloader_history')) || [];
    // Remove if already exists (matching titles or link URLs)
    history = history.filter(h => h.title !== item.title);

    // Add to front
    history.unshift(item);

    // Limit to 10 items
    if (history.length > 10) {
      history.pop();
    }

    localStorage.setItem('fb_downloader_history', JSON.stringify(history));
    renderHistory();
  };

  const deleteHistoryItem = (index) => {
    let history = JSON.parse(localStorage.getItem('fb_downloader_history')) || [];
    history.splice(index, 1);
    localStorage.setItem('fb_downloader_history', JSON.stringify(history));
    renderHistory();
    showToast('Deleted history item');
  };

  const renderHistory = () => {
    const history = JSON.parse(localStorage.getItem('fb_downloader_history')) || [];

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history" id="empty-history">No videos extracted yet. Your history is stored locally.</div>';
      return;
    }

    historyList.innerHTML = '';
    history.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

      // Select main link (HD if available)
      const mainLinkObj = item.links.find(l => l.quality === 'HD') || item.links[0];
      const mainUrl = mainLinkObj ? mainLinkObj.url : '#';

      itemEl.innerHTML = `
        <div class="history-info">
          <div class="history-name" title="${item.title}">${item.title}</div>
          <div class="history-date">${item.date} &bull; ${item.links.map(l => l.quality).join(' / ')}</div>
        </div>
        <div class="history-actions">
          <a href="${mainUrl}" target="_blank" rel="noopener noreferrer" class="icon-btn" title="View Stream">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
          </a>
          <button type="button" class="icon-btn btn-history-copy" data-url="${mainUrl}" title="Copy Link">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376A8.965 8.965 0 0 0 12 12.75a8.965 8.965 0 0 0-3.75 3.376m6.15-4.902a3.859 3.859 0 1 1-4.8 0M15.75 2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25V4.5a2.25 2.25 0 0 0-2.25-2.25Z" />
            </svg>
          </button>
          <button type="button" class="icon-btn danger btn-history-delete" data-index="${index}" title="Remove">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.78 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      `;
      historyList.appendChild(itemEl);
    });

    // History copy button logic
    historyList.querySelectorAll('.btn-history-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        navigator.clipboard.writeText(url)
          .then(() => showToast('Link copied to clipboard!'))
          .catch(err => {
            console.error('Clipboard write failed:', err);
            showToast('Failed to copy. Please copy the link manually.', true);
          });
      });
    });

    // History delete button logic
    historyList.querySelectorAll('.btn-history-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        deleteHistoryItem(idx);
      });
    });
  };

  // --- 6. Helper Dialog Modals ---
  // Close buttons
  modalCloseBtn.addEventListener('click', () => helpModal.close());
  modalOkBtn.addEventListener('click', () => helpModal.close());

  disclaimerCloseBtn.addEventListener('click', () => disclaimerModal.close());
  disclaimerOkBtn.addEventListener('click', () => disclaimerModal.close());

  disclaimerLink.addEventListener('click', (e) => {
    e.preventDefault();
    disclaimerModal.showModal();
  });

  // Light dismiss modals (clicking on the backdrop)
  helpModal.addEventListener('click', (e) => {
    const rect = helpModal.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      helpModal.close();
    }
  });

  disclaimerModal.addEventListener('click', (e) => {
    const rect = disclaimerModal.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      disclaimerModal.close();
    }
  });

  // --- 7. Toast Notification Handler ---
  let toastTimeout;
  const showToast = (message, isError = false) => {
    clearTimeout(toastTimeout);
    toast.textContent = message;

    // Customize toast coloring based on success/error
    if (isError) {
      toast.style.background = 'var(--accent-error)';
    } else {
      toast.style.background = 'var(--accent-success)';
    }

    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  };

  // Initial Runs
  renderHistory();
});
