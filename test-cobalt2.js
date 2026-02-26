import fetch from 'node-fetch';

async function test() {
  const instances = [
    'https://api.cobalt.tools',
    'https://co.wuk.sh',
    'https://cobalt.q0.o.lencr.org',
    'https://cobalt-api.kwiatekmateusz.pl',
    'https://cobalt.tools'
  ];
  
  for (const instance of instances) {
    try {
      const res = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
          downloadMode: 'audio',
          audioFormat: 'mp3'
        })
      });
      const text = await res.text();
      console.log(`${instance}: ${res.status} ${text}`);
    } catch (e) {
      console.log(`${instance}: ${e.message}`);
    }
  }
}
test();
