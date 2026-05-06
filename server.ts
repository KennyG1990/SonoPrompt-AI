import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Readable } from 'stream';
import { google } from 'googleapis';
import multer from 'multer';
import * as playdl from 'play-dl';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini on server
let genAI: any = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const upload = multer({ storage: multer.memoryStorage() });

import { Innertube } from 'youtubei.js';
import ytdl from '@distube/ytdl-core';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Initialize youtubei as a singleton if possible
  let yt: any = null;
  const getYt = async () => {
    if (!yt) {
      // Initialize Innertube without specific client_type to avoid type errors
      yt = await Innertube.create();
    }
    return yt;
  };

  app.use(express.json());

  // Gemini Proxy
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
      }

      if (!genAI) {
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      }

      const response = await genAI.models.generateContent({ 
        model: model || 'gemini-3-flash-preview',
        contents,
        config
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      geminiKeySet: !!process.env.GEMINI_API_KEY,
      geminiKeyLength: process.env.GEMINI_API_KEY?.length || 0
    });
  });

  app.get('/api/auth/youtube/url', (req, res) => {
    const redirectUri = req.query.redirect_uri as string;
    if (!redirectUri) {
      return res.status(400).json({ error: 'Missing redirect_uri' });
    }
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload']
    });

    res.json({ url });
  });

  app.get(['/api/auth/youtube/callback', '/api/auth/youtube/callback/'], async (req, res) => {
    const { code } = req.query;
    // We need to reconstruct the redirect URI to match what was sent
    // The easiest way is to use the same origin
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/youtube/callback`;
    
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        redirectUri
      );
      
      const { tokens } = await oauth2Client.getToken(code as string);
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('YouTube auth callback error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.post('/api/youtube/upload', upload.single('video'), async (req, res) => {
    try {
      const { title, description, tokens } = req.body;
      const videoFile = req.file;

      if (!videoFile || !tokens) {
        return res.status(400).json({ error: 'Missing video or tokens' });
      }

      const parsedTokens = JSON.parse(tokens);

      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET
      );
      oauth2Client.setCredentials(parsedTokens);

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const videoStream = new Readable();
      videoStream.push(videoFile.buffer);
      videoStream.push(null);

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus: 'private',
          },
        },
        media: {
          body: videoStream,
        },
      });

      res.json({ success: true, videoId: response.data.id });
    } catch (error: any) {
      console.error('YouTube upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  // Public Invidious API instances
  const INVIDIOUS_INSTANCES = [
    'https://yewtu.be',
    'https://vid.puffyan.us',
    'https://invidious.ducks.party',
    'https://invidious.lunar.icu',
    'https://inv.vern.cc',
    'https://invidious.io.lol',
    'https://invidious.flokinet.to',
    'https://invidious.projectsegfau.lt',
    'https://invidious.slipfox.xyz',
    'https://iv.n0p49.com',
    'https://invidious.asir.dev',
    'https://iv.melmac.space',
    'https://invidious.nerdvpn.de',
    'https://inv.pistasj.net',
    'https://invidious.namazso.eu',
    'https://inv.tux.digital'
  ];

  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://piped-api.lunar.icu',
    'https://pipedapi.adminforge.de',
    'https://api-piped.mha.fi',
    'https://piped-api.garudalinux.org',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.official-esc.fr',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.drgns.space',
    'https://pipedapi.quantumsheep.io',
    'https://pipedapi.rivo.org',
    'https://pipedapi.suyu.sh',
    'https://pipedapi.astartes.nl'
  ];

  function extractVideoId(url: string) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : null;
  }

  async function getInvidiousInfo(videoId: string) {
    let lastError;
    // Fisher-Yates shuffle instances to avoid hitting the same one first every time
    const shuffled = [...INVIDIOUS_INSTANCES].sort(() => Math.random() - 0.5);
    
    for (const instance of shuffled) {
      try {
        const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error);
            return { data, instance };
          } catch (parseError) {
             console.error(`Invidious ${instance} JSON parse error:`, parseError);
          }
        }
      } catch (e: any) {
        lastError = e;
        console.error(`Failed Invidious instance ${instance}:`, e.message);
      }
    }
    throw new Error(`All Invidious instances failed. Last error: ${lastError?.message}`);
  }

  async function getCobaltAudio(videoUrl: string) {
    // List of reliable Cobalt instances
    const cobaltInstances = [
      'https://api.cobalt.tools', 
      'https://cobalt.hyonsu.com',
      'https://api.cobalttm.site',
      'https://cobalt.api.vve.moe',
      'https://api.cobalt.best',
      'https://api.cobalt.moe',
      'https://api.cobalt.run',
      'https://cobalt.shrubbyapp.com'
    ];
    
    for (const apiBase of cobaltInstances) {
      try {
        const res = await fetch(apiBase, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            url: videoUrl,
            downloadMode: 'audio',
            audioFormat: 'mp3',
            isAudioOnly: true
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.url || data.status === 'redirect' || data.status === 'stream') return data.url;
        }
      } catch (e: any) {
        // Quietly log failure unless it's a critical error
        if (process.env.DEBUG === 'true') {
           console.error(`Cobalt instance ${apiBase} unavailable.`);
        }
      }
    }
    return null;
  }

  async function getPipedAudio(videoId: string) {
    const shuffled = [...PIPED_INSTANCES].sort(() => Math.random() - 0.5);
    for (const instance of shuffled) {
      try {
        const res = await fetch(`${instance}/streams/${videoId}`, {
          signal: AbortSignal.timeout(8000),
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.audioStreams && data.audioStreams.length > 0) {
            const best = data.audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            return { 
              url: best.url, 
              title: data.title, 
              mimeType: best.mimeType || 'audio/mpeg',
              author: data.uploader || 'YouTube Artist'
            };
          }
        }
      } catch (e: any) {}
    }

    // Try Cobalt as a stream source provider
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const cobaltUrl = await getCobaltAudio(url);
      if (cobaltUrl) {
        return {
          url: cobaltUrl,
          title: 'YouTube Stream',
          mimeType: 'audio/mpeg',
          author: 'YouTube'
        };
      }
    } catch (e) {}

    return null;
  }

  app.get('/api/youtube/info', async (req, res) => {
    try {
      const url = req.query.url as string;
      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }
      
      // Attempt 1: Fetch from official oEmbed for metadata (more reliable than Invidious instances)
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok && oembedRes.headers.get('content-type')?.includes('application/json')) {
          const oembedData = await oembedRes.json();
          // We also try to get a working stream URL from Piped for the "Recorder"
          const pipedInfo = await getPipedAudio(videoId);
          
          return res.json({
            title: pipedInfo?.title || oembedData.title,
            thumbnail: oembedData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            author: pipedInfo?.author || oembedData.author_name,
            streamUrl: pipedInfo?.url || null
          });
        }
      } catch (e) {
        console.warn('oEmbed fetch failed, falling back to Invidious', e);
      }

      const { data: info } = await getInvidiousInfo(videoId);
      
      res.json({
        title: info.title,
        thumbnail: info.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        author: info.author,
        streamUrl: null
      });
    } catch (error: any) {
      console.error('YouTube info error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch video info' });
    }
  });

  app.get('/api/youtube/stream-proxy', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).send('No URL');
      
      const fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com'
        }
      });
      
      if (!fetchRes.ok) throw new Error(`Proxy target failed: ${fetchRes.status}`);
      
      res.setHeader('Content-Type', fetchRes.headers.get('Content-Type') || 'audio/mpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      
      if (fetchRes.body) {
        const nodeResBody = fetchRes.body as any;
        if (nodeResBody.pipe) {
           nodeResBody.pipe(res);
        } else {
           const reader = fetchRes.body.getReader();
           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             res.write(Buffer.from(value));
           }
           res.end();
        }
      }
    } catch (err: any) {
      console.error('Stream Proxy Error:', err.message);
      res.status(500).send('Proxy error');
    }
  });

  app.get('/api/youtube/download', async (req, res) => {
    try {
      const url = req.query.url as string;
      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).send('Invalid YouTube URL');
      }

      // Metadata fetch for filename
      let title = videoId;
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok && oembedRes.headers.get('content-type')?.includes('application/json')) {
           const oData = await oembedRes.json();
           title = oData.title || videoId;
        }
      } catch (e) {}
      const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-');

      // Attempt 1: Piped Audio (Server-side bypass)
      try {
        const pipedInfo = await getPipedAudio(videoId);
        if (pipedInfo && pipedInfo.url) {
          const pipedStreamRes = await fetch(pipedInfo.url, {
             headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
               'Range': 'bytes=0-'
             }
          });
          if (pipedStreamRes.ok && pipedStreamRes.body) {
            const ext = pipedInfo.mimeType.includes('mpeg') ? 'mp3' : (pipedInfo.mimeType.includes('opus') ? 'webm' : 'm4a');
            res.header('Content-Type', pipedInfo.mimeType || 'audio/mpeg');
            res.header('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
            
            if (typeof Readable.fromWeb === 'function') {
              Readable.fromWeb(pipedStreamRes.body as any).pipe(res);
            } else {
              const arrayBuffer = await pipedStreamRes.arrayBuffer();
              res.send(Buffer.from(arrayBuffer));
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Piped fallback triggered');
      }

      // Attempt 2: Cobalt API (High reliability, bypasses blocks)
      try {
        const cobaltUrl = await getCobaltAudio(url);
        if (cobaltUrl) {
          const cobaltRes = await fetch(cobaltUrl, { signal: AbortSignal.timeout(15000) });
          if (cobaltRes.ok && cobaltRes.body) {
            res.header('Content-Disposition', `attachment; filename="${videoId}.mp3"`);
            res.header('Content-Type', 'audio/mpeg');
            
            if (typeof Readable.fromWeb === 'function') {
              Readable.fromWeb(cobaltRes.body as any).pipe(res);
            } else {
              const arrayBuffer = await cobaltRes.arrayBuffer();
              res.send(Buffer.from(arrayBuffer));
            }
            return;
          }
        }
      } catch (err) {
        // Quietly fallback
      }

      // Attempt 2: youtubei.js (Very robust, mimics browser)
      try {
        const ytInstance = await getYt();
        const stream = await ytInstance.download(videoId, {
            type: 'audio',
            quality: 'best',
            format: 'mp4'
        });
        
        res.header('Content-Disposition', `attachment; filename="${videoId}.m4a"`);
        res.header('Content-Type', 'audio/mp4');
        
        // youtubei.js returns a ReadableStream or a node stream
        if (stream.pipe) {
            stream.pipe(res);
        } else {
            Readable.from(stream).pipe(res);
        }
        return;
      } catch (err) {
        // Quietly fallback
      }

      // Attempt 3: @distube/ytdl-core (Another robust alternative)
      try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) {
          const ytdlRes = await fetch(format.url);
          if (ytdlRes.ok && ytdlRes.body) {
            const ext = format.container || 'm4a';
            const safeTitle = (info.videoDetails.title || videoId).replace(/[^\w\s-]/gi, '_');
            res.header('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
            res.header('Content-Type', format.mimeType || 'audio/mp4');

            if (typeof Readable.fromWeb === 'function') {
              Readable.fromWeb(ytdlRes.body as any).pipe(res);
            } else {
              const arrayBuffer = await ytdlRes.arrayBuffer();
              res.send(Buffer.from(arrayBuffer));
            }
            return;
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Sign in') || err.message?.includes('LOGIN_REQUIRED')) {
           // This is a known limitation of datacenter IPs
        } else {
           console.warn('@distube/ytdl-core fallback engaged.');
        }
      }

      // Attempt 4: Piped API (Reliable fallback)
      try {
        const pipedInfo = await getPipedAudio(videoId);
        if (pipedInfo) {
          const pipedRes = await fetch(pipedInfo.url);
          if (pipedRes.ok && pipedRes.body) {
            const ext = pipedInfo.mimeType.includes('mp4') ? 'm4a' : 'webm';
            const safeTitle = (pipedInfo.title || videoId).replace(/[^\w\s-]/gi, '_');
            res.header('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
            res.header('Content-Type', pipedInfo.mimeType);
            
            if (typeof Readable.fromWeb === 'function') {
              Readable.fromWeb(pipedRes.body as any).pipe(res);
            } else {
              const arrayBuffer = await pipedRes.arrayBuffer();
              res.send(Buffer.from(arrayBuffer));
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Piped download failed, falling back', err);
      }

      // Attempt 5: play-dl
      try {
        const audioStream = await playdl.stream(url, { discordPlayerCompatibility: true });
        
        res.header('Content-Disposition', `attachment; filename="${videoId}.webm"`);
        res.header('Content-Type', 'audio/webm');
        
        audioStream.stream.pipe(res);
        return;
      } catch (err) {
        console.warn('play-dl failed, falling back to Invidious', err);
      }
      
      // Attempt 6: Invidious Proxying
      const { data: info, instance } = await getInvidiousInfo(videoId);
      
      const audioStreams = info.adaptiveFormats?.filter((f: any) => f.type.startsWith('audio/')) || [];
      if (!audioStreams.length) {
        throw new Error('No audio streams found for this video');
      }

      // Prefer m4a (audio/mp4) as it's highly compatible, then webm
      let bestAudio = audioStreams.find((s: any) => s.type.includes('audio/mp4'));
      if (!bestAudio) {
        bestAudio = audioStreams[0];
      }

      // Try local proxying via Invidious instance (bypasses our datacenter IP block)
      const streamUrl = `${instance}/latest_version?id=${videoId}&itag=${bestAudio.itag}&local=true`;
      
      const streamRes = await fetch(streamUrl);
      if (streamRes.ok && streamRes.body) {
        const title = (info.title || 'audio').replace(/[^\w\s-]/gi, '_');
        const extension = bestAudio.type.includes('mp4') ? 'm4a' : 'webm';
        res.header('Content-Disposition', `attachment; filename="${title}.${extension}"`);
        res.header('Content-Type', bestAudio.type.split(';')[0]);
        
        if (typeof Readable.fromWeb === 'function') {
          Readable.fromWeb(streamRes.body as any).pipe(res);
        } else {
          const arrayBuffer = await streamRes.arrayBuffer();
          res.send(Buffer.from(arrayBuffer));
        }
        return;
      }

      // Fallback: Direct Fetch (Likely to fail with 403 in many regions, but worth a try as last resort)
      const directUrl = bestAudio.url.startsWith('http') ? bestAudio.url : `${instance}${bestAudio.url}`;
      const directRes = await fetch(directUrl);
      if (directRes.ok && directRes.body) {
        if (typeof Readable.fromWeb === 'function') {
          Readable.fromWeb(directRes.body as any).pipe(res);
        } else {
          const arrayBuffer = await directRes.arrayBuffer();
          res.send(Buffer.from(arrayBuffer));
        }
        return;
      }

      throw new Error('Failed to fetch audio stream from all possible Sources');

    } catch (error: any) {
      console.error('YouTube download error:', error);
      res.status(500).send(error.message || 'Failed to download audio');
    }
  });

  app.post('/api/sonauto/generate', async (req, res) => {
    try {
      const { prompt, lyrics, tags } = req.body;
      const apiKey = process.env.SONAUTO_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'SONAUTO_API_KEY is not configured in environment variables.' });
      }

      let parsedTags: string[] = [];
      if (tags) {
        if (tags.includes(',')) {
          parsedTags = tags.split(',');
        } else {
          parsedTags = tags.split(/\s+/);
        }
        parsedTags = parsedTags
          .map((t: string) => t.trim().replace(/[^a-zA-Z0-9 ]/g, ''))
          .filter((t: string) => t.length > 0 && t.length <= 20)
          .slice(0, 5);
      }

      // Sonauto has a strict whitelist for tags. To avoid validation errors,
      // we append the style tags to the prompt and send an empty tags array.
      const finalPrompt = parsedTags.length > 0 
        ? `${prompt || ''}\n\nStyle: ${parsedTags.join(', ')}`
        : (prompt || '');

      const response = await fetch('https://api.sonauto.ai/v1/generations/v3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: finalPrompt.trim(),
          lyrics: lyrics || '',
          output_format: 'mp3'
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Sonauto API error: ${text}`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        throw new Error(`Sonauto returned non-JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.error('Sonauto generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate song' });
    }
  });

  app.get('/api/sonauto/status/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const apiKey = process.env.SONAUTO_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'SONAUTO_API_KEY is not configured.' });
      }

      const response = await fetch(`https://api.sonauto.ai/v1/generations/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Sonauto API error: ${text}`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        throw new Error(`Sonauto returned non-JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.error('Sonauto status error:', error);
      res.status(500).json({ error: error.message || 'Failed to check status' });
    }
  });

  // OpenRouter Proxy
  app.post('/api/openrouter/generate', async (req, res) => {
    try {
      const { prompt, model, apiKey: userApiKey } = req.body;
      const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenRouter API Key is required. Please provide it in settings or environment.' });
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://ai.studio',
          'X-Title': 'SonoPrompt AI'
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter API error: ${text}`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        throw new Error(`OpenRouter returned non-JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.error('OpenRouter proxy error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate via OpenRouter' });
    }
  });

  app.get('/api/openrouter/models', async (req, res) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.status(response.status || 500).json({ error: `Failed to fetch OpenRouter models: ${text.substring(0, 100)}` });
      }
    } catch (error: any) {
      console.error('Failed to fetch OpenRouter models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
});
