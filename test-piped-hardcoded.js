import fetch from 'node-fetch';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.us.projectsegfau.lt',
  'https://pipedapi.lunar.icu',
  'https://pipedapi.smnz.de',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.qdi.fi',
  'https://pipedapi.astartes.nl',
  'https://pipedapi.drgns.space',
  'https://pipedapi.r4fo.com'
];

async function test() {
  let working = 0;
  for (const uri of PIPED_INSTANCES) {
    try {
      const r = await fetch(`${uri}/streams/jNQXAC9IVRw`, { timeout: 5000 });
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
}
test();
