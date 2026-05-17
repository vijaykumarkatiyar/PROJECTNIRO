const https = require('https');
const fs = require('fs');

const url = 'https://d1a370nemizbjq.cloudfront.net/2eebf1d2-00ab-4c31-89b1-5e7bc5a297b8.glb';

https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  if (res.statusCode === 200) {
    const file = fs.createWriteStream('public/girl.glb');
    res.pipe(file);
    file.on('finish', () => {
      console.log('Downloaded successfully');
      file.close();
    });
  }
}).on('error', (e) => {
  console.error(e);
});
