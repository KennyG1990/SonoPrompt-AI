import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://api.vevioz.com/api/button/mp3/jNQXAC9IVRw');
    const text = await res.text();
    console.log(res.status, text.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}
test();
