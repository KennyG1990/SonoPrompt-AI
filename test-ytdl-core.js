import ytdl from 'ytdl-core';

async function test() {
  try {
    const info = await ytdl.getInfo('jNQXAC9IVRw');
    console.log(info.videoDetails.title);
  } catch (e) {
    console.error(e.message);
  }
}
test();
