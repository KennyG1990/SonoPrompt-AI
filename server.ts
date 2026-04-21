import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Readable } from 'stream';
import { google } from 'googleapis';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

  // Public Invidious API instances that act as proxies to bypass YouTube's datacenter blocks
  const INVIDIOUS_INSTANCES = [
    'https://vid.puffyan.us',
    'https://invidious.nerdvpn.de',
    'https://invidious.slipfox.xyz',
    'https://iv.melmac.space',
    'https://yewtu.be',
    'https://invidious.fdn.fr'
  ];

  function extractVideoId(url: string) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : null;
  }

  async function getInvidiousInfo(videoId: string) {
    let lastError;
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(`${instance}/api/v1/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return { data, instance };
        }
      } catch (e: any) {
        lastError = e;
        console.error(`Failed Invidious instance ${instance}:`, e.message);
      }
    }
    throw new Error(`All Invidious instances failed. Last error: ${lastError?.message}`);
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
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          return res.json({
            title: oembedData.title,
            thumbnail: oembedData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            author: oembedData.author_name,
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
      });
    } catch (error: any) {
      console.error('YouTube info error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch video info' });
    }
  });

  app.get('/api/youtube/download', async (req, res) => {
    try {
      const url = req.query.url as string;
      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).send('Invalid YouTube URL');
      }

      try {
        const { stream } = require('play-dl');
        const audioStream = await stream(url, { discordPlayerCompatibility: true });
        
        res.header('Content-Disposition', `attachment; filename="${videoId}.webm"`);
        res.header('Content-Type', 'audio/webm');
        
        audioStream.stream.pipe(res);
        return;
      } catch (err) {
        console.warn('play-dl failed, falling back to Invidious', err);
      }
      
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

      const title = (info.title || 'audio').replace(/[^\w\s-]/gi, '_');
      const extension = bestAudio.type.includes('mp4') ? 'm4a' : 'webm';

      res.header('Content-Disposition', `attachment; filename="${title}.${extension}"`);
      res.header('Content-Type', bestAudio.type.split(';')[0]);

      // Invidious stream URLs might be relative or absolute
      const streamUrl = bestAudio.url.startsWith('http') ? bestAudio.url : `${instance}${bestAudio.url}`;

      const streamRes = await fetch(streamUrl);
      if (!streamRes.ok || !streamRes.body) {
        throw new Error('Failed to fetch audio stream from proxy');
      }

      if (typeof Readable.fromWeb === 'function') {
        Readable.fromWeb(streamRes.body as any).pipe(res);
      } else {
        const arrayBuffer = await streamRes.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }

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

      const data = await response.json();
      res.json(data);
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

      const data = await response.json();
      res.json(data);
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

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('OpenRouter proxy error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate via OpenRouter' });
    }
  });

  app.get('/api/openrouter/models', async (req, res) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch OpenRouter models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
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
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
