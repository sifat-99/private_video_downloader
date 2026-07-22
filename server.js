const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static('.'));

// Setup CORS proxy endpoint for downloading Facebook videos
app.use('/proxy', createProxyMiddleware({
  target: 'http://placeholder.com', // Required by http-proxy-middleware, overridden by router
  router: (req) => {
    // dynamically route to the origin of the target URL
    const targetUrl = new URL(req.query.url);
    return targetUrl.origin;
  },
  pathRewrite: (path, req) => {
    // rewrite the path to the target URL's path and query
    const targetUrl = new URL(req.query.url);
    return targetUrl.pathname + targetUrl.search;
  },
  changeOrigin: true,
  onProxyRes: (proxyRes, req, res) => {
    // Inject CORS headers so the browser allows the fetch
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = '*';
  }
}));

app.listen(port, () => {
  console.log(`\n==========================================`);
  console.log(`  🚀 Proxy Server is running!`);
  console.log(`  👉 http://localhost:${port}`);
  console.log(`==========================================\n`);
  console.log(`Stop npx serve and keep this terminal open!`);
});
