import fetch from 'node-fetch';

async function test() {
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.nerdvpn.de',
    'https://invidious.slipfox.xyz',
    'https://iv.melmac.space'
  ];
  
  const videoId = 'jNQXAC9IVRw'; // Me at the zoo
  
  for (const instance of instances) {
    try {
      console.log(`Testing ${instance}...`);
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Success with ${instance}! Title: ${data.title}`);
        return;
      } else {
        console.log(`Failed ${instance}: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      console.log(`Error ${instance}:`, e.message);
    }
  }
}

test();
