import yt from 'youtube-ext';

async function test() {
  try {
    const streamInfo = await yt.extractStreamInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log(Object.keys(streamInfo));
    console.log(streamInfo.formats.length);
  } catch (e) {
    console.error(e);
  }
}
test();
