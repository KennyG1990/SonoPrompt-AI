import yt from 'youtube-ext';

async function test() {
  try {
    const formats = await yt.getFormats('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log(formats.length);
    const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
    console.log(audioFormats.length);
    if (audioFormats.length > 0) {
      console.log(audioFormats[0].url);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
