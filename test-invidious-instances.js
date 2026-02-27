import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://api.invidious.io/instances.json');
    const data = await res.json();
    const instances = data.map(i => i[1].uri);
    console.log(`Found ${instances.length} instances`);
    
    let working = 0;
    for (const uri of instances.slice(0, 15)) {
      try {
        const r = await fetch(`${uri}/api/v1/videos/jNQXAC9IVRw`, { timeout: 3000 });
        if (r.ok) {
          const d = await r.json();
          console.log(`Working: ${uri}`);
          working++;
        }
      } catch (e) {
        // ignore
      }
    }
    console.log(`Working instances: ${working}`);
  } catch (e) {
    console.error(e);
  }
}
test();
