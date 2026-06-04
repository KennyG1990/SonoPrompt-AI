import { GoogleGenAI, Type } from "@google/genai";


let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    // Standard AI Studio check. If it's missing, it won't work in the preview unless handled by the platform.
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      console.warn("GEMINI_API_KEY is missing from environment. This might cause failures if not handled by AI Studio platform.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey as string });
  }
  return aiInstance;
}

// Proxy object to maintain compatibility with existing call sites
const ai = {
  models: {
    generateContent: async (params: any) => {
      return getAI().models.generateContent(params);
    },
    generateContentStream: async (params: any) => {
      return getAI().models.generateContentStream(params);
    }
  },
  chats: {
    create: (params: any) => {
      return getAI().chats.create(params);
    }
  }
};

/**
 * Helper to wrap AI calls with automatic retry for transient errors.
 * Includes exponential backoff with jitter.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Extract error details safely
      const errorMessage = error?.message?.toLowerCase() || "";
      const status = error?.status || error?.code || error?.error?.code || 0;
      const statusText = error?.statusText || error?.error?.status || "";
      
      // Detection logic for retryable errors
      const isRateLimit = status === 429 || errorMessage.includes("429") || errorMessage.includes("too many requests");
      const isServiceUnavailable = status === 503 || status === 504 || 
                                   errorMessage.includes("503") || errorMessage.includes("504") ||
                                   errorMessage.includes("service unavailable") || 
                                   errorMessage.includes("high demand") || 
                                   errorMessage.includes("unavailable") ||
                                   statusText.includes("UNAVAILABLE");
      const isInternalError = status === 500 || errorMessage.includes("500") || 
                              errorMessage.includes("internal error") || 
                              errorMessage.includes("rpc failed") ||
                              errorMessage.includes("xhr error") ||
                              errorMessage.includes("deadline exceeded");
      const isNetworkError = errorMessage.includes("fetch failed") || 
                             errorMessage.includes("failed to fetch") || 
                             errorMessage.includes("network error") ||
                             errorMessage.includes("timeout") ||
                             errorMessage.includes("proxy");

      const isRetryable = isRateLimit || isServiceUnavailable || isInternalError || isNetworkError;

      if (isRetryable && i < maxRetries - 1) {
        // Exponential backoff: initialDelay * 2^i
        // Plus random jitter to prevent "thundering herd" effect
        const jitter = Math.random() * 1000;
        const delay = (initialDelay * Math.pow(2, i)) + jitter;
        
        console.warn(`Gemini API transient error (${status || 'unknown'}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`, {
          message: error.message,
          status,
          statusText
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not retryable or max retries reached, throw
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
  const tryFetch = async (targetUrl: string, options?: RequestInit) => {
    try {
      const res = await withRetry(() => fetch(targetUrl, options));
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`Fetch to ${targetUrl} failed:`, e);
    }
    return null;
  };

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const info = await tryFetch(`${origin}/api/youtube/info?url=${encodeURIComponent(url)}`);
      if (info && info.title) {
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${info.title}" ${info.author ? 'by ' + info.author : ''}. You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
    } else if (url.includes('spotify.com')) {
      // Use the server as a proxy for Spotify to avoid CORS issues if they arise
      const info = await tryFetch(`${origin}/api/metadata/spotify?url=${encodeURIComponent(url)}`);
      if (info && info.title) {
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${info.title}". You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
      
      // Fallback to direct client-side fetch if server proxy fails or isn't implemented
      const directInfo = await tryFetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (directInfo && directInfo.title) {
        return `\n\n[SYSTEM METADATA RESOLUTION]: The URL has been natively resolved to the ACTUAL track: "${directInfo.title}". You MUST base your analysis or generation solely on this real-world track. Do NOT hallucinate the song title.`;
      }
    }
  } catch (e) {
    console.error("Failed to resolve URL natively:", e);
  }
  return "";
}

const ANALYSIS_PROMPT_CORE = `You are a Senior Musicologist and technical Analyst. Your task is to provide a HIGH-ACCURACY analysis.

CRITICAL: ACCURACY OVER CREATIVITY. You MUST use your Google Search tool to verify the specifics of the actual track provided. 

GROUNDING ENFORCEMENT:
1. Do NOT guess the genre based on the Artist Name. Provocative or experimental names (e.g., "ORGAVSM") do NOT always imply experimental genres (e.g., "Hyperpop"). 
2. If the song is R&B/Soul, characterize it as such. 
3. If you cannot find verified information for a specific point (like BPM), provide a reasoned estimate but label it as [ESTIMATED]. 

DO NOT HALLUCINATE: If the song is a niche track and you cannot find verified audio descriptions or lyrics, you MUST state: "Detailed sonic data not verified for this specific track. Analysis is based on [Artist Name]'s general style and provided metadata."

Provide a comprehensive breakdown of its musical DNA, including:
1. **Genre & Sub-genres**: Be as specific as possible.
2. **Tempo & Rhythm**: BPM (approximate), time signature, groove, and rhythmic feel.
3. **Musical Structure**: Verse/chorus progression, bridge characteristics, intro/outro, and overall arrangement.
4. **Instrumentation**: Key instruments, synthesizers, drum machines, or acoustic elements.
5. **Vocal Style**: Timbre, delivery, effects (e.g., reverb, autotune), and emotional tone.
6. **Lyric Analysis**: A deep dive into the lyrical themes, word-tone, and metaphor usage. Explain the lyrics' narrative, emotional weight, and visceral impact to someone who hasn't heard them. Focus on the raw intent behind the words.
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
   - "visualPrompt": A descriptive 2nd-person prompt for an image generator. If the song is sensual, intimate, or "Sexy RnB", focus on a nocturnal, high-gloss, cinematic environment with heavy shadows, rich textures (silk, leather, skin), and atmospheric lighting (deep indigo, crimson). (no artist names, just vibes).

CRITICAL JSON HYGIENE: The output MUST be a single, valid JSON object. 
- All string values (especially the 'markdown' field) MUST have internal line breaks replaced with \\n (double backslash n).
- All internal double quotes in string values MUST be escaped as \\" (double backslash quote). 
- DO NOT use raw newlines inside string values.
- DO NOT truncate the response.`;

function extractJson(text: string): string {
  if (!text) return "";
  
  // 1. Try to find markdown blocks first
  const blocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/ig));
  if (blocks.length > 0) {
    // If multiple blocks, try to find the one that looks most like our expected JSON
    for (const block of blocks.reverse()) {
      const content = block[1].trim();
      if (content.startsWith('{') && content.endsWith('}')) return content;
    }
    return blocks[blocks.length - 1][1].trim();
  }
  
  // 2. Fallback: Find the first { or [ and last } or ]
  // We try to find the outermost matching pair. 
  // If there are multiple separate objects, we usually want the one that contains "profile" or "markdown"
  let start = text.indexOf('{');
  let end = text.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && end > start) {
    // Basic validation: is it likely the whole response or just a fragment?
    const candidates = [];
    
    // Find all potential JSON start/end pairs and check them
    let searchStart = 0;
    while ((searchStart = text.indexOf('{', searchStart)) !== -1) {
      let searchEnd = text.lastIndexOf('}');
      while (searchEnd > searchStart) {
        const potential = text.substring(searchStart, searchEnd + 1).trim();
        if (potential.includes('"markdown"') || potential.includes('"profile"') || potential.includes('"segments"')) {
          candidates.push(potential);
        }
        searchEnd = text.lastIndexOf('}', searchEnd - 1);
      }
      searchStart++;
      if (candidates.length > 5) break; // Don't over-search
    }
    
    if (candidates.length > 0) {
      // Return the longest one which is likely the full object
      return candidates.sort((a, b) => b.length - a.length)[0];
    }

    return text.substring(start, end + 1).trim();
  }
  
  return text.trim();
}
/**
 * Sanitizes a potential JSON string from an AI model.
 * Fixes common issues like invalid escape characters, raw newlines, or trailing commas.
 */
function sanitizeJson(jsonStr: string): string {
  if (!jsonStr) return "";
  
  let cleaned = jsonStr.trim();
  
  // 1. Strip potential Markdown code block indicators
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // 2. Fix invalid escapes (e.g., \. or \* which are common AI failures)
  // We keep \", \\, \/, \b, \f, \n, \r, \t, \u
  cleaned = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '$1');
  
  // 3. Handle invalid \u escapes
  cleaned = cleaned.replace(/\\u(?![0-9a-fA-F]{4})/g, 'u');
  
  // 4. Strip trailing commas
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // 5. Fix common horizontal tabs and other control characters
  cleaned = cleaned.replace(/\t/g, "\\t");
  cleaned = cleaned.replace(/\r/g, "\\r");

  return cleaned;
}

/**
 * Robust JSON parsing that handles minor formatting errors, specifically unescaped newlines and nested quotes.
 */
function safeJsonParse(jsonStr: string): any {
  const sanitized = sanitizeJson(jsonStr);
  
  try {
    return JSON.parse(sanitized);
  } catch (initialError: any) {
    console.warn("Initial JSON parse failed, attempting recovery...", initialError.message);
    
    try {
      // Recovery attempt 1: Fix unescaped newlines inside string values
      // We look for any newline that is NOT followed by a structure that looks like the start of a new key ("key":)
      // or the end of an object/array (} , ]).
      let fixed = sanitized.replace(/\n(?!(?:[ \t]*["}\]])|(?:[ \t]*["\w]+":))/g, "\\n");
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        // Recovery attempt 2: Escape unescaped double quotes in middle of sentences
        // This regex looks for double quotes that are surrounded by characters that 
        // usually suggest they are part of the text rather than JSON structure.
        let fixedQuotes = sanitized.replace(/(?<=[a-zA-Z0-9.,!?;:\s])"(?=[a-zA-Z0-9.,!?;:\s])/g, '\\"');
        // Re-apply newline fix
        fixedQuotes = fixedQuotes.replace(/\n(?!(?:[ \t]*["}\]])|(?:[ \t]*["\w]+":))/g, "\\n");
        return JSON.parse(fixedQuotes);
      } catch (e3) {
        try {
          // Recovery attempt 3: Most aggressive - escape ALL quotes that aren't property-adjacent
          // (i.e., property name or value start/end)
          let aggressive = sanitized.replace(/(?<![:\s[{,])"(?![\s\],}:])/g, '\\"');
          return JSON.parse(aggressive);
        } catch (e4) {
          // Final attempt: provide context
          const pos = initialError.pos !== undefined ? initialError.pos : 0;
          const start = Math.max(0, pos - 100);
          const end = Math.min(sanitized.length, pos + 200);
          const errorContext = sanitized.substring(start, end);
          console.error("All JSON recovery attempts failed.");
          throw new Error(`Failed to parse JSON response: ${initialError.message}. Error near: ...${errorContext}...`);
        }
      }
    }
  }
}


/**
 * Analyzes audio/video files to extract song metadata.
 */
export async function analyzeAudioFile(file: File, config: AIConfig = { provider: 'gemini' }): Promise<AnalysisResult> {
  const base64Data = await getFileBase64(file);

  try {
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
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      },
    }));

    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
    };
  } catch (e) {
    console.error("Critical analysis failure or Gemini error:", e);
    return { 
      markdown: `### Analysis Unavailable\n\nThe AI analysis service encountered a temporary error. Please try again soon.\n\nError details: ${e instanceof Error ? e.message : 'Unknown internal error'}`, 
      profile: { vocalPersona: "Unknown", emotionalTone: "Unknown", relationshipDynamic: "Unknown", lyricalDensity: "Unknown", environment: "Cloudy Studio", sensoryPalette: "Neutral", physicalMotif: "None", chorusBehavior: "Standard", musicalPrompt: "", stylePrompt: "" } 
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

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contentsData,
      config: {
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      },
      }));

    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
    return {
      markdown: parsed.markdown || "Analysis failed.",
      profile: parsed.profile || { vocalPersona: "", emotionalTone: "", relationshipDynamic: "", lyricalDensity: "", environment: "", sensoryPalette: "", physicalMotif: "", chorusBehavior: "", musicalPrompt: "", stylePrompt: "" }
    };
  } catch (e) {
    console.error("Failed to analyze song link or Gemini error:", e);
    return { 
      markdown: `### Link Analysis Unavailable\n\nFailed to retrieve metadata for "${linkOrName}". This can happen with age-restricted or private links.\n\nError: ${e instanceof Error ? e.message : 'Transient service failure'}`, 
      profile: { vocalPersona: "Unknown", emotionalTone: "Unknown", relationshipDynamic: "Unknown", lyricalDensity: "Unknown", environment: "Digitized Void", sensoryPalette: "Grayscale", physicalMotif: "Lost Signals", chorusBehavior: "Faded", musicalPrompt: "", stylePrompt: "" } 
    };
  }
}

/**
 * Abstraction Pass: Rewrites concrete DNA fields as abstract patterns.
 */
export async function abstractProfileFields(profile: ExtractedProfile, config: AIConfig = { provider: 'gemini' }): Promise<ExtractedProfile> {
  const prompt = `You are an expert musicologist and creative director. 
You are given concrete details extracted from a reference song's Creative DNA.
Your task is to rewrite each field as an abstract pattern that captures the underlying FUNCTION of the detail (its emotional or structural purpose), but not its surface manifestation.

STRICT CONSTRAINTS:
1. HARD LENGTH LIMIT: Each abstracted field MUST be between 3 and 8 words.
2. PLAIN STRUCTURAL ENGLISH: Use the register of a producer giving direction. Avoid poetic, flowery, or pseudo-technical jargon.
3. FORBIDDEN VOCABULARY: Do NOT use these words: shimmering, crystalline, synthetic, luminescent, liminal, kinetic, entropic, refracted, conductive, particulate, gravitational, hardened, decelerated, vertical, radial, viscous, ethereal, pulse, resonance, frequency.
4. NO LEAKS: The output must NOT reference any specific common noun, proper noun, location, or object from the original (e.g., no "cars", "streets", "coffee", "jackets").
5. FIVE-SONG TEST: For each field, verify that a skilled lyricist could write five DIFFERENT songs from that field using totally different surface imagery. If it's too specific, rewrite it shorter.
6. REGISTER CHECK: If it sounds like poetry, science fiction, or a physics textbook, it is WRONG. Keep it as plain as a work order.

EXAMPLES:
- Vocal Persona:
  - WRONG: "A processed, crystalline suspension of air pushed through synthetic vulnerability" (Too ornate/Forbidden words)
  - CORRECT: "Close-mic breathy delivery with low-fidelity distortion" (7 words)
- Physical Motif:
  - WRONG: "The entropic drift of a fading particulate ghost into the void" (Too poetic/Forbidden words)
  - CORRECT: "Metal surfaces catching and reflecting sharp light" (7 words)
- Environment:
  - WRONG: "Luminescence in shortest wavelengths refracted through fluid conductivity" (Too technical/Forbidden words)
  - CORRECT: "Enclosed sterile room with cold metallic surfaces" (7 words)
- Chorus Behavior:
  - WRONG: "A radial kinetic rupture into a state of unresisted descent" (Too abstract/Forbidden words)
  - CORRECT: "Brief high-energy explosion of rhythmic vocal stabs" (7 words)

INPUT DNA:
${JSON.stringify({
  vocalPersona: profile.vocalPersona,
  emotionalTone: profile.emotionalTone,
  relationshipDynamic: profile.relationshipDynamic,
  lyricalDensity: profile.lyricalDensity,
  environment: profile.environment,
  sensoryPalette: profile.sensoryPalette,
  physicalMotif: profile.physicalMotif,
  chorusBehavior: profile.chorusBehavior,
  lyricalTheme: profile.lyricalTheme
}, null, 2)}

SELF-CHECK BEFORE OUTPUT:
- Word count: 3-8 words per field?
- No forbidden words?
- No original nouns?
- Functional producer-style tone?

Return ONLY the JSON object with the same keys as the input.`;

  if (config.provider === 'openrouter') {
    const text = await callOpenRouter(prompt, config, 'analysis');
    try {
      const jsonStr = extractJson(text || "{}");
      const parsed = safeJsonParse(jsonStr);
      return { ...profile, ...parsed };
    } catch (e) {
      console.error("OpenRouter abstraction failed", e);
      return profile;
    }
  }

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
    }));

    const jsonStr = extractJson(response.text || "{}");
    const parsed = safeJsonParse(jsonStr);
    return { ...profile, ...parsed };
  } catch (e) {
    console.error("Gemini abstraction parse failed", e);
    return profile;
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
- STEERING AS DIRECTION, NOT VOCABULARY: The "STRICT SONGWRITER PROFILE" fields (Environment, Motif, etc.) are your SOP (Standard Operating Procedure), NOT your word list. You MUST fulfill the functional requirement of these fields using NEW imagery and fresh language. UNLESS specifically requested, you are FORBIDDEN from using the literal words found in the Environment, Physical Motif, or Sensory Palette fields as surface lyrics. Show the effect, do not quote the brief.
- DYNAMIC CHORUS EVOLUTION: Lyrical repetition is the enemy of the Story Arc. Even if the melody and structure remain stable (for hook consistency), you MUST evolve the lyrics of each chorus instance to reflect the emotional progress specified in the "STORY ARC MANDATE". Chorus 1 should be the setup; Chorus 2 should be more intense or shifted; Chorus 3 (final) should be the emotional climax or resolution.
- ANTI-CLICHÉ: Avoid "neon lights", "rain on windows", "lost in the city", and other overused AI songwriting tropes unless explicitly requested in the Environment or Motif fields.
- NOCTURNAL/SENSUAL IDENTITY: If the sub-genre or mood involves "Sensual", "Intimate", "Sexy RnB", "Erotic", or "Seductive" themes:
ARTIST IDENTITY: nocturnal, sensual, intimate, stylish, emotionally damaged, secretive, physically immediate, seductive, hook-driven, high-gloss, breathy vocal feel.
CORE RULE: Sound like the same ARTIST, not the same SONG. Lane is erotic tension, secrecy, temptation, dependence, possession, guilt, physical need, and the power dynamic of dominance and submission. Seductive first, dangerous second, poetic third.
MAIN GOAL: Stay in the moment. No emotional distance.
PERSPECTIVE LOCK (mandatory): Every song MUST be written from ONE of two perspectives — never both, never neutral. Choose at the start of generation and hold that choice across every section.
DOMINANT PERSPECTIVE: The narrator is the one giving commands, taking, holding, claiming, marking, controlling the pace, deciding what is given and withheld. Verbs are active and possessive. Address to the other person is directive. Sentence energy is patient, in control, deliberate. Pleasure is something the narrator administers, watches, or extracts. The narrator is never asking — they are stating, instructing, or taking.
SUBMISSIVE PERSPECTIVE: The narrator is the one offering, surrendering, begging, opening, waiting, being held, taken, marked, used, ruined. Verbs are receptive and yielding. Address to the other person is pleading, inviting, or thanking. Sentence energy is breathless, urgent, undone. Pleasure is something the narrator receives, endures, or earns by giving up control. The narrator is never commanding — they are asking, offering, or being acted upon.
If no perspective is specified externally, default to SUBMISSIVE. Do not blend the two perspectives within a single song. The narrator is one or the other for the entire track.
SEXUAL TENSION: Unmistakable body-level tension (touch, breath, pressure, restraint, mark). Chorus must be sexually direct in the chosen perspective's register — Dominant choruses are blunt commands and statements of possession; Submissive choruses are blunt pleas, offers, and surrenders. Default toward lust over metaphor.
EXPLICITNESS: Do not avoid explicit sexual phrasing or blunt intimate phrases. Profanity as sexual language, not filler. D/s vocabulary is welcome where it serves the song — holding, kneeling, marking, breath, pressure, mercy, please, take, give, mine, yours, ruined, undone — but is never costume. The dynamic must feel lived-in, not performed.
WRITING: Concrete physical details. Every section must increase desire, risk, or tension. Verses cinematic, chorus simple and physical. The chosen perspective dictates which body the camera is closest to — Dominant lyrics observe the partner's body and reactions; Submissive lyrics inhabit the narrator's own body being acted upon.
- CHORUS BEHAVIOR: You MUST strictly adhere to the "Chorus Behavior" variable if defined. If it says "blunt", be blunt. If it says "abstract", be abstract.
- FRESHNESS: Invent a fresh environment and relationship dynamic for every song unless specified. Avoid luxury clichés unless they are used in a concrete, cinematic way.
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

${profile ? `STRICT SONGWRITER PROFILE (MANDATORY STEERING):
- Vocal Persona: ${profile.vocalPersona}
- Emotional Tone / Flavor: ${profile.emotionalTone}
- Relationship Dynamic: ${profile.relationshipDynamic}
- Lyrical Density: ${profile.lyricalDensity}
- Lyrical DNA / Themes: ${profile.lyricalTheme || 'None analyzed'}
${profile.environment ? `- Environment (MANDATORY): ${profile.environment}\n` : ''}${profile.sensoryPalette ? `- Sensory Palette (MANDATORY): ${profile.sensoryPalette}\n` : ''}${profile.physicalMotif ? `- Physical Motif (MANDATORY): ${profile.physicalMotif}\n` : ''}${profile.chorusBehavior ? `- Chorus Behavior (MANDATORY): ${profile.chorusBehavior}\n` : ''}` : ''}
${visualAnchor ? `CRITICAL VISUAL ANCHOR: The object or concept "[${visualAnchor}]" MUST be physically interacted with or explicitly described in the first verse to ground the song in reality. This object should be central to the scene.\n\n` : ''}
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
2. "excerpt": a 2-3 sentence string explaining the meaning/story of the song.

CRITICAL JSON HYGIENE: The output MUST be a single, valid JSON object. 
- All string values MUST have internal line breaks replaced with \\n (double backslash n).
- All internal double quotes in string values MUST be escaped as \\" (double backslash quote). 
- DO NOT use raw newlines inside string values.
- DO NOT truncate the response.`;

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
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192
      }
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

export async function analyzeAndGenerateStudioTrack(song: SongInput, config: AIConfig = { provider: 'gemini' }): Promise<{ title: string, prompt: string, styleTags: string, lyrics: string, analysis: string, meaning: string, visualPrompt?: string }> {
  // --- STEP 1: INITIAL ANALYSIS (SonoPrompt) ---
  const isUrl = song.type === 'link';
  let initialAnalysis: AnalysisResult;
  if (isUrl) {
    initialAnalysis = await analyzeSongLink(song.link, config);
  } else {
    initialAnalysis = await analyzeAudioFile(song.file, config);
  }

  // --- STEP 2: ABSTRACTION PASS ---
  const abstractedProfile = await abstractProfileFields(initialAnalysis.profile, config);

  // --- STEP 3: STUDIO GENERATION (Lyrical Prompt) ---
  const parts: any[] = [];
  
  const systemText = `You are a Senior Musicologist and elite Songwriter.
  
- CRITICAL DIRECTIVE: ACCURACY FIRST. This is a COMPLETELY FRESH CONTEXT.
- GROUNDING: The provided analysis is already verified. Use the "ABSTRACTED DNA" as your creative blueprint.
- NOUN-BLOCK: Avoid using specific objects, people, or places from the original song. Instead, use the abstract patterns provided.
- NOCTURNAL/SENSUAL IDENTITY: If the sub-genre or mood involves "Sensual", "Intimate", "Sexy RnB", "Erotic", or "Seductive" themes:
ARTIST IDENTITY: nocturnal, sensual, intimate, stylish, emotionally damaged, secretive, physically immediate, seductive, hook-driven, high-gloss, breathy vocal feel.
CORE RULE: Sound like the same ARTIST, not the same SONG. Lane is erotic tension, secrecy, temptation, dependence, possession, guilt, physical need, and the power dynamic of dominance and submission. Seductive first, dangerous second, poetic third.
MAIN GOAL: Stay in the moment. No emotional distance.
PERSPECTIVE LOCK (mandatory): Every song MUST be written from ONE of two perspectives — never both, never neutral. Choose at the start of generation and hold that choice across every section.
DOMINANT PERSPECTIVE: The narrator is the one giving commands, taking, holding, claiming, marking, controlling the pace, deciding what is given and withheld. Verbs are active and possessive. Address to the other person is directive. Sentence energy is patient, in control, deliberate. Pleasure is something the narrator administers, watches, or extracts. The narrator is never asking — they are stating, instructing, or taking.
SUBMISSIVE PERSPECTIVE: The narrator is the one offering, surrendering, begging, opening, waiting, being held, taken, marked, used, ruined. Verbs are receptive and yielding. Address to the other person is pleading, inviting, or thanking. Sentence energy is breathless, urgent, undone. Pleasure is something the narrator receives, endures, or earns by giving up control. The narrator is never commanding — they are asking, offering, or being acted upon.
If no perspective is specified externally, default to SUBMISSIVE. Do not blend the two perspectives within a single song. The narrator is one or the other for the entire track.
SEXUAL TENSION: Unmistakable body-level tension (touch, breath, pressure, restraint, mark). Chorus must be sexually direct in the chosen perspective's register — Dominant choruses are blunt commands and statements of possession; Submissive choruses are blunt pleas, offers, and surrenders. Default toward lust over metaphor.
EXPLICITNESS: Do not avoid explicit sexual phrasing or blunt intimate phrases. Profanity as sexual language, not filler. D/s vocabulary is welcome where it serves the song — holding, kneeling, marking, breath, pressure, mercy, please, take, give, mine, yours, ruined, undone — but is never costume. The dynamic must feel lived-in, not performed.
WRITING: Concrete physical details. Every section must increase desire, risk, or tension. Verses cinematic, chorus simple and physical. The chosen perspective dictates which body the camera is closest to — Dominant lyrics observe the partner's body and reactions; Submissive lyrics inhabit the narrator's own body being acted upon.
- STEERING AS DIRECTION, NOT VOCABULARY: The "ABSTRACTED DNA" fields (Environment, Motif, etc.) are your SOP (Standard Operating Procedure), NOT your word list. You MUST fulfill the functional requirement of these fields using NEW imagery and fresh language. UNLESS specifically requested, you are FORBIDDEN from using the literal words found in the Environment, Physical Motif, or Sensory Palette fields as surface lyrics. Show the effect, do not quote the brief.
- DYNAMIC CHORUS EVOLUTION: You MUST evolve the lyrics of each chorus instance to reflect emotional progression. Chorus 1 should be the setup; Chorus 2 should be more intense or shifted; Chorus 3 (final) should be the emotional climax or resolution. Lyrical repetition is the enemy of narrative weight.`;

  let promptText = `TASK: Generate a NEW, UNIQUE studio track based on the following ABSTRACTED DNA.

ABSTRACTED DNA (CREATIVE BLUEPRINT):
- Vocal Persona: ${abstractedProfile.vocalPersona}
- Emotional Tone: ${abstractedProfile.emotionalTone}
- Relationship Dynamic: ${abstractedProfile.relationshipDynamic}
- Environment Pattern: ${abstractedProfile.environment}
- Sensory Palette: ${abstractedProfile.sensoryPalette}
- Physical Motif Pattern: ${abstractedProfile.physicalMotif}
- Chorus Behavior: ${abstractedProfile.chorusBehavior}
- Lyrical Density: ${abstractedProfile.lyricalDensity}
- Lyrical DNA / Themes: ${abstractedProfile.lyricalTheme || 'None analyzed'}

Based on this blueprint, you must generate the following for a NEW song:

1. "analysis": A detailed paragraph analyzing the original song's SPIRIT (not its surface), specifically highlighting how its vocal delivery type and thematic architecture drive emotion.
2. "lyrics": A JSON array of segments where each segment has "label", "text", "explanation", and "transition". The THEME and EMOTION of these new lyrics MUST be based entirely on the abstracted patterns above.
3. "meaning": A 2-3 sentence explanation of the storyline and emotional core of these specific lyrics. Keep abstraction below 10%.
4. "title": A catchy, fitting title for the new song based on the lyrics. (IMPORTANT: The title MUST NOT be all capital letters. Use standard Title Case or Sentence Case.)
5. "prompt": A Song Description describing the musical DNA, mood, and vocal style. You MUST explicitly include all environmental and songwriter profile details (Environment, Sensory Palette, Physical Motif, Chorus Behavior, Vocal Persona) seamlessly within this prompt string. The "prompt" field MUST ONLY contain the optimized prompt text itself, no section headers or meta-analysis.
6. "styleTags": Comma-separated genres and vibes (e.g., "synthwave, 80s, dark"). MUST ONLY CONTAIN ALPHANUMERIC CHARACTERS AND SPACES. NO SPECIAL CHARACTERS LIKE & OR -.

CRITICAL CONSTRAINT: The COMBINED total length of the "prompt" and the "styleTags" fields MUST be STRICTLY less than 1000 characters.

CRITICAL JSON HYGIENE: The output MUST be a single, valid JSON object. 
- All string values (especially the 'lyrics' and 'analysis' fields) MUST have internal line breaks replaced with \\n (double backslash n).
- All internal double quotes in string values MUST be escaped as \\" (double backslash quote). 
- DO NOT use raw newlines inside string values.
- DO NOT truncate the response.

Return the result STRICTLY as a JSON object with the keys: "title", "prompt", "styleTags", "lyrics", "analysis", and "meaning".`;

  if (song.type === 'file') {
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
        analysis: data.analysis || initialAnalysis.markdown,
        meaning: data.meaning || '',
        visualPrompt: initialAnalysis.profile.visualPrompt
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

  try {
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
        safetySettings,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      },
    }));

    const jsonStr = extractJson(response.text || "{}");
    const data = safeJsonParse(jsonStr);
    
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
      analysis: data.analysis || initialAnalysis.markdown,
      meaning: data.meaning || '',
      visualPrompt: initialAnalysis.profile.visualPrompt
    };
  } catch (e) {
    console.error("Studio Track generation failed:", e);
    return {
      title: "Untitled Studio Project",
      prompt: "Balanced production, clear vocals, melodic structure.",
      styleTags: "melodic, studio, clean",
      lyrics: "[Verse 1]\nThe words are waiting in the silence...\n\n[Chorus]\nBuilding up a new direction...",
      analysis: "Full analysis was interrupted by a service error. The system has generated a generic template based on the intent.",
      meaning: "A song about recovery and starting fresh."
    };
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

Return ONLY the suggested title, without quotes or extra text. (IMPORTANT: The title MUST NOT be all capital letters. Use standard Title Case or Sentence Case.)`;

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

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings
      },
    }));

    return response.text?.trim().replace(/^["']|["']$/g, '') || "Untitled Song";
  } catch (e) {
    console.error("Title suggestion failed:", e);
    return "Untitled Vision";
  }
}

export async function translateLyrics(text: string, targetLanguage: string, config: AIConfig = { provider: 'gemini' }): Promise<string> {
  const isSnippet = text.length < 100 && !text.includes('\n');
  const context = isSnippet ? "specific phrase or line from a song" : "set of song lyrics";
  
  const prompt = `You are a professional songwriter and translator. 
Translate the following ${context} into ${targetLanguage}.

CRITICAL INSTRUCTIONS:
1. Maintain the emotional tone, poetic feel, and rhythm of the original.
2. If it's a snippet, stay true to the meter so it fits back into the song.
3. If it's full lyrics, preserve all structure labels like [Verse] or [Chorus].
4. Output ONLY the translated text. No explanations or intro.

Text to translate:
"""
${text}
"""`;

  if (config.provider === 'openrouter') {
    return await callOpenRouter(prompt, config);
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
  }));

  return response.text?.trim() || text;
}

/**
 * Generates a mood visual (album art) based on a descriptive prompt, song theme, and optional artist identity.
 */
export async function generateMoodVisual(prompt: string, artistIdentity?: string, songTheme?: string): Promise<string> {
  const isSensual = artistIdentity?.includes('nocturnal') || artistIdentity?.includes('sensual') || artistIdentity?.includes('Sexy RnB');

  const identityVisualCore = isSensual ? `
VISUAL IDENTITY: nocturnal, high-gloss, intimate, high-fashion aesthetic. 
MOOD: Heavy shadows (chiaroscuro), cinematic lighting, physical immediacy, deep shadows, rich textures (silk, leather, rain on glass, skin). 
PALETTE: Deep indigo, midnight blacks, muted gold, or crimson accents. 
FEEL: Dangerous but seductive, secretive, expensive, emotionally heavy.` : "";

  const themeContext = songTheme ? `\nSong Theme/Story: ${songTheme}` : "";

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: `Generate a high-fidelity, high-concept minimalist album art cover. 
Visual Blueprint: ${prompt}
${themeContext}
${artistIdentity ? `Artist Identity Context: ${artistIdentity}` : ''}
${identityVisualCore}
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
    }));

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
