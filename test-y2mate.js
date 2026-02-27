import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://v6.www-y2mate.com/mates/en941/analyze/ajax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0'
      },
      body: 'url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DjNQXAC9IVRw&q_auto=1&ajax=1'
    });
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
