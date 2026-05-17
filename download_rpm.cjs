const https = require('https');
const dns = require('dns');
const fs = require('fs');

dns.setServers(['8.8.8.8', '8.8.4.4']);

dns.resolve4('models.readyplayer.me', (err, addresses) => {
  if (err) {
    console.error('DNS Error:', err);
    return;
  }
  
  const ip = addresses[0];
  console.log('Resolved models.readyplayer.me ->', ip);
  
  const options = {
    hostname: ip,
    port: 443,
    path: '/64b55c562506b3a010d80766.glb',
    method: 'GET',
    headers: {
      'Host': 'models.readyplayer.me',
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*'
    },
    servername: 'models.readyplayer.me'
  };

  const file = fs.createWriteStream('public/girl.glb');

  https.get(options, (res) => {
    console.log('Main Status:', res.statusCode);
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      // Redirects for RPM usually go to a CloudFront or similar static URL.
      // We'll try to resolve the redirect host explicitly too.
      const redirectUrl = new URL(res.headers.location);
      dns.resolve4(redirectUrl.hostname, (err2, addrs2) => {
        if (err2 || !addrs2.length) {
          console.log("Fallback to native https for redirect...");
          https.get(res.headers.location, r2 => {
            r2.pipe(file);
            r2.on('end', () => console.log('Done fallback download'));
          });
          return;
        }
        const rId = addrs2[0];
        const rOpts = {
          hostname: rId,
          port: 443,
          path: redirectUrl.pathname + redirectUrl.search,
          method: 'GET',
          headers: {
            'Host': redirectUrl.hostname,
            'User-Agent': 'Mozilla/5.0'
          },
          servername: redirectUrl.hostname
        };
        https.get(rOpts, (r2) => {
          console.log("Redirect Status:", r2.statusCode);
          r2.pipe(file);
          r2.on('end', () => console.log('Done redirect download'));
        });
      });
    } else {
      res.pipe(file);
      res.on('end', () => console.log('Done direct download'));
    }
  }).on('error', console.error);
});
