import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://api.sonauto.ai/v1/generations/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const text = await res.text();
    console.log(res.status, text);
  } catch (e) {
    console.error(e);
  }
}
test();
