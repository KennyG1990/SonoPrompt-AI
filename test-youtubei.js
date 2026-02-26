import { Innertube, UniversalCache } from 'youtubei.js';

async function test() {
  try {
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getBasicInfo('jNQXAC9IVRw');
    console.log(info.basic_info.title);
    
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    console.log(format.url);
  } catch (e) {
    console.error(e);
  }
}
test();
