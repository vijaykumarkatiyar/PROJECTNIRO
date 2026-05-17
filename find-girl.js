const https = require('https');

const candidates = [
  'https://raw.githubusercontent.com/pmndrs/react-three-fiber/master/docs/tutorials/stacy.glb',
  'https://raw.githubusercontent.com/pmndrs/drei/master/.storybook/public/stacy.glb',
  'https://raw.githubusercontent.com/pmndrs/gltfjsx/master/public/stacy.glb',
  'https://models.readyplayer.me/64b55c562506b3a010d80766.glb',
  'https://models.readyplayer.me/65aac0858ce1ba3856b3e647.glb',
  'https://models.readyplayer.me/64a6d1a931a1a5b820980562.glb',
  'https://models.readyplayer.me/64b4cdea2506b3a010cfaaba.glb',
  'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb'
];

async function checkURL(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 301) {
        resolve(url);
      } else {
        resolve(null);
      }
    }).on('error', () => resolve(null));
  });
}

(async () => {
  for (let url of candidates) {
    const valid = await checkURL(url);
    if (valid) {
      console.log("FOUND:", valid);
      return;
    }
  }
  console.log("NONE FOUND");
})();
