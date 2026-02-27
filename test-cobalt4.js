import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://api.cobalt.tools', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        isAudioOnly: true
      })
    });
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
