import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type SongInput = { type: 'file'; file: File } | { type: 'link'; link: string };

async function getFileBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeAudioFile(file: File): Promise<string> {
  const base64Data = await getFileBase64(file);

  const prompt = `You are an expert musicologist and AI music prompt engineer. Analyze this song in detail.

Provide a comprehensive breakdown of its musical DNA, including:
1. **Genre & Sub-genres**: Be as specific as possible.
2. **Tempo & Rhythm**: BPM (approximate), time signature, groove, and rhythmic feel.
3. **Musical Structure**: Verse/chorus progression, bridge characteristics, intro/outro, and overall arrangement.
4. **Instrumentation**: Key instruments, synthesizers, drum machines, or acoustic elements.
5. **Vocal Style**: Timbre, delivery, effects (e.g., reverb, autotune), and emotional tone.
6. **Mood & Vibe**: The overall atmosphere and emotional resonance.
7. **Production Quality**: Lo-fi, polished, wall-of-sound, intimate, etc.

Finally, provide a highly optimized **Music Generator Prompt** (for tools like Suno or Udio) that uses these characteristics to generate a NEW song that sounds like it belongs on the same album or is by the same artist, without being a direct clone. The prompt should be concise, comma-separated keywords and phrases, focusing on sonic elements rather than lyrics.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  });

  return response.text || "No analysis generated.";
}

export async function compareSongs(song1: SongInput, song2: SongInput): Promise<string> {
  const parts: any[] = [];
  
  let promptText = `You are an expert musicologist and AI music prompt engineer. Compare these two songs:\n\n`;

  if (song1.type === 'link') {
    promptText += `Song 1 (Target): "${song1.link}"\n`;
  } else {
    promptText += `Song 1 (Target): [Audio File Provided]\n`;
    const base64Data = await getFileBase64(song1.file);
    parts.push({
      inlineData: {
        mimeType: song1.file.type,
        data: base64Data,
      },
    });
  }

  if (song2.type === 'link') {
    promptText += `Song 2 (Current): "${song2.link}"\n\n`;
  } else {
    promptText += `Song 2 (Current): [Audio File Provided]\n\n`;
    const base64Data = await getFileBase64(song2.file);
    parts.push({
      inlineData: {
        mimeType: song2.file.type,
        data: base64Data,
      },
    });
  }

  promptText += `CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided for either song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its musical characteristics.

Provide a detailed comparison of their musical DNA, focusing on what is missing or different in Song 2 compared to Song 1. Include:
1. **Genre & Vibe Differences**: How do the core genres and overall moods differ?
2. **Tempo & Rhythm Variations**: Are there differences in BPM, groove, or rhythmic feel?
3. **Musical Structure**: How do the song structures (verse/chorus progression, bridge, intro/outro) compare?
4. **Instrumentation Gaps**: What key instruments, synths, or production elements are present in Song 1 but missing or different in Song 2?
5. **Vocal & Melodic Contrasts**: How do the vocal styles, delivery, and melodic structures compare?
6. **Production & Mix**: How does the production quality (e.g., lo-fi vs. polished, spatial width) differ?

Finally, provide a highly optimized **"Delta" Music Generator Prompt** (for tools like Suno or Udio). This prompt should describe exactly what needs to be *added* or *changed* in Song 2 to make it sound like it belongs on the same album as Song 1.`;

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  return response.text || "No comparison generated.";
}

export async function analyzeSongLink(linkOrName: string): Promise<string> {
  const prompt = `You are an expert musicologist and AI music prompt engineer. Analyze the song at this link or with this name: "${linkOrName}".
  
CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its musical characteristics.

Provide a comprehensive breakdown of its musical DNA, including:
1. **Genre & Sub-genres**: Be as specific as possible.
2. **Tempo & Rhythm**: BPM (approximate), time signature, groove, and rhythmic feel.
3. **Musical Structure**: Verse/chorus progression, bridge characteristics, intro/outro, and overall arrangement.
4. **Instrumentation**: Key instruments, synthesizers, drum machines, or acoustic elements.
5. **Vocal Style**: Timbre, delivery, effects (e.g., reverb, autotune), and emotional tone.
6. **Mood & Vibe**: The overall atmosphere and emotional resonance.
7. **Production Quality**: Lo-fi, polished, wall-of-sound, intimate, etc.

Finally, provide a highly optimized **Music Generator Prompt** (for tools like Suno or Udio) that uses these characteristics to generate a NEW song that sounds like it belongs on the same album or is by the same artist, without being a direct clone. The prompt should be concise, comma-separated keywords and phrases, focusing on sonic elements rather than lyrics.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  return response.text || "No analysis generated.";
}

export type LyricSegment = {
  label: string;
  text: string;
};

export async function generateLyrics(song: SongInput, theme: string): Promise<LyricSegment[]> {
  const parts: any[] = [];
  
  let promptText = `You are an expert songwriter. Analyze the provided song to understand its structure, rhythm, and mood.
Then, write original lyrics for a NEW song based on the following theme/mood: "${theme}".

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

The lyrics should match the structural style of the reference song (e.g., Verse, Chorus, Verse, Chorus, Bridge, Outro).
Return the result as a JSON array of segments, where each segment has a "label" (e.g., "Verse 1", "Chorus") and "text" (the lyrics for that section).`;

  if (song.type === 'link') {
    promptText = `Reference Song: "${song.link}"\n\n` + promptText;
  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      // Cannot use tools with responseMimeType: 'application/json'
      // Wait, if we need urlContext, we can't use responseMimeType: 'application/json'
      // So we must instruct the model to return ONLY JSON and parse it.
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  try {
    // Extract JSON from markdown code block if present
    let jsonStr = response.text || "[]";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse lyrics JSON", e);
    return [];
  }
}

export async function analyzeAndGenerateStudioTrack(song: SongInput): Promise<{ title: string, prompt: string, styleTags: string, lyrics: string, analysis: string }> {
  const parts: any[] = [];
  
  let promptText = `You are an expert musicologist, songwriter, and AI music prompt engineer.
Analyze the provided reference song to understand its structure, rhythm, mood, genre, and specifically the VOCAL STYLE (timbre, delivery, emotion).

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

Based on your analysis, you must generate the following for a NEW song:

1. "analysis": A detailed paragraph analyzing the original song, specifically highlighting the vocal description and how it drives the emotion.
2. "lyrics": Write original lyrics formatted with section headers (e.g., [Verse 1], [Chorus]) that match the structural style of the reference song. The THEME and EMOTION of these new lyrics MUST be based entirely on the vocal description you just analyzed.
3. "title": A catchy, fitting title for the new song based on the lyrics.
4. "prompt": A Song Description describing the musical DNA, mood, and vocal style (for an AI music generator).
5. "styleTags": Comma-separated genres and vibes (e.g., "synthwave, 80s, dark"). MUST ONLY CONTAIN ALPHANUMERIC CHARACTERS AND SPACES. NO SPECIAL CHARACTERS LIKE & OR -.

Return the result STRICTLY as a JSON object with the keys: "title", "prompt", "styleTags", "lyrics", and "analysis".`;

  if (song.type === 'link') {
    promptText = `Reference Song: "${song.link}"\n\n` + promptText;
  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  try {
    let jsonStr = response.text || "{}";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    const data = JSON.parse(jsonStr);
    
    // Ensure lyrics are a string
    let lyricsStr = data.lyrics;
    if (Array.isArray(data.lyrics)) {
      lyricsStr = data.lyrics.map((l: any) => `[${l.label}]\n${l.text}`).join('\n\n');
    }

    return {
      title: data.title || 'Untitled',
      prompt: data.prompt || '',
      styleTags: data.styleTags || '',
      lyrics: lyricsStr || '',
      analysis: data.analysis || ''
    };
  } catch (e) {
    console.error("Failed to parse generation JSON", e);
    throw new Error("Failed to generate track details from analysis.");
  }
}

export async function rewriteLyricSegment(
  song: SongInput, 
  fullLyrics: LyricSegment[], 
  segmentIndex: number, 
  instruction: string
): Promise<string> {
  const parts: any[] = [];
  
  const targetSegment = fullLyrics[segmentIndex];
  const contextLyrics = fullLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

  let promptText = `You are an expert songwriter. You are helping to rewrite a specific section of lyrics for a song.

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

Here are the full current lyrics for context:
${contextLyrics}

Please rewrite ONLY the following section:
[${targetSegment.label}]
${targetSegment.text}

Instructions for the rewrite: "${instruction}"

Return ONLY the rewritten text for this section. Do not include the label.`;

  if (song.type === 'link') {
    promptText = `Reference Song for musical context: "${song.link}"\n\n` + promptText;
  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  return response.text?.trim() || targetSegment.text;
}

export async function suggestSongTitle(song: SongInput, fullLyrics: LyricSegment[]): Promise<string> {
  const parts: any[] = [];
  const contextLyrics = fullLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

  let promptText = `You are an expert songwriter and producer. Based on the musical context of the reference song and the following lyrics, suggest a single, compelling title for this new song.

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

Lyrics:
${contextLyrics}

Return ONLY the suggested title, without quotes or extra text.`;

  if (song.type === 'link') {
    promptText = `Reference Song for musical context: "${song.link}"\n\n` + promptText;
  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  return response.text?.trim().replace(/^["']|["']$/g, '') || "Untitled Song";
}
