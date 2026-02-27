import youtubedl from 'youtube-dl-exec';

async function test() {
  try {
    const info = await youtubedl('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      extractorArgs: 'youtube:player_client=tv'
    });
    console.log(info.title);
  } catch (e) {
    console.error(e.message);
  }
}
test();
