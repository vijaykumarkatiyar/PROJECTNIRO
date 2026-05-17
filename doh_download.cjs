const https = require('https');
const fs = require('fs');

function fetchWithDoH(urlStr, outfile) {
  const parsed = new URL(urlStr);
  const hostname = parsed.hostname;
  
  console.log('Resolving:', hostname);
  https.get(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, { headers: { 'accept': 'application/dns-json' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const ipObj = json.Answer && json.Answer.find(a => a.type === 1);
        if (!ipObj) {
           console.log("No A record found:", json);
           return;
        }
        const ip = ipObj.data;
        console.log(`Resolved ${hostname} -> ${ip}`);
        
        const options = {
          hostname: ip, port: 443, path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: { 'Host': hostname, 'User-Agent': 'Mozilla/5.0' },
          servername: hostname
        };
        
        https.get(options, (res2) => {
          console.log(`Status for ${urlStr}: ${res2.statusCode}`);
          if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
             let red = res2.headers.location;
             if (!red.startsWith('http')) red = `https://${hostname}${red}`;
             console.log('Following redirect to:', red);
             fetchWithDoH(red, outfile);
          } else {
             res2.pipe(outfile);
             outfile.on('finish', () => {
                 console.log('Successfully written to disk!');
                 process.exit(0);
             });
          }
        }).on('error', console.error);
      } catch(e) {
        console.error(e, data);
      }
    });
  }).on('error', console.error);
}

fetchWithDoH('https://models.readyplayer.me/64b55c562506b3a010d80766.glb', fs.createWriteStream('public/girl.glb'));
