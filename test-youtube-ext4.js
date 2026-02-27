import yt from 'youtube-ext';

async function test() {
  try {
    const info = await yt.videoInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log(Object.keys(info));
  } catch (e) {
    console.error(e);
  }
}
test();
