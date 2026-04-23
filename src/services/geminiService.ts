import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to wrap AI calls with automatic retry for 429 errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a rate limit error (429)
      const isRateLimit = error?.message?.includes("429") || error?.status === 429 || 
                          (error?.response && error.response.status === 429);
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i); // Exponential backoff
        console.warn(`Gemini API Rate Limit hit (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export type SongInput = { type: 'file'; file: File } | { type: 'link'; link: string };

export interface SonicDNA {
  energy: number;
  rhythmicComplexity: number;
  emotionalDarkness: number;
  vocalClarity: number;
  productionPolish: number;
}

export interface ExtractedProfile {
  vocalPersona: string;
  emotionalTone: string;
  relationshipDynamic: string;
  lyricalDensity: string;
  environment?: string;
  sensoryPalette?: string;
  physicalMotif?: string;
  chorusBehavior?: string;
  sonicDNA?: SonicDNA;
  visualPrompt?: string;
  musicalPrompt?: string; // Long version (1000 chars)
  stylePrompt?: string;   // Short version (< 200 chars)
}

export interface AnalysisResult {
  markdown: string;
  profile: ExtractedProfile;
}

export interface AIConfig {
  provider: 'gemini' | 'openrouter';
  openRouterKey?: string;
  openRouterModel?: string; // Legacy fallback
  openRouterAnalysisModel?: string;
  openRouterCreativeModel?: string;
}

/**
 * Helper to call OpenRouter via our backend proxy.
 */
async function callOpenRouter(prompt: string, config: AIConfig, taskType: 'analysis' | 'creative' = 'creative'): Promise<string> {
  // Use specific task model, fallback to general openRouterModel, then default to a fallback.
  let finalModel = taskType === 'analysis' 
    ? (config.openRouterAnalysisModel || config.openRouterModel || 'google/gemini-1.5-flash')
    : (config.openRouterCreativeModel || config.openRouterModel || 'anthropic/claude-3.7-sonnet');
    
  if (finalModel === 'auto') {
    finalModel = taskType === 'analysis' ? 'google/gemini-1.5-flash' : 'anthropic/claude-3.7-sonnet';
  }

  const response = await fetch('/api/openrouter/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: finalModel,
      apiKey: config.openRouterKey
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'OpenRouter generation failed');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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

async function resolveSongMetadata(url: string): Promise<string> {
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const info = await res.json();
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${info.title}" ${info.author ? 'by ' + info.author : ''}. You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
    } else if (url.includes('spotify.com')) {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const info = await res.json();
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${info.title}". You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
    }
  } catch (e) {
    console.error("Failed to resolve URL natively:", e);
  }
  return "";
}

const ANALYSIS_PROMPT_CORE = `You are an expert musicologist and AI music prompt engineer. Analyze the song in detail.

Provide a comprehensive breakdown of its musical DNA, including:
1. **Genre & Sub-genres**: Be as specific as possible.
2. **Tempo & Rhythm**: BPM (approximate), time signature, groove, and rhythmic feel.
3. **Musical Structure**: Verse/chorus progression, bridge characteristics, intro/outro, and overall arrangement.
4. **Instrumentation**: Key instruments, synthesizers, drum machines, or acoustic elements.
5. **Vocal Style**: Timbre, delivery, effects (e.g., reverb, autotune), and emotional tone.
6. **Mood & Vibe**: The overall atmosphere and emotional resonance.
7. **Production Quality**: Lo-fi, polished, wall-of-sound, intimate, etc.

DYNAMIC VARIABLE GENERATION:
For the "profile" variables below, you MUST CHOOSE FRESHLY and INTERNALLY before writing. Do NOT default to "dimly lit room" or "intimate" unless the song absolutely demands it. Avoid clichés.
1. a distinct environment (be specific: rainy highway, neon-drenched arcade, silent desert, etc.)
2. a relationship dynamic with clear tension or risk
3. one dominant emotional flavor
4. one recurring physical motif
5. one sensory palette
6. one chorus behavior

PROMPT GENERATION:
1. Provide a highly optimized **Music Generator Prompt** (up to 1000 characters). Include the general sonic summary and verbatim inclusions of your chosen Environment, Sensory Palette, Physical Motif, Chorus Behavior, Vocal Persona, and Emotional Tone.
2. Provide a **Style Prompt** (STRICTLY under 200 characters) optimized for Suno/Udio. This must be a comma-separated list of genres, moods, and key sonic descriptors.

CRITICAL RESPONSE FORMAT:
You MUST return your response as a strict JSON object with exactly two keys:
1. "markdown": A fully formatted markdown string containing your detailed 7-point musical analysis and both generator prompts.
2. "profile": A nested JSON object containing strictly the following string keys: 
   - "vocalPersona", "emotionalTone", "relationshipDynamic", "lyricalDensity", "environment", "sensoryPalette", "physicalMotif", "chorusBehavior", "musicalPrompt", "stylePrompt" (Strings)
   - "sonicDNA": { "energy": 0-100, "rhythmicComplexity": 0-100, "emotionalDarkness": 0-100, "vocalClarity": 0-100, "productionPolish": 0-100 }
   - "visualPrompt": A descriptive 2-line prompt for an image generator (no artist names, just vibes).`;

export async function analyzeAudioFile(file: File, config: AIConfig = { provider: 'gemini' }): Promise<AnalysisResult> {
  const base64Data = await getFileBase64(file);

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        {
          text: ANALYSIS_PROMPT_CORE,
        },
      ],
    },
    config: {
      tools: [{ googleSearch: {} }],
    },
  }));

  try {
    let jsonStr = response.text || "{}";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return { markdown: response.text || "Failed to parse analysis.", profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" } };
  }
}

export async function compareSongs(song1: SongInput, song2: SongInput, config: AIConfig = { provider: 'gemini' }): Promise<string> {
  const parts: any[] = [];
  
  let promptText = `You are an expert musicologist and AI music prompt engineer. Compare these two songs:\n\n`;

  let hasFile = false;

  if (song1.type === 'link') {
    const meta1 = await resolveSongMetadata(song1.link);
    promptText += `Song 1 (Target): "${song1.link}" ${meta1}\n`;
  } else {
    hasFile = true;
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
    const meta2 = await resolveSongMetadata(song2.link);
    promptText += `Song 2 (Current): "${song2.link}" ${meta2}\n\n`;
  } else {
    hasFile = true;
    promptText += `Song 2 (Current): [Audio File Provided]\n\n`;
    const base64Data = await getFileBase64(song2.file);
    parts.push({
      inlineData: {
        mimeType: song2.file.type,
        data: base64Data,
      },
    });
  }

  promptText += `CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided for either song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

Provide a detailed comparison of their musical DNA, focusing on what is missing or different in Song 2 compared to Song 1. Include:
1. **Genre & Vibe Differences**: How do the core genres and overall moods differ?
2. **Tempo & Rhythm Variations**: Are there differences in BPM, groove, or rhythmic feel?
3. **Musical Structure**: How do the song structures (verse/chorus progression, bridge, intro/outro) compare?
4. **Instrumentation Gaps**: What key instruments, synths, or production elements are present in Song 1 but missing or different in Song 2?
5. **Vocal & Melodic Contrasts**: How do the vocal styles, delivery, and melodic structures compare?
6. **Production & Mix**: How does the production quality (e.g., lo-fi vs. polished, spatial width) differ?

Finally, provide a highly optimized **"Delta" Music Generator Prompt** (for tools like Suno or Udio). This prompt should describe exactly what needs to be *added* or *changed* in Song 2 to make it sound like it belongs on the same album as Song 1.`;

  if (config.provider === 'openrouter' && !hasFile) {
    return await callOpenRouter(promptText, config, 'analysis');
  }

  if (hasFile && config.provider === 'openrouter') {
    console.warn("OpenRouter currently lacks audio passing through our proxy. Falling back to native Gemini to analyze the physical file.");
  }

  parts.push({ text: promptText });

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      tools: [
        { googleSearch: {} },
      ],
    },
  }));

  return response.text || "No comparison generated.";
}

export async function analyzeSongLink(linkOrName: string, config: AIConfig = { provider: 'gemini' }): Promise<AnalysisResult> {
  const isUrl = linkOrName.includes('http');
  const metadataAddition = isUrl ? await resolveSongMetadata(linkOrName) : "";
  let prompt = `Analyze the song at this link or with this name: "${linkOrName}".
  ${metadataAddition}
  
CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

` + ANALYSIS_PROMPT_CORE;

  // Attempt to fetch actual audio so Gemini isn't operating blind
  let audioData: { data: string, mimeType: string } | null = null;
  if (isUrl && config.provider === 'gemini') {
    try {
      console.log('Downloading audio to feed to Gemini...');
      const dlRes = await fetch(`/api/youtube/download?url=${encodeURIComponent(linkOrName)}`);
      if (dlRes.ok) {
        const mimeType = dlRes.headers.get('Content-Type') || 'audio/webm';
        const blob = await dlRes.blob();
        
        // Convert to base64
        audioData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({ data: base64String, mimeType });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        prompt = `I am attaching the ACTUAL audio file for this song. Please LISTEN to the attached audio, and analyze IT directly rather than relying purely on text metadata search. Here is the metadata for context:\n${metadataAddition}\n\n` + prompt;
      }
    } catch (e) {
      console.warn("Could not fetch actual audio stream for analysis, falling back to pure metadata hallucination.", e);
    }
  }

  if (!audioData && isUrl) {
    prompt = `CONTEXT FOR ASSISTANT: The physical audio file for this track could NOT be retrieved due to technical connectivity limits. However, the user is expecting a HIGH-QUALITY, specific analysis of "${linkOrName}" (${metadataAddition}). 
    
You MUST use your internal training data and your Google Search tool to identify the specific instrumentation, tempo, and production nuances of this exact track. DO NOT be generic unless the song is truly obscure and you can't find information on it. Provide the same level of depth as if you were listening to it.\n\n` + prompt;
  }

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(prompt, config, 'analysis');
    try {
      let jsonStr = text || "{}";
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      const parsed = JSON.parse(jsonStr);
      return {
        markdown: parsed.markdown || "Analysis failed.",
        profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
      };
    } catch (e) {
      console.error("OpenRouter parse failed", e);
      return { markdown: text || "Failed to parse analysis.", profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" } };
    }
  }

  const contentsData: any[] = [];
  if (audioData) {
    contentsData.push({
      inlineData: {
        data: audioData.data,
        mimeType: audioData.mimeType,
      }
    });
  }
  contentsData.push(prompt);

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: contentsData,
    config: {
      tools: [{ googleSearch: {} }],
    },
  }));

  try {
    let jsonStr = response.text || "{}";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return { markdown: response.text || "Failed to parse analysis.", profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" } };
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
  instrumentalPacing?: string,
  config: AIConfig = { provider: 'gemini' }
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
- Emotional Tone / Flavor: ${profile.emotionalTone}
- Relationship Dynamic: ${profile.relationshipDynamic}
- Lyrical Density: ${profile.lyricalDensity}
${profile.environment ? `- Environment: ${profile.environment}\n` : ''}${profile.sensoryPalette ? `- Sensory Palette: ${profile.sensoryPalette}\n` : ''}${profile.physicalMotif ? `- Physical Motif: ${profile.physicalMotif}\n` : ''}${profile.chorusBehavior ? `- Chorus Behavior: ${profile.chorusBehavior}\n` : ''}` : ''}
${visualAnchor ? `CRITICAL INSTRUCTION: You must visually anchor the scene. The object or concept "[${visualAnchor}]" MUST be physically interacted with or explicitly described in the first verse to ground the song in reality.\n\n` : ''}
${injectVocalTags ? `CRITICAL VOCAL TAGS: Strategically insert audio-generator meta-tags. Use parentheses for background vocals (like '(echo)') and brackets for delivery style changes (like '[Aggressive building vocal]', '[choir swells]', '(ad-lib: yeah!)').\n\n` : ''}
${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: DO NOT use simple perfect AABB rhymes (like fire/desire). You MUST use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché pairings at all costs.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes (e.g., matching 3-4 syllables at the end of lines). Use internal rhymes. DO NOT use generic perfect rhymes (AABB). Avoid cliché pairings.\n\n` : ''}
${emotionalArc && emotionalArc !== 'static' ? `STORY ARC MANDATE: The lyrics must follow this emotional progression across the song structure: "${emotionalArc}". The first verse should start at the beginning of this arc, and the bridge/final chorus should reach the climax or resolution of this arc. Do not let the emotional tone remain flat.\n\n` : ''}
${instrumentalPacing === 'balanced' ? `INSTRUMENTAL PACING: Inject standalone instrumental arrangement blocks (e.g., [Melancholy Piano Intro], [Beat Drop], [4-Bar Guitar Solo]) between verses and choruses to give the song room to breathe.\n\n` : instrumentalPacing === 'cinematic' ? `INSTRUMENTAL PACING: Create a highly cinematic, spacious arrangement. Liberally inject long instrumental breaks, dynamic shifts, and atmospheric build-ups (e.g., [Long Atmospheric Intro], [Sudden Silence], [Massive Orchestral Bridge]) between sparse vocal sections.\n\n` : ''}
${personality ? `USER'S CUSTOM STRICT RULES & PERSONALITY:\n${personality}\n\nYou MUST strictly adhere to these rules.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

${customStructure ? `CRITICAL INSTRUCTION FOR STRUCTURE:
Do NOT invent your own structure or copy the reference song's structure. You MUST write lyrics that exactly fill these specific section tags, in this exact order:
${customStructure}
` : `The lyrics should match the structural style of the reference song (e.g., Verse, Chorus, Verse, Chorus, Bridge, Outro).`}

CRITICAL FORMATTING INSTRUCTION:
Your output MUST ONLY contain the actual sung lyrics and the section labels (e.g., "Verse 1"). Do NOT include any meta-descriptions, stage directions, or internal variables (like "Environment:", "Sensory Palette:", "Theme:") inside the lyrics themselves. The lyrics must be raw and ready to sing.

Return the result as a JSON array of segments, where each segment has a "label" (e.g., "Verse 1", "Chorus") and "text" (the lyrics for that section).`;

  if (song) {
    if (song.type === 'link') {
      const meta = await resolveSongMetadata(song.link);
      promptText = `Reference Song: "${song.link}" ${meta}\n\n` + promptText;
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

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(promptText, config);
    try {
      let jsonStr = text || "[]";
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return { segments: parsed, prompt: promptText };
      if (parsed.lyrics) return { segments: parsed.lyrics, prompt: promptText };
      if (parsed.segments) return { segments: parsed.segments, prompt: promptText };
      return { segments: [], prompt: promptText };
    } catch (e) {
      console.error("OpenRouter parse failed", e);
      return { segments: [], prompt: promptText };
    }
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

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

export async function analyzeAndGenerateStudioTrack(song: SongInput, config: AIConfig = { provider: 'gemini' }): Promise<{ title: string, prompt: string, styleTags: string, lyrics: string, analysis: string }> {
  const parts: any[] = [];
  
  let promptText = `You are an expert musicologist, songwriter, and AI music prompt engineer.
Analyze the provided reference song to understand its structure, rhythm, mood, genre, and specifically the VOCAL STYLE (timbre, delivery, emotion).

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

DYNAMIC VARIABLE GENERATION:
You MUST CHOOSE FRESHLY and INTERNALLY before writing. Do NOT default to "dimly lit room" or "intimate" unless the song absolutely demands it. Avoid clichés.
1. a distinct environment (be specific: rainy highway, neon-drenched arcade, silent desert, etc.)
2. a relationship dynamic with clear tension or risk
3. one dominant emotional flavor
4. one recurring physical motif
5. one sensory palette
6. one chorus behavior

Based on your analysis, you must generate the following for a NEW song:

1. "analysis": A detailed paragraph analyzing the original song, specifically highlighting the vocal description and how it drives the emotion.
2. "lyrics": Write original lyrics formatted with section headers (e.g., [Verse 1], [Chorus]) that match the structural style of the reference song. The THEME and EMOTION of these new lyrics MUST be based entirely on the vocal description you just analyzed.
3. "title": A catchy, fitting title for the new song based on the lyrics.
4. "prompt": A Song Description (up to 1000 characters) describing the musical DNA, mood, and vocal style. You MUST explicitly include all environmental and songwriter profile details (Environment, Sensory Palette, Physical Motif, Chorus Behavior, Vocal Persona) seamlessly within this prompt string.
5. "styleTags": Comma-separated genres and vibes (e.g., "synthwave, 80s, dark"). MUST ONLY CONTAIN ALPHANUMERIC CHARACTERS AND SPACES. NO SPECIAL CHARACTERS LIKE & OR -.

Return the result STRICTLY as a JSON object with the keys: "title", "prompt", "styleTags", "lyrics", and "analysis".`;

  if (song.type === 'link') {
    const meta = await resolveSongMetadata(song.link);
    promptText = `Reference Song: "${song.link}" ${meta}\n\n` + promptText;
    
    if (config.provider === 'gemini') {
      try {
        console.log('Downloading audio to feed to Gemini...');
        const dlRes = await fetch(`/api/youtube/download?url=${encodeURIComponent(song.link)}`);
        if (dlRes.ok) {
          const mimeType = dlRes.headers.get('Content-Type') || 'audio/webm';
          const blob = await dlRes.blob();
          
          const audioData = await new Promise<{data: string, mimeType: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve({ data: base64String, mimeType });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          parts.push({
            inlineData: {
              data: audioData.data,
              mimeType: audioData.mimeType,
            }
          });
          promptText = `I am attaching the ACTUAL audio file for this song. Please LISTEN to it to perfectly capture the sonic DNA, vocals, and genre.\n\n` + promptText;
        }
      } catch (e) {
        console.warn("Could not fetch actual audio stream for studio generation.", e);
      }
    }
    
    // If we couldn't get audio (either it failed, or we are using purely text-based OpenRouter)
    if (parts.length === 0) {
      promptText = `CONTEXT FOR ASSISTANT: The physical audio file for this track could NOT be retrieved. You must use your internal musicology knowledge and search tools to identify the specific production DNA of "${song.link}" (${meta}). Provide a high-fidelity analysis that isn't generic.\n\n` + promptText;
    }

  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(promptText, config, 'analysis');
    try {
      let jsonStr = text || "{}";
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
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
      console.error("OpenRouter parse failed", e);
      throw new Error("Failed to generate track details via OpenRouter.");
    }
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

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
  rhymeComplexity?: string,
  config: AIConfig = { provider: 'gemini' }
): Promise<string[]> {
  const parts: any[] = [];
  
  if (!fullLyrics || !Array.isArray(fullLyrics)) {
    throw new Error("Invalid fullLyrics provided to rewriteLyricSegment");
  }

  const targetSegment = fullLyrics[segmentIndex];
  const contextLyrics = fullLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

  let promptText = `You are an expert songwriter. You are helping to rewrite a specific section of lyrics for a song.

${personality ? `CRITICAL LYRICIST PERSONALITY AND RULES:\n${personality}\n\nYou MUST strictly adhere to these rules when writing the rewrite.\n\n` : ''}${lockSyllables ? `CRITICAL SYLLABLE LOCK INSTRUCTION: You MUST maintain the EXACT SAME rhythmic syllable count as the original text you are rewriting. Count the syllables of the original line and ensure your rewrite matches it perfectly, line by line.\n\n` : ''}${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: Use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché perfect pairings.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes and internal rhymes. Avoid cliché perfect pairings.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

Here are the full current lyrics for context:
${contextLyrics}

Please rewrite ONLY the following section:
[${targetSegment.label}]
${targetSegment.text}

Instructions for the rewrite: "${instruction}"

Return EXACTLY a valid JSON array containing 3 distinct string options for the rewritten text. Option 1 should be Poetic/Lyrical, Option 2 should be Direct/Blunt, and Option 3 should be Metaphorical. 

CRITICAL FORMATTING INSTRUCTION:
Your rewritten options MUST ONLY contain the actual sung lyrics. Do NOT include any meta-descriptions, stage directions, or internal variables (like "Environment:", "Sensory Palette:", "Theme:") inside the lyrics themselves. The lyrics must be raw and ready to sing.

FORMAT EXACTLY LIKE THIS:
["option 1 text goes here", "option 2 text goes here", "option 3 text goes here"]
Do not include the segment label. Do not use markdown blocks for the JSON. Return ONLY the JSON array.`;

  if (song) {
    if (song.type === 'link') {
      const meta = await resolveSongMetadata(song.link);
      promptText = `Reference Song for musical context: "${song.link}" ${meta}\n\n` + promptText;
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

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(promptText, config);
    try {
      let rawText = text?.trim() || "[]";
      if (rawText.startsWith('```json')) rawText = rawText.replace(/```json\n?/, '');
      if (rawText.startsWith('```')) rawText = rawText.replace(/```\n?/, '');
      if (rawText.endsWith('```')) rawText = rawText.replace(/```$/, '');
      const parsed = JSON.parse(rawText.trim());
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error("OpenRouter parse failed", e);
    }
    return [text || targetSegment.text];
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

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
  rhymeComplexity?: string,
  config: AIConfig = { provider: 'gemini' }
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
Output ONLY the new sung lyrics. Do NOT include any meta-descriptions, stage directions, or internal variables (like "Environment:", "Sensory Palette:"). Do NOT rewrite the existing text. Do NOT include any intro or conversational filler.`;

  if (config.provider === 'openrouter') {
    return await callOpenRouter(promptText, config);
  }

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts: [{ text: promptText }] },
    config: {
      safetySettings
    },
  }));

  return response.text?.trim() || "";
}

export async function suggestSongTitle(song: SongInput, fullLyrics: LyricSegment[], config: AIConfig = { provider: 'gemini' }): Promise<string> {
  const parts: any[] = [];
  
  if (!fullLyrics || !Array.isArray(fullLyrics)) {
    console.error("suggestSongTitle received invalid fullLyrics:", fullLyrics);
    return "Untitled";
  }

  const contextLyrics = fullLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

  let promptText = `You are an expert songwriter and producer. Based on the musical context of the reference song and the following lyrics, suggest a single, compelling title for this new song.

CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

Lyrics:
${contextLyrics}

Return ONLY the suggested title, without quotes or extra text.`;

  if (song.type === 'link') {
    const meta = await resolveSongMetadata(song.link);
    promptText = `Reference Song for musical context: "${song.link}" ${meta}\n\n` + promptText;
  } else {
    const base64Data = await getFileBase64(song.file);
    parts.push({
      inlineData: {
        mimeType: song.file.type,
        data: base64Data,
      },
    });
  }

  if (config.provider === 'openrouter') {
    const title = await callOpenRouter(promptText, config);
    return title?.trim().replace(/^["']|["']$/g, '') || "Untitled Song";
  }

  parts.push({ text: promptText });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

  return response.text?.trim().replace(/^["']|["']$/g, '') || "Untitled Song";
}

/**
 * Generates a mood visual (album art) based on a descriptive prompt.
 */
export async function generateMoodVisual(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Generate a high-fidelity, high-concept minimalist album art cover. 
Description: ${prompt}
Style: Professional music aesthetic, elegant composition, high resolution, 1K. 
No text, no letters, no logos. Just the visual essence.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }

  throw new Error("Failed to generate image.");
}
