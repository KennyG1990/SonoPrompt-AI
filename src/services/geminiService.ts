import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type SongInput = { type: 'file'; file: File } | { type: 'link'; link: string };

export interface ExtractedProfile {
  vocalPersona: string;
  emotionalTone: string;
  relationshipDynamic: string;
  lyricalDensity: string;
}

export interface AnalysisResult {
  markdown: string;
  profile: ExtractedProfile;
}

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

export async function analyzeAudioFile(file: File): Promise<AnalysisResult> {
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

Finally, provide a highly optimized **Music Generator Prompt** (for tools like Suno or Udio) that uses these characteristics to generate a NEW song that sounds like it belongs on the same album or is by the same artist. 

Make this prompt highly comprehensive (up to about 1000 characters). You MUST include a combination of the general sonic summary, but crucially, include almost verbatim the "Mood & Vibe" portion, as well as the "Vocal Style" details. Structure it like so: "[comma-separated sonic summary/genres/production]. Atmosphere: [Mood & Vibe details]. Delivery/Timbre: [Vocal Style details]."

CRITICAL RESPONSE FORMAT:
You MUST return your response as a strict JSON object with exactly two keys:
1. "markdown": A fully formatted markdown string containing your detailed 7-point musical analysis and the final Music Generator Prompt.
2. "profile": A nested JSON object containing strictly the following string keys: "vocalPersona", "emotionalTone", "relationshipDynamic", "lyricalDensity". Do NOT include production terms here. Focus purely on psychological, vocal, and songwriting behaviors.`;

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

  try {
    let jsonStr = response.text || "{}";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "" }
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return { markdown: response.text || "Failed to parse analysis.", profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "" } };
  }
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

export async function analyzeSongLink(linkOrName: string): Promise<AnalysisResult> {
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

Finally, provide a highly optimized **Music Generator Prompt** (for tools like Suno or Udio) that uses these characteristics to generate a NEW song that sounds like it belongs on the same album or is by the same artist. 

Make this prompt highly comprehensive (up to about 1000 characters). You MUST include a combination of the general sonic summary, but crucially, include almost verbatim the "Mood & Vibe" portion, as well as the "Vocal Style" details. Structure it like so: "[comma-separated sonic summary/genres/production]. Atmosphere: [Mood & Vibe details]. Delivery/Timbre: [Vocal Style details]."

CRITICAL RESPONSE FORMAT:
You MUST return your response as a strict JSON object with exactly two keys:
1. "markdown": A fully formatted markdown string containing your detailed 7-point musical analysis and the final Music Generator Prompt.
2. "profile": A nested JSON object containing strictly the following string keys: "vocalPersona", "emotionalTone", "relationshipDynamic", "lyricalDensity". Do NOT include production terms here. Focus purely on psychological, vocal, and songwriting behaviors.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    },
  });

  try {
    let jsonStr = response.text || "{}";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "" }
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return { markdown: response.text || "Failed to parse analysis.", profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "" } };
  }
}

export type LyricSegment = {
  label: string;
  text: string;
};

export interface LyricsGenerationResult {
  segments: LyricSegment[];
  prompt: string;
}

export async function generateLyrics(
  song: SongInput | null, 
  theme: string, 
  personality?: string, 
  profile?: ExtractedProfile,
  visualAnchor?: string,
  customStructure?: string,
  injectVocalTags?: boolean,
  rhymeComplexity?: string,
  emotionalArc?: string,
  instrumentalPacing?: string
): Promise<LyricsGenerationResult> {
  const parts: any[] = [];
  
  let promptText = `You are an elite, visceral songwriter.

CRITICAL DIRECTIVE REGARDING THE ATTACHED REFERENCE AUDIO:
Use the attached audio STRICTLY for syllable counting, rhythmic mapping, and structural layout (Verse, Chorus, Bridge, etc.). 
DO NOT adopt the narrative, imagery, or subject matter of the reference audio.
DO NOT use musical, structural, or production terminology in the lyrics.

NARRATIVE THEME / TOPIC:
"${theme}"

${profile ? `SONGWRITER PSYCHOLOGICAL PROFILE:
- Vocal Persona: ${profile.vocalPersona}
- Emotional Tone: ${profile.emotionalTone}
- Relationship Dynamic: ${profile.relationshipDynamic}
- Lyrical Density: ${profile.lyricalDensity}
` : ''}
${visualAnchor ? `CRITICAL INSTRUCTION: You must visually anchor the scene. The object or concept "[${visualAnchor}]" MUST be physically interacted with or explicitly described in the first verse to ground the song in reality.\n\n` : ''}
${injectVocalTags ? `CRITICAL VOCAL TAGS: Strategically insert audio-generator meta-tags. Use parentheses for background vocals (like '(echo)') and brackets for delivery style changes (like '[Aggressive building vocal]', '[choir swells]', '(ad-lib: yeah!)').\n\n` : ''}
${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: DO NOT use simple perfect AABB rhymes (like fire/desire). You MUST use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché pairings at all costs.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes (e.g., matching 3-4 syllables at the end of lines). Use internal rhymes. DO NOT use generic perfect rhymes (AABB). Avoid cliché pairings.\n\n` : ''}
${emotionalArc && emotionalArc !== 'static' ? `STORY ARC MANDATE: The lyrics must follow this emotional progression across the song structure: "${emotionalArc}". The first verse should start at the beginning of this arc, and the bridge/final chorus should reach the climax or resolution of this arc. Do not let the emotional tone remain flat.\n\n` : ''}
${instrumentalPacing === 'balanced' ? `INSTRUMENTAL PACING: Inject standalone instrumental arrangement blocks (e.g., [Melancholy Piano Intro], [Beat Drop], [4-Bar Guitar Solo]) between verses and choruses to give the song room to breathe.\n\n` : instrumentalPacing === 'cinematic' ? `INSTRUMENTAL PACING: Create a highly cinematic, spacious arrangement. Liberally inject long instrumental breaks, dynamic shifts, and atmospheric build-ups (e.g., [Long Atmospheric Intro], [Sudden Silence], [Massive Orchestral Bridge]) between sparse vocal sections.\n\n` : ''}
${personality ? `USER'S CUSTOM STRICT RULES & PERSONALITY:\n${personality}\n\nYou MUST strictly adhere to these rules.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

${customStructure ? `CRITICAL INSTRUCTION FOR STRUCTURE:
Do NOT invent your own structure or copy the reference song's structure. You MUST write lyrics that exactly fill these specific section tags, in this exact order:
${customStructure}
` : `The lyrics should match the structural style of the reference song (e.g., Verse, Chorus, Verse, Chorus, Bridge, Outro).`}
Return the result as a JSON array of segments, where each segment has a "label" (e.g., "Verse 1", "Chorus") and "text" (the lyrics for that section).`;

  if (song) {
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
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      safetySettings
    },
  });

  try {
    // Extract JSON from markdown code block if present
    let jsonStr = response.text || "[]";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    const parsed = JSON.parse(jsonStr);
    
    // Ensure we always return an array
    if (Array.isArray(parsed)) {
      return { segments: parsed, prompt: promptText };
    } else if (parsed && typeof parsed === 'object') {
      // Model might wrap it in an object like { "lyrics": [...] } or { "segments": [...] }
      if (Array.isArray(parsed.lyrics)) return { segments: parsed.lyrics, prompt: promptText };
      if (Array.isArray(parsed.segments)) return { segments: parsed.segments, prompt: promptText };
      if (Array.isArray(parsed.result)) return { segments: parsed.result, prompt: promptText };
      
      // If it's a single object with label/text, wrap it
      if (parsed.label && parsed.text) return { segments: [parsed], prompt: promptText };
    }
    
    console.warn("Unexpected JSON structure for lyrics:", parsed);
    return { segments: [], prompt: promptText };
  } catch (e) {
    console.error("Failed to parse lyrics JSON", e);
    return { segments: [], prompt: promptText };
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

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      safetySettings
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
  song: SongInput | null, 
  fullLyrics: LyricSegment[], 
  segmentIndex: number, 
  instruction: string,
  personality?: string,
  lockSyllables: boolean = false,
  rhymeComplexity?: string
): Promise<string[]> {
  const parts: any[] = [];
  
  if (!fullLyrics || !Array.isArray(fullLyrics)) {
    throw new Error("Invalid fullLyrics provided to rewriteLyricSegment");
  }

  const targetSegment = fullLyrics[segmentIndex];
  const contextLyrics = fullLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

  let promptText = `You are an expert songwriter. You are helping to rewrite a specific section of lyrics for a song.

${personality ? `CRITICAL LYRICIST PERSONALITY AND RULES:\n${personality}\n\nYou MUST strictly adhere to these rules when writing the rewrite.\n\n` : ''}${lockSyllables ? `CRITICAL SYLLABLE LOCK INSTRUCTION: You MUST maintain the EXACT SAME rhythmic syllable count as the original text you are rewriting. Count the syllables of the original line and ensure your rewrite matches it perfectly, line by line.\n\n` : ''}${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: Use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché perfect pairings.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes and internal rhymes. Avoid cliché perfect pairings.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, you MUST use the urlContext tool to read the page and identify the ACTUAL song title and artist. DO NOT guess or hallucinate the song based on the URL string alone. Once you have the correct song title and artist, use Google Search to find accurate information about its structure and lyrics.

Here are the full current lyrics for context:
${contextLyrics}

Please rewrite ONLY the following section:
[${targetSegment.label}]
${targetSegment.text}

Instructions for the rewrite: "${instruction}"

Return EXACTLY a valid JSON array containing 3 distinct string options for the rewritten text. Option 1 should be Poetic/Lyrical, Option 2 should be Direct/Blunt, and Option 3 should be Metaphorical. 
FORMAT EXACTLY LIKE THIS:
["option 1 text goes here", "option 2 text goes here", "option 3 text goes here"]
Do not include the segment label. Do not use markdown blocks for the JSON. Return ONLY the JSON array.`;

  if (song) {
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
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      safetySettings
    },
  });

  try {
    let rawText = response.text?.trim() || "[]";
    if (rawText.startsWith('```json')) rawText = rawText.replace(/```json\n?/, '');
    if (rawText.startsWith('```')) rawText = rawText.replace(/```\n?/, '');
    if (rawText.endsWith('```')) rawText = rawText.replace(/```$/, '');
    
    const parsed = JSON.parse(rawText.trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse rewrite options, returning raw text as one option", e);
  }
  
  return [response.text?.trim() || targetSegment.text];
}

export async function ghostwriteNextLine(
  currentText: string,
  theme: string,
  personality?: string,
  rhymeComplexity?: string
): Promise<string> {
  let promptText = `You are a ghostwriter helping a songwriter finish a lyric segment.

Current lyrics in progress:
"""
${currentText}
"""

Theme: ${theme}
${personality ? `Personality rules: ${personality}\n` : ''}
${rhymeComplexity === 'slant' ? `Use slant rhymes / assonance.` : rhymeComplexity === 'multi' ? `Use complex, multi-syllabic rhymes.` : ''}

CRITICAL: Generate EXACTLY 1 or 2 new lines that seamlessly continue the thought, flow, style, and rhyme scheme. 
Output ONLY the new lines. Do NOT rewrite the existing text. Do NOT include any intro or conversational filler.`;

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: promptText }] },
    config: {
      safetySettings
    },
  });

  return response.text?.trim() || "";
}

export async function suggestSongTitle(song: SongInput, fullLyrics: LyricSegment[]): Promise<string> {
  const parts: any[] = [];
  
  if (!fullLyrics || !Array.isArray(fullLyrics)) {
    console.error("suggestSongTitle received invalid fullLyrics:", fullLyrics);
    return "Untitled";
  }

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

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      safetySettings
    },
  });

  return response.text?.trim().replace(/^["']|["']$/g, '') || "Untitled Song";
}
