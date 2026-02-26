import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://instances.cobalt.tools/instances.json');
    const data = await res.json();
    console.log(data.slice(0, 5));
  } catch (e) {
    console.error(e);
  }
}
test();
