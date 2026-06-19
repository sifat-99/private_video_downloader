# FB Private Video Downloader 🎥🔒

A premium, modern, and **100% client-side** web tool designed to extract and download private Facebook videos using the page source code. Because all processing happens directly within your browser, no source code, video links, or personal data are ever sent to external servers—ensuring absolute privacy and security.

---

## ✨ Features

- **🔒 100% Client-Side & Private**: No backend, database, or external APIs. All parsing is done locally in your browser using JavaScript.
- **⚡ High & Standard Definition Extraction**: Automatically scans and extracts HD, SD, silent video, and high-quality audio-only streams from the pasted source code.
- **📺 Live Video Preview**: Built-in preview player to verify and watch the extracted stream before downloading.
- **📜 Local Extraction History**: Automatically caches your last 10 successful extractions in the browser's `localStorage` for quick access.
- **🎨 Modern Responsive UI**: A premium user interface featuring a dark glassmorphic design, smooth animations, customized scrollbars, and Outfit typography.
- **📂 Step-by-Step Instructions**: Tabbed guide with clear instructions for Chrome/Edge, Firefox, and Safari (Mac).
- **📋 Clipboard Helpers**: Quick "Paste" and "Clear" utility buttons to easily manage the page source.

---

## 🛠️ Technology Stack

- **Markup**: Semantic HTML5 (including `<dialog>` for native modals).
- **Styles**: Custom CSS3 utilizing modern variables, flex/grid layouts, customized scrollbars, and premium glassmorphic UI components.
- **Fonts**: Outfit (from Google Fonts).
- **Logic**: Vanilla ES6+ JavaScript.
- **Parsing Engine**: Fast regular-expression pattern matching combined with Base64 parameter decoding (`efg` parameter parsing) to identify stream qualities.

---

## 🚀 How to Run Locally

Since this is a fully static website, running it is incredibly simple:

1. Clone the repository:
   ```bash
   git clone https://github.com/sifat-99/private_video_downloader.git
   cd private_video_downloader
   ```
2. Open `index.html` directly in your favorite web browser:
   - Double-click `index.html` in your file manager, or
   - Run a simple local server in the project folder:
     ```bash
     # Python 3
     python3 -m http.server 8000
     
     # Node.js (npx)
     npx serve
     ```
3. Open `http://localhost:8000` (or the respective port) in your browser.

---

## 🌐 Deployment

You can host this tool for free on any static web hosting service:
- **GitHub Pages** (Highly recommended, as it supports instant deployment from the main branch)
- **Netlify**
- **Vercel**
- **Firebase Hosting**

---

## 🔍 How it Works (Under the Hood)

Facebook encodes video streams within the HTML source of the video page. This tool parses the raw source code of the page by doing the following:

1. **Regex Scanning**: Looks for specific keys inside script tags such as `playable_url`, `playable_url_quality_hd`, `browser_native_hd_url`, `browser_native_sd_url`, `hd_src`, and `sd_src`.
2. **CDN Extraction**: Runs a fallback scanner to find all `fbcdn.net` URL patterns.
3. **Decryption & Classification**:
   - Decodes Unicode/escaped sequences.
   - Extracts the Base64-encoded `efg` query parameter from the stream URLs.
   - Parses the internal JSON payload inside `efg` (checking for `vencode_tag` values like `audio`, `progressive`, or specific video resolutions) to determine the exact media quality (HD, SD, or Audio Only).
4. **Local History**: Uses `localStorage` to persist previous extractions securely in your client environment.

---

## ⚖️ Disclaimer

This web application acts solely as a client-side parser to assist users in extracting direct media links from the HTML page source of Facebook video pages they already have access to. 

We do not store, copy, host, or share any video files, page sources, or user data. You are solely responsible for ensuring you have the legal right to download and access the media content you extract, in compliance with Facebook's Terms of Service and the copyright laws in your jurisdiction.
