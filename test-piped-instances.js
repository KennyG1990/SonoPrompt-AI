import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/TeamPiped/Piped/refs/heads/main/public/instances.json');
    const text = await res.text();
    const data = JSON.parse(text);
    const instances = data.map(i => i.api_url);
    console.log(`Found ${instances.length} instances`);
    
    let working = 0;
    for (const uri of instances.slice(0, 15)) {
      try {
        const r = await fetch(`${uri}/streams/jNQXAC9IVRw`, { timeout: 3000 });
        if (r.ok) {
          const d = await r.json();
          if (!d.error) {
            console.log(`Working: ${uri}`);
            working++;
          }
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
