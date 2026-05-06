import { GoogleGenAI, Type } from "@google/genai";


let aiInstance: GoogleGenAI | null = null;

// Proxy object to maintain compatibility with existing call sites
const ai = {
  models: {
    generateContent: async (params: any) => {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: params.model || "gemini-3-flash-preview",
          contents: params.contents,
          config: params.config
        })
      });

      if (!response.ok) {
        let errorMsg = 'AI generation failed';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      return {
        text: data.text,
        response: {
          text: () => data.text
        }
      };
    }
  },
  chats: {
    create: () => {
      throw new Error("Chat mode is not supported via the proxy yet. Use generateContent instead.");
    }
  }
};

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
      
      // Error message checking for common transient issues
      const errorMessage = error?.message?.toLowerCase() || "";
      const isRateLimit = errorMessage.includes("429") || error?.status === 429;
      const isRpcError = errorMessage.includes("rpc failed") || errorMessage.includes("xhr error") || 
                         errorMessage.includes("proxyunarycall") || errorMessage.includes("500") || 
                         errorMessage.includes("deadline exceeded") || errorMessage.includes("internal error");
      const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("fetch failed");

      if ((isRateLimit || isRpcError || isTimeout) && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i); // Exponential backoff
        console.warn(`Gemini API transient error (${error?.status || '500'}). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`, error);
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
  lyricalTheme?: string;  // Detailed lyrical analysis/poem summary
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
    ? (config.openRouterAnalysisModel || config.openRouterModel || 'google/gemini-3-flash-preview')
    : (config.openRouterCreativeModel || config.openRouterModel || 'anthropic/claude-3.7-sonnet');
    
  if (finalModel === 'auto') {
    finalModel = taskType === 'analysis' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-3.7-sonnet';
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
    let errorMessage = 'OpenRouter generation failed';
    try {
      if (response.headers.get('content-type')?.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = `OpenRouter error (${response.status}): ${text.substring(0, 100)}`;
      }
    } catch (e) {
      errorMessage = `OpenRouter error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    const text = await response.text();
    throw new Error(`OpenRouter returned non-JSON response: ${text.substring(0, 100)}`);
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
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const info = await res.json();
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${info.title}" ${info.author ? 'by ' + info.author : ''}. You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
    } else if (url.includes('spotify.com')) {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
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
6. **Lyric Analysis**: A deep dive into the lyrical themes, word-tone, and metaphor usage. Explain the lyrics like a poem to someone who hasn't heard them.
7. **Mood & Vibe**: The overall atmosphere and emotional resonance.
8. **Production Quality**: Lo-fi, polished, wall-of-sound, intimate, etc.

DYNAMIC VARIABLE GENERATION:
For the "profile" variables below, you MUST CHOOSE FRESHLY and INTERNALLY before writing. Do NOT default to "dimly lit room" or "intimate" unless the song absolutely demands it. Avoid clichés.
1. a distinct environment (be specific: rainy highway, neon-drenched arcade, silent desert, etc.)
2. a relationship dynamic with clear tension or risk
3. one dominant emotional flavor
4. one recurring physical motif
5. one sensory palette
6. one chorus behavior

PROMPT GENERATION:
1. Provide a highly optimized **Music Generator Prompt**. Include the general sonic summary and verbatim inclusions of your chosen Environment, Sensory Palette, Physical Motif, Chorus Behavior, Vocal Persona, and Emotional Tone.
2. Provide a **Style Prompt** optimized for Suno/Udio. This must be a comma-separated list of genres, moods, and key sonic descriptors.

CRITICAL INSTRUCTION FOR JSON: The "musicalPrompt" field in the JSON object MUST ONLY contain the optimized prompt text itself. It MUST NOT include any section headers, the full 8-point analysis, or any markdown formatting. It is a raw string for copy-pasting.

CRITICAL CONSTRAINT: The COMBINED total length of the "Music Generator Prompt" and the "Style Prompt" MUST be STRICTLY less than 1000 characters. Allocate space wisely, prioritizing the Music Generator Prompt for detail and the Style Prompt for concise tags.

CRITICAL RESPONSE FORMAT:
You MUST return your response as a strict JSON object with exactly two keys:
1. "markdown": A fully formatted markdown string containing your detailed 8-point musical analysis and both generator prompts.
2. "profile": A nested JSON object containing strictly the following string keys: 
   - "vocalPersona", "emotionalTone", "relationshipDynamic", "lyricalDensity", "environment", "sensoryPalette", "physicalMotif", "chorusBehavior", "musicalPrompt", "stylePrompt", "lyricalTheme" (Strings)
   - "sonicDNA": { "energy": 0-100, "rhythmicComplexity": 0-100, "emotionalDarkness": 0-100, "vocalClarity": 0-100, "productionPolish": 0-100 }
   - "visualPrompt": A descriptive 2-line prompt for an image generator (no artist names, just vibes).`;

function extractJson(text: string): string {
  if (!text) return "";
  // Try to find markdown block first
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) return jsonMatch[1].trim();
  
  // Fallback: Find the first { or [ and last } or ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = text.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = text.lastIndexOf(']');
  }
  
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1).trim();
  }
  
  return text.trim();
}

/**
 * Sanitizes a potential JSON string from an AI model.
 * Fixes common issues like invalid escape characters (e.g., \') or raw newlines in strings.
 */
function sanitizeJson(jsonStr: string): string {
  if (!jsonStr) return "";
  
  let cleaned = jsonStr;
  
  // 1. Fix common AI invalid escapes
  // JSON only supports escaping: " \ / b f n r t uXXXX
  // We replace invalid escapes (like \' or \.) with the character itself.
  cleaned = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '$1');
  
  // 2. Handle invalid \u escapes (u not followed by 4 hex digits)
  cleaned = cleaned.replace(/\\u(?![0-9a-fA-F]{4})/g, 'u');
  
  // 3. Strip trailing commas in objects and arrays
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  
  // 4. Fix unescaped control characters (ASCII 0-31) which are invalid in JSON strings
  // Most commonly this is raw newlines or tabs inside string values.
  // We'll replace them with their escaped equivalents.
  // This is best handled by safeJsonParse's recovery mode if the first parse fails,
  // but we can do a light pass here for horizontal tabs.
  cleaned = cleaned.replace(/\t/g, "\\t");

  return cleaned;
}

/**
 * Robust JSON parsing that handles minor formatting errors.
 */
function safeJsonParse(jsonStr: string): any {
  const sanitized = sanitizeJson(jsonStr);
  try {
    return JSON.parse(sanitized);
  } catch (initialError: any) {
    console.warn("Initial JSON parse failed, attempting recovery...", initialError.message);
    
    try {
      // Recovery attempt 1: Try to handle raw newlines in string values
      // This is a common AI failure mode. Standard JSON.parse will fail on raw newlines.
      const fixedNewlines = sanitized.replace(/(^|[^\\])\n/g, "$1\\n");
      return JSON.parse(fixedNewlines);
    } catch (e) {
      // Recovery attempt 2: If we still fail, it might be a double quote issue or something else.
      // At this point we throw the original error or a combined one.
      throw new Error(`JSON Parse Error: ${initialError.message}. Content: ${sanitized.substring(0, 100)}...`);
    }
  }
}

/**
 * Analyzes audio/video files to extract song metadata.
 */
export async function analyzeAudioFile(file: File, config: AIConfig = { provider: 'gemini' }): Promise<AnalysisResult> {
  const base64Data = await getFileBase64(file);

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        {
          text: ANALYSIS_PROMPT_CORE + "\n\nIMPORTANT: Return ONLY the JSON object. Do not include any conversational filler before or after the JSON.",
        },
      ],
    },
    config: {
      tools: [{ googleSearch: {} }],
    },
  }));

  try {
    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", e, response.text);
    return { 
      markdown: response.text || "Failed to parse analysis.", 
      profile: { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" } 
    };
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
    model: "gemini-3-flash-preview",
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

  // No longer attempting to fetch actual audio for links as it triggers bot detection and 429s.
  // Gemini will rely on Search Grounding and metadata resolution instead.
  let audioData: { data: string, mimeType: string } | null = null;
  
  if (isUrl) {
    prompt = `CONTEXT FOR ASSISTANT: You are analyzing the song: "${linkOrName}" (${metadataAddition}).
    
You MUST use your internal training data and your Google Search tool to identify the specific instrumentation, tempo, lyrics, and production nuances of this exact track. Provide a high-fidelity analysis that isn't generic.\n\n` + prompt;
  }

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(prompt, config, 'analysis');
    try {
      const jsonStr = extractJson(text || "{}");
      const parsed = safeJsonParse(jsonStr);
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
  contentsData.push(prompt + "\n\nIMPORTANT: Return ONLY the JSON object. Do not include any conversational filler before or after the JSON.");

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contentsData,
    config: {
      tools: [{ googleSearch: {} }],
    },
  }));

  try {
    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
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
  explanation?: string;
  transition?: string;
};

export interface LyricsGenerationResult {
  segments: LyricSegment[];
  prompt: string;
  excerpt?: string;
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
  
  const systemText = `You are an elite, visceral songwriter.
  
- CRITICAL DIRECTIVE: This is a COMPLETELY FRESH CONTEXT. Disregard any previous song styles, themes, or patterns from earlier generations. You MUST create something unique and original for this specific request.
- CRITICAL DIRECTIVE: The lyrics MUST be about a concrete situation, objects, or a specific story. Avoid vague "vibes" or existential drift. The whole song must reflect a single, coherent narrative regardless of the lyric style or genre.
- ABSTRACTION LIMIT: Keep abstraction below 10%. Use the "show, don't tell" rule with physical details.
- MEANING EXCERPT: You must provide a short (2-3 sentence) prologue excerpt explaining the deep meaning and story behind the lyrics.
- SECTIONAL INSIGHTS: For EVERY section (Verse, Chorus, etc.), you MUST provide:
    1. "explanation": A 1-2 sentence explanation of the narrative purpose and lyrical subtext of this specific section.
    2. "transition": A brief note on how this section musically or lyrically leads into the next one (building tension, shifting mood, etc.).`;

  let promptText = `TASK: Generate a NEW, UNIQUE song from scratch.
  
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
- Lyrical DNA / Themes: ${profile.lyricalTheme || 'None analyzed'}
${profile.environment ? `- Environment: ${profile.environment}\n` : ''}${profile.sensoryPalette ? `- Sensory Palette: ${profile.sensoryPalette}\n` : ''}${profile.physicalMotif ? `- Physical Motif: ${profile.physicalMotif}\n` : ''}${profile.chorusBehavior ? `- Chorus Behavior: ${profile.chorusBehavior}\n` : ''}` : ''}
${visualAnchor ? `CRITICAL INSTRUCTION: You must visually anchor the scene. The object or concept "[${visualAnchor}]" MUST be physically interacted with or explicitly described in the first verse to ground the song in reality.\n\n` : ''}
${injectVocalTags ? `CRITICAL VOCAL TAGS: Strategically insert audio-generator meta-tags. Use parentheses for background vocals (like '(echo)') and brackets for delivery style changes (like '[Aggressive building vocal]', '[choir swells]', '(ad-lib: yeah!)').\n\n` : ''}
${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: DO NOT use simple perfect AABB rhymes (like fire/desire). You MUST use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché pairings at all costs.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes (e.g., matching 3-4 syllables at the end of lines). Use internal rhymes. DO NOT use generic perfect rhymes (AABB). Avoid cliché pairings.\n\n` : rhymeComplexity === 'narrative' ? `CRITICAL RHYME SCHEME: This song is FREE VERSE / NARRATIVE. DO NOT prioritize rhyming. Focus on poetic storytelling, flow, and evocative imagery. If rhymes occur, they should be accidental or very subtle. The priority is the narrative journey and emotional precision.\n\n` : ''}
${emotionalArc && emotionalArc !== 'static' ? `STORY ARC MANDATE: The lyrics must follow this emotional progression across the song structure: "${emotionalArc}". The first verse should start at the beginning of this arc, and the bridge/final chorus should reach the climax or resolution of this arc. Do not let the emotional tone remain flat.\n\n` : ''}
${instrumentalPacing === 'balanced' ? `INSTRUMENTAL PACING: Inject standalone instrumental arrangement blocks (e.g., [Melancholy Piano Intro], [Beat Drop], [4-Bar Guitar Solo]) between verses and choruses to give the song room to breathe.\n\n` : instrumentalPacing === 'cinematic' ? `INSTRUMENTAL PACING: Create a highly cinematic, spacious arrangement. Liberally inject long instrumental breaks, dynamic shifts, and atmospheric build-ups (e.g., [Long Atmospheric Intro], [Sudden Silence], [Massive Orchestral Bridge]) between sparse vocal sections.\n\n` : ''}
${personality ? `USER'S CUSTOM STRICT RULES & PERSONALITY:\n${personality}\n\nYou MUST strictly adhere to these rules.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

${customStructure ? `CRITICAL INSTRUCTION FOR STRUCTURE:
Do NOT invent your own structure or copy the reference song's structure. You MUST write lyrics that exactly fill these specific section tags, in this exact order:
${customStructure}
` : `The lyrics should match the structural style of the reference song (e.g., Verse, Chorus, Verse, Chorus, Bridge, Outro).`}

CRITICAL FORMATTING INSTRUCTION:
Your output MUST ONLY contain the actual sung lyrics and the section labels (e.g., "Verse 1"). Do NOT include any meta-descriptions, stage directions, or internal variables (like "Environment:", "Sensory Palette:", "Theme:") inside the lyrics themselves. The lyrics must be raw and ready to sing.

Return the result as a JSON object containing:
1. "segments": a JSON array where each segment has a "label" (e.g., "Verse 1", "Chorus"), "text" (the lyrics), "explanation" (narrative subtext), and "transition" (how it leads to the next part).
2. "excerpt": a 2-3 sentence string explaining the meaning/story of the song.`;

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
    const text = await callOpenRouter(systemText + "\n\n" + promptText, config);
    try {
      const jsonStr = extractJson(text || "[]");
      const parsed = safeJsonParse(jsonStr);
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
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: systemText },
        ...parts,
        { text: promptText }
      ]
    },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

  try {
    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
    
    let segments = [];
    let excerpt = "";

    if (Array.isArray(parsed)) {
      segments = parsed;
    } else if (parsed && typeof parsed === 'object') {
      segments = parsed.segments || parsed.lyrics || parsed.result || [];
      excerpt = parsed.excerpt || "";
      
      if (!segments.length && parsed.label && parsed.text) {
        segments = [parsed];
      }
    }
    
    return { segments, prompt: promptText, excerpt };
  } catch (e) {
    console.error("Failed to parse lyrics JSON", e);
    return { segments: [], prompt: promptText };
  }
}

export async function analyzeAndGenerateStudioTrack(song: SongInput, config: AIConfig = { provider: 'gemini' }): Promise<{ title: string, prompt: string, styleTags: string, lyrics: string, analysis: string, meaning: string }> {
  const parts: any[] = [];
  
  const systemText = `You are an expert musicologist, songwriter, and AI music prompt engineer.
  
- CRITICAL DIRECTIVE: This is a COMPLETELY FRESH CONTEXT. Disregard any previous song styles, themes, or patterns from earlier generations. You MUST create something unique and original for this specific request.
- CRITICAL ANALYSIS: Analyze the provided reference song to understand its structure, rhythm, mood, genre, and specifically the VOCAL STYLE (timbre, delivery, emotion).`;

  let promptText = `TASK: Analyze the reference song and generate a NEW, UNIQUE studio track from scratch.

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

1. "analysis": A detailed paragraph analyzing the original song, specifically highlighting the vocal description, lyrical themes (explain them like a poem to someone who hasn't heard them), and how they drive the emotion.
2. "lyrics": A JSON array of segments where each segment has "label", "text", "explanation", and "transition". The THEME and EMOTION of these new lyrics MUST be based entirely on the vocal description you just analyzed.
3. "meaning": A 2-3 sentence explanation of the storyline and emotional core of these specific lyrics. Keep abstraction below 10%.
4. "title": A catchy, fitting title for the new song based on the lyrics.
5. "prompt": A Song Description describing the musical DNA, mood, and vocal style. You MUST explicitly include all environmental and songwriter profile details (Environment, Sensory Palette, Physical Motif, Chorus Behavior, Vocal Persona) seamlessly within this prompt string. The "prompt" field MUST ONLY contain the optimized prompt text itself, no section headers or meta-analysis.
6. "styleTags": Comma-separated genres and vibes (e.g., "synthwave, 80s, dark"). MUST ONLY CONTAIN ALPHANUMERIC CHARACTERS AND SPACES. NO SPECIAL CHARACTERS LIKE & OR -.

CRITICAL CONSTRAINT: The COMBINED total length of the "prompt" and the "styleTags" fields MUST be STRICTLY less than 1000 characters.

Return the result STRICTLY as a JSON object with the keys: "title", "prompt", "styleTags", "lyrics", "analysis", and "meaning".`;

  if (song.type === 'link') {
    const meta = await resolveSongMetadata(song.link);
    promptText = `Reference Song: "${song.link}" ${meta}\n\n` + promptText;
    
    // We no longer attempt to force-download audio for links to avoid API breakage.
    // We rely on System Metadata Resolution and Search Grounding.
    promptText = `CONTEXT FOR ASSISTANT: The physical audio file for this track is NOT being provided directly to avoid extraction errors. You must use your internal musicology knowledge and your Search Tool to identify the specific production DNA, vocal style, and lyrical nuances of "${song.link}" (${meta}). Provide a high-fidelity analysis.\n\n` + promptText;
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
    const text = await callOpenRouter(systemText + "\n\n" + promptText, config, 'analysis');
    try {
      const jsonStr = extractJson(text || "{}");
      const data = safeJsonParse(jsonStr);
      
      // Ensure lyrics are a string
      let lyricsStr = data.lyrics;
      if (Array.isArray(data.lyrics)) {
        lyricsStr = data.lyrics.map((l: any) => {
          let s = `[${l.label}]\n${l.text}`;
          if (l.explanation) s += `\n(Context: ${l.explanation})`;
          if (l.transition) s += `\n(Pivoting: ${l.transition})`;
          return s;
        }).join('\n\n');
      }

      return {
        title: data.title || 'Untitled',
        prompt: data.prompt || '',
        styleTags: data.styleTags || '',
        lyrics: lyricsStr || '',
        analysis: data.analysis || '',
        meaning: data.meaning || ''
      };
    } catch (e) {
      console.error("OpenRouter parse failed", e);
      throw new Error("Failed to generate track details via OpenRouter.");
    }
  }

  parts.push({ text: promptText + "\n\nIMPORTANT: Return ONLY the JSON object. Do not include any conversational filler before or after the JSON." });

  const safetySettings: any = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: systemText },
        ...parts,
        { text: promptText + "\n\nIMPORTANT: Return ONLY the JSON object. Do not include any conversational filler before or after the JSON." }
      ]
    },
    config: {
      tools: [{ googleSearch: {} }],
      safetySettings
    },
  }));

  try {
    const jsonStr = extractJson(response.text || "{}");
    const data = safeJsonParse(jsonStr);
    
    // Ensure lyrics are a string
    let lyricsStr = data.lyrics;
    if (Array.isArray(data.lyrics)) {
      lyricsStr = data.lyrics.map((l: any) => {
        let s = `[${l.label}]\n${l.text}`;
        if (l.explanation) s += `\n(Context: ${l.explanation})`;
        if (l.transition) s += `\n(Pivoting: ${l.transition})`;
        return s;
      }).join('\n\n');
    }

    return {
      title: data.title || 'Untitled',
      prompt: data.prompt || '',
      styleTags: data.styleTags || '',
      lyrics: lyricsStr || '',
      analysis: data.analysis || '',
      meaning: data.meaning || ''
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

${personality ? `CRITICAL LYRICIST PERSONALITY AND RULES:\n${personality}\n\nYou MUST strictly adhere to these rules when writing the rewrite.\n\n` : ''}${lockSyllables ? `CRITICAL SYLLABLE LOCK INSTRUCTION: You MUST maintain the EXACT SAME rhythmic syllable count as the original text you are rewriting. Count the syllables of the original line and ensure your rewrite matches it perfectly, line by line.\n\n` : ''}${rhymeComplexity === 'slant' ? `CRITICAL RHYME SCHEME: Use modern slant rhymes, vowel-matching (assonance), and internal rhyming. Avoid cliché perfect pairings.\n\n` : rhymeComplexity === 'multi' ? `CRITICAL RHYME SCHEME: Write using complex, multi-syllabic rhyme schemes and internal rhymes. Avoid cliché perfect pairings.\n\n` : rhymeComplexity === 'narrative' ? `CRITICAL RHYME SCHEME: Use FREE VERSE / NARRATIVE. Focus on storytelling and poetic flow rather than end-rhymes. Keep it evocative.\n\n` : ''}CRITICAL INSTRUCTION: If a URL (like a YouTube or Spotify link) is provided as the Reference Song, use the SYSTEM METADATA RESOLUTION tag if present to identify the song. Base your analysis completely on the real-world song identified. DO NOT guess or hallucinate the song based purely on the URL string.

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
      const parsed = safeJsonParse(rawText.trim());
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
    model: "gemini-3-flash-preview",
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
    
    const parsed = safeJsonParse(rawText.trim());
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
${rhymeComplexity === 'slant' ? `Use slant rhymes / assonance.` : rhymeComplexity === 'multi' ? `Use complex, multi-syllabic rhymes.` : rhymeComplexity === 'narrative' ? `Use free verse / narrative storytelling (no specific rhyme focus).` : ''}

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
    model: "gemini-3-flash-preview",
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
    model: "gemini-3-flash-preview",
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
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
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
  } catch (error) {
    console.warn("Gemini Image generation failed, falling back to placeholder:", error);
  }

  // Placeholder image if generation fails
  return `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop`;
}
