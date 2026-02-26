import youtubedl from 'youtube-dl-exec';

async function test() {
  try {
    const output = await youtubedl('--version');
    console.log(output);
  } catch (e) {
    console.error(e);
  }
}
test();
