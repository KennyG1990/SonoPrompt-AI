import yt from 'youtube-ext';

async function test() {
  try {
    console.log(Object.keys(yt));
  } catch (e) {
    console.error(e);
  }
}
test();
