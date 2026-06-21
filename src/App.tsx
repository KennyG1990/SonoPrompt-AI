import { useState, useCallback, useEffect } from 'react';
import { Upload, Link as LinkIcon, Music, Loader2, Sparkles, RefreshCw, AlertCircle, GitCompare, X, FileText, Wand2, Edit3, Check, LayoutDashboard, Youtube, Download, Save, Trash2, Copy, Mic, Settings, ExternalLink, ChevronDown, Search, Plus, Settings2, Library, Activity, Monitor, Radio } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAudioFile, analyzeSongLink, compareSongs, generateLyrics, rewriteLyricSegment, suggestSongTitle, ghostwriteNextLine, generateMoodVisual, abstractProfileFields, detectLyricsAndAnalyzeDNA, SongInput, LyricSegment, ExtractedProfile, AnalysisResult, AIConfig } from './services/geminiService';
import Studio from './components/Studio';
import SonicRadarChart from './components/SonicRadarChart';
import StyleJoystick from './components/StyleJoystick';
import MetricGrid from './components/MetricGrid';

export interface LyricistProfile {
  id: string;
  name: string;
  rules: string;
}

export const STYLE_LANES = [
  {
    id: 'sexy-rnb',
    name: 'Sexy RnB',
    rules: `ARTIST IDENTITY: nocturnal, sensual, intimate, stylish, emotionally damaged, secretive, physically immediate, seductive, hook-driven, high-gloss, breathy vocal feel.
LANE: erotic tension, secrecy, temptation, dependence, possession, guilt, physical need. Seductive first, dangerous second, poetic third. Stay in the moment. No emotional distance.`
  },
  {
    id: 'confessional-indie',
    name: 'Confessional Indie / Folk',
    rules: 'STYLE: Confessional Indie / Folk. PERSPECTIVE: First-person, intimate, plainspoken. Focus on specific small-scale domestic details (apartments, names of friends, specific mundane objects). ELEVATE the mundane through extreme attention. ANTI-METAPHOR: Avoid grand sweeping metaphors; prioritize emotional specificity over poetic abstraction. Tender, devastating, small, quiet, profoundly personal.'
  },
  {
    id: 'trap-drill-bars',
    name: 'Trap / Drill',
    rules: 'STYLE: Trap / Drill. STRUCTURE: High syllable density, rapid-fire delivery. RHYME: Internal rhyme schemes, multi-syllabic punches. CONTENT: Brag-flex-grief flow. Use specific brand names and location anchors for grounding. DIALECT: Slang as architecture. RHYTHMIC RULE: Punch against the beat (staccato) rather than melodic flowing. Verses perform status, pain, and territorial identity.'
  },
  {
    id: 'cinematic-synthwave',
    name: 'Synthwave',
    rules: 'STYLE: Cinematic Synthwave / Darksynth. PERSPECTIVE: Mandatory Second-person address ("You walk into the room...", "You see the lights..."). IMAGERY: Nocturnal-urban, neon, concrete, chrome, rain-slicked streets. THEMES: Time, distance, nostalgia, isolation. MOOD: Cooler distance rather than physical immediacy. Narrative over raw emotion.'
  },
  {
    id: 'spiritual-soul',
    name: 'Spiritual Soul',
    rules: 'STYLE: Gospel-Influenced Soul. IMAGERY: Sacred-secular blend. Use "body-as-temple" metaphors. THEMES: Redemption arcs, sin, salvation, burden, grace. VOCABULARY: "Lord," "save," "carry," "drown," "rise," "mercy." Call-and-response repetition. Heavy, grounded, cathartic, lung-heavy vocal energy.'
  },
  {
    id: 'hyperpop-glitch',
    name: 'Hyperpop / Glitch',
    rules: 'STYLE: Hyperpop / Glitch. SYNTAX: Fragmented sentences, broken syntax, non-linear thought patterns. VOCABULARY: Internet-speak, post-ironic phrasing. FORMATTING: Use ALL CAPS and lowercase shifts intentionally to indicate emotional whiplash. FEEL: High-energy, chaotic, short bursts of imagery. GOAL: Intentional cliché reclamation and subversion. Sound like digital overload.'
  },
  {
    id: 'country-story-song',
    name: 'Country Story-Song',
    rules: 'STYLE: Country / Americana. STRUCTURE: Linear narrative arc (Character does X, then Y, consequence Z). ANCHORING: Root the song in a specific location (highway, porch, bar, truck). CENTRAL IMAGE: Every song revolves around one concrete object. LANGUAGE: Plainspoken, blue-collar vocabulary. ELEVATE: Use exactly ONE elevated, "silver tongue" poetic line per verse.'
  },
  {
    id: 'dream-pop-shoegaze',
    name: 'Dream Pop / Shoegaze',
    rules: 'STYLE: Dream Pop / Shoegaze. IMAGERY: Abstract, washed-out, ethereal, blurry. VOCAL RULE: Vowel-heavy word choices that flow over the beat like a stream. NARRATIVE: No linear throughline or story required; prioritize mood. FUNCTION: Words are texture and instrument first, meaning second. Themes: Fading memories, light, distance, haze.'
  },
  {
    id: 'industrial-goth-wave',
    name: 'Industrial Goth / Darkwave',
    rules: 'STYLE: Industrial Goth / Darkwave. IMAGERY: Mechanical, dystopian, metallic, cold concrete, decay, bone, rust, clinical, monolithic. THEMES: Machine-human synthesis, terminal romance, submission to systems, ritual, control. VOCABULARY: Steel, ritual, burn, wire, cold, voltage, flesh. FLOW: Monotone, driving, rhythmically sharp, chants.'
  },
  {
    id: 'eccentric-art-pop',
    name: 'Eccentric Art Pop / Baroque',
    rules: 'STYLE: Eccentric Art Pop / Baroque Pop. PERSPECTIVE: Highly theatrical, erratic, intellectual. IMAGERY: Surrealism, classical architecture, museums, insects, historical relics, circus ornaments. THEMES: Intellectual anxiety, madness, high art, performative existentialism. SYNTAX: Ornately constructed, dense, shifting tempos, dramatic jumps.'
  },
  {
    id: 'grungy-alt-rock',
    name: '90s Grunge / Noise Rock',
    rules: 'STYLE: 90s Grunge / Noise Rock. PERSPECTIVE: Self-deprecating, cynical, first-person. IMAGERY: Dirt, basement-shows, cigarette smoke, cheap beer, stained flannels, rot, apathy. THEMES: Disillusionment, societal alienation, physical numbness, raw frustration. FLOW: Loud-quiet-loud dynamic. Slurred, raw, anti-polished, blunt statements.'
  },
  {
    id: 'cosmic-ambient-folk',
    name: 'Cosmic Ambient / Neo-Folk',
    rules: 'STYLE: Cosmic Ambient Folk / Neo-Folk. IMAGERY: Astrological, celestial, deep woods, bone-white light, oceans, geological time, constellations. THEMES: Intergenerational memory, cosmic insignificance, ghosts, ancient spirits. FLOW: Long, floating lines with open-vowel phrasing. Haunting, slow, majestic, ancient feel.'
  }
];

export const CRAFT_LAYERS = [
  {
    id: 'standard-songwriter',
    name: 'Standard Songwriter',
    rules: 'CRAFT: Write evocative, professional lyrics with a balance of narrative and abstract imagery. Focus on clear structures and relatable emotions.'
  },
  {
    id: 'visceral-poet',
    name: 'Visceral Poet',
    rules: 'CRAFT: Focus heavily on physical details, sensory language, and "show-don-tell". Avoid clichés at all costs. Use complex slant rhymes and avoid perfect rhymes.'
  },
  {
    id: 'spoken-word',
    name: 'Spoken Word',
    rules: 'CRAFT: Style: Spoken Word / Hip-Hop Soul. STRUCTURE: Long lines, prose-like cadence. RHYTHM: Deliberately un-singable, speech-pattern rhythm. CONTENT: Philosophical, political, or introspective. LANGUAGE: High-vocabulary, intellectual but visceral.'
  },
  {
    id: 'cryptic-mythologist',
    name: 'Cryptic Mythologist',
    rules: 'CRAFT: Cryptic Mythologist. Frame contemporary or personal events entirely through historical, classical, or occult mythology. Use allegories, ancient symbols, tarot archetypes, and folklore references instead of literal modern phrasing.'
  },
  {
    id: 'mathematical-architect',
    name: 'Mathematical Architect',
    rules: 'CRAFT: Mathematical Architect. Extreme emphasis on symmetry, nested internal rhyme structures, hard syllable counting, and complex meter. Phrases are meticulously engineered with parallel sentence patterns and precise, clockwork acoustic pairings.'
  },
  {
    id: 'stream-of-consciousness',
    name: 'Stream-of-Consciousness',
    rules: 'CRAFT: Stream of Consciousness Novelist. Write in unstructured, runaway prose blocks. Prioritize memory-hopping, parenthetical asides, run-on thoughts, and conversational interruptions. Sounds like a private diary entry spoken without taking a breath.'
  }
];

export const HEAT_MODIFIERS = [
  {
    id: 'restrained',
    name: 'Restrained',
    rules: 'HEAT: Understated, subtle, quiet, tension held back. Emotions are suggested rather than screamed. Cool distance.'
  },
  {
    id: 'standard',
    name: 'Standard',
    rules: 'HEAT: Balanced emotion, appropriate for general listening. Clear emotional arc without excessive intensity.'
  },
  {
    id: 'visceral',
    name: 'Visceral',
    rules: 'HEAT: Raw, intense, emotionally heavy, very physical. High stakes, heavy sensory load, desperate energy.'
  },
  {
    id: 'explicit',
    name: 'Explicit',
    rules: 'HEAT: Blunt, direct, unmapped, highly sexual or aggressive. Do not avoid explicit phrasing or blunt physical truth. No filter.'
  },
  {
    id: 'sub-zero-detached',
    name: 'Sub-Zero Detached',
    rules: 'HEAT: Sub-Zero Detached. Completely cool, emotionless, clinical, and deadpan delivery. The lyrics describe extreme horror, physical bliss, or devastation with the tone of an autopsy report or a technical manual. Zero self-pity or excitement.'
  },
  {
    id: 'radioactive-frenzy',
    name: 'Radioactive Frenzy',
    rules: 'HEAT: Radioactive Frenzy. Hyper-manic, screaming, deliriously unhinged. Use rapid-fire shifts, manic repetition, exclamatory disruptions, and unstable emotional peaks. The narrator sounds on the absolute edge of a breakdown or spiritual ascension.'
  }
];

export const DEFAULT_PROFILES: LyricistProfile[] = [
  {
    id: 'sexy-rnb-engine',
    name: 'Sexy RnB (Full Engine)',
    rules: `ARTIST IDENTITY: nocturnal, sensual, intimate, stylish, emotionally damaged, secretive, physically immediate, seductive, hook-driven, high-gloss, breathy vocal feel.
CORE RULE: Sound like the same ARTIST, not the same SONG. Lane is erotic tension, secrecy, temptation, dependence, possession, guilt, physical need, and the power dynamic of dominance and submission. Seductive first, dangerous second, poetic third.
MAIN GOAL: Stay in the moment. No emotional distance.
PERSPECTIVE LOCK (mandatory): Every song MUST be written from ONE of two perspectives — never both, never neutral. Choose at the start of generation and hold that choice across every section.
DOMINANT PERSPECTIVE: The narrator is the one giving commands, taking, holding, claiming, marking, controlling the pace, deciding what is given and withheld. Verbs are active and possessive. Address to the other person is directive. Sentence energy is patient, in control, deliberate. Pleasure is something the narrator administers, watches, or extracts. The narrator is never asking — they are stating, instructing, or taking.
SUBMISSIVE PERSPECTIVE: The narrator is the one offering, surrendering, begging, opening, waiting, being held, taken, marked, used, ruined. Verbs are receptive and yielding. Address to the other person is pleading, inviting, or thanking. Sentence energy is breathless, urgent, undone. Pleasure is something the narrator receives, endures, or earns by giving up control. The narrator is never commanding — they are asking, offering, or being acted upon.
If no perspective is specified externally, default to SUBMISSIVE. Do not blend the two perspectives within a single song. The narrator is one or the other for the entire track.
SEXUAL TENSION: Unmistakable body-level tension (touch, breath, pressure, restraint, mark). Chorus must be sexually direct in the chosen perspective's register — Dominant choruses are blunt commands and statements of possession; Submissive choruses are blunt pleas, offers, and surrenders. Default toward lust over metaphor.
EXPLICITNESS: Do not avoid explicit sexual phrasing or blunt intimate phrases. Profanity as sexual language, not filler. D/s vocabulary is welcome where it serves the song — holding, kneeling, marking, breath, pressure, mercy, please, take, give, mine, yours, ruined, undone — but is never costume. The dynamic must feel lived-in, not performed.
WRITING: Concrete physical details. Every section must increase desire, risk, or tension. Verses cinematic, chorus simple and physical. The chosen perspective dictates which body the camera is closest to — Dominant lyrics observe the partner's body and reactions; Submissive lyrics inhabit the narrator's own body being acted upon.`
  },
  {
    id: 'standard-songwriter-preset',
    name: 'Standard Songwriter',
    rules: 'Write evocative, professional lyrics with a balance of narrative and abstract imagery. Focus on clear structures and relatable emotions.'
  },
  {
    id: 'visceral-poet-preset',
    name: 'Visceral Poet',
    rules: 'Focus heavily on physical details, sensory language, and "show-don-tell". Avoid clichés at all costs. Use complex slant rhymes and avoid perfect rhymes.'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'compare' | 'studio' | 'youtube'>('analyze');
  
  // AI Configuration state
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('auto'); // Legacy fallback
  const [openRouterAnalysisModel, setOpenRouterAnalysisModel] = useState('auto');
  const [openRouterCreativeModel, setOpenRouterCreativeModel] = useState('auto');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  
  // Analyze & Lyrics state
  const [analyzeSong, setAnalyzeSong] = useState<SongInput | null>(null);
  const [analyzeInputType, setAnalyzeInputType] = useState<'upload' | 'link'>('link');
  const [analyzeLink, setAnalyzeLink] = useState('');
  const [lyricsTheme, setLyricsTheme] = useState('');
  const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile | null>(null);
  
  // Lyrical DNA Decryption state
  const [detectedLyrics, setDetectedLyrics] = useState<string | null>(null);
  const [lyricalDNADecryption, setLyricalDNADecryption] = useState<string | null>(null);
  const [isDetectingLyrics, setIsDetectingLyrics] = useState(false);
  
  // Layered Personality state
  const [selectedLaneId, setSelectedLaneId] = useState('confessional-indie');
  const [selectedCraftId, setSelectedCraftId] = useState('visceral-poet');
  const [selectedHeatId, setSelectedHeatId] = useState('standard');
  const [isUsingLayers, setIsUsingLayers] = useState(true);
  const [joystickBlendDescription, setJoystickBlendDescription] = useState<string | null>(null);
  const [isUsingJoystick, setIsUsingJoystick] = useState(false);

  const [lyricistPersonality, setLyricistPersonality] = useState('');
  const [profiles, setProfiles] = useState<LyricistProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<'analyze' | 'lyrics' | 'compare' | null>(null);
  const [visualAnchor, setVisualAnchor] = useState('');
  const [customStructure, setCustomStructure] = useState('');
  const [injectVocalTags, setInjectVocalTags] = useState(false);
  const [rhymeComplexity, setRhymeComplexity] = useState('default');
  const [emotionalArc, setEmotionalArc] = useState('static');
  const [instrumentalPacing, setInstrumentalPacing] = useState('default');
  const [lockSyllables, setLockSyllables] = useState(false);
  const [generatedLyrics, setGeneratedLyrics] = useState<LyricSegment[] | null>(null);
  const [lyricsExcerpt, setLyricsExcerpt] = useState<string | null>(null);
  const [lyricsPrompt, setLyricsPrompt] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState<string | null>(null);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [segmentEditValue, setSegmentEditValue] = useState('');
  const [rewritingSegmentIndex, setRewritingSegmentIndex] = useState<number | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [rewriteOptions, setRewriteOptions] = useState<string[] | null>(null);
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGhostwriting, setIsGhostwriting] = useState(false);
  const [isBoothMode, setIsBoothMode] = useState(false);
  const [moodVisualUrl, setMoodVisualUrl] = useState<string | null>(null);
  const [isGeneratingMoodVisual, setIsGeneratingMoodVisual] = useState(false);
  const [isAbstracting, setIsAbstracting] = useState(false);

  // Compare state
  const [compareSong1, setCompareSong1] = useState<SongInput | null>(null);
  const [compareSong2, setCompareSong2] = useState<SongInput | null>(null);
  const [compareInputType1, setCompareInputType1] = useState<'upload' | 'link'>('link');
  const [compareInputType2, setCompareInputType2] = useState<'upload' | 'link'>('link');
  const [compareLink1, setCompareLink1] = useState('');
  const [compareLink2, setCompareLink2] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // YouTube Downloader state
  const [ytLink, setYtLink] = useState('');
  const [ytInfo, setYtInfo] = useState<{title: string, thumbnail: string, author: string} | null>(null);
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [isDownloadingYt, setIsDownloadingYt] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lyricist-profiles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setProfiles(parsed);
        } else {
          setProfiles(DEFAULT_PROFILES);
        }
      } catch (e) {
        console.error('Failed to parse profiles', e);
        setProfiles(DEFAULT_PROFILES);
      }
    } else {
      setProfiles(DEFAULT_PROFILES);
    }

    const savedSettings = localStorage.getItem('ai-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setAiProvider(settings.provider || 'gemini');
        setOpenRouterKey(settings.openRouterKey || '');
        setOpenRouterAnalysisModel(settings.openRouterAnalysisModel || settings.openRouterModel || 'auto');
        setOpenRouterCreativeModel(settings.openRouterCreativeModel || settings.openRouterModel || 'auto');
        setOpenRouterModel(settings.openRouterModel || 'auto'); // Keep just in case
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }

    const savedSteering = localStorage.getItem('steering-settings');
    if (savedSteering) {
      try {
        const steering = JSON.parse(savedSteering);
        if (steering.extractedProfile) setExtractedProfile(steering.extractedProfile);
        if (steering.visualAnchor) setVisualAnchor(steering.visualAnchor);
        if (steering.customStructure) setCustomStructure(steering.customStructure);
        if (steering.injectVocalTags !== undefined) setInjectVocalTags(steering.injectVocalTags);
        if (steering.rhymeComplexity) setRhymeComplexity(steering.rhymeComplexity);
        if (steering.emotionalArc) setEmotionalArc(steering.emotionalArc);
        if (steering.instrumentalPacing) setInstrumentalPacing(steering.instrumentalPacing);
      } catch (e) {
        console.error('Failed to parse steering settings', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lyricist-profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('ai-settings', JSON.stringify({
      provider: aiProvider,
      openRouterKey,
      openRouterModel,
      openRouterAnalysisModel,
      openRouterCreativeModel
    }));
  }, [aiProvider, openRouterKey, openRouterModel, openRouterAnalysisModel, openRouterCreativeModel]);

  const fetchOpenRouterModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch('/api/openrouter/models');
      const data = await res.json();
      if (data.data) {
        // Sort models alphabetically
        const sortedModels = data.data.sort((a: any, b: any) => a.name?.localeCompare(b.name));
        setAvailableModels(sortedModels);
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('steering-settings', JSON.stringify({
      extractedProfile,
      visualAnchor,
      customStructure,
      injectVocalTags,
      rhymeComplexity,
      emotionalArc,
      instrumentalPacing
    }));
  }, [extractedProfile, visualAnchor, customStructure, injectVocalTags, rhymeComplexity, emotionalArc, instrumentalPacing]);

  const currentAIConfig: AIConfig = {
    provider: aiProvider,
    openRouterKey: openRouterKey || undefined,
    openRouterModel: openRouterModel || undefined,
    openRouterAnalysisModel: openRouterAnalysisModel || undefined,
    openRouterCreativeModel: openRouterCreativeModel || undefined
  };

  const handleProfileSelect = (id: string) => {
    setActiveProfileId(id);
    setIsSavingProfile(false);
    setIsUsingLayers(false);
    if (id) {
      const p = profiles.find(x => x.id === id);
      if (p) setLyricistPersonality(p.rules);
    } else {
      setLyricistPersonality(''); 
    }
  };

  const syncLayeredPersonality = (laneId: string, craftId: string, heatId: string) => {
    const lane = STYLE_LANES.find(l => l.id === laneId);
    const craft = CRAFT_LAYERS.find(c => c.id === craftId);
    const heat = HEAT_MODIFIERS.find(h => h.id === heatId);
    
    if (lane && craft && heat) {
      const combined = `${lane.rules}\n\n${craft.rules}\n\n${heat.rules}`;
      setLyricistPersonality(combined);
      setIsUsingLayers(true);
      setActiveProfileId('');
    }
  };

  // Effect to sync layers to personality when they change, but ONLY if we are in layers mode and not using joystick
  useEffect(() => {
    if (isUsingLayers && !isUsingJoystick) {
      syncLayeredPersonality(selectedLaneId, selectedCraftId, selectedHeatId);
    }
  }, [selectedLaneId, selectedCraftId, selectedHeatId, isUsingLayers, isUsingJoystick]);

  const handlePersonalityChange = (val: string) => {
    setLyricistPersonality(val);
    if (activeProfileId) {
       setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, rules: val } : p));
    }
  };

  const handleSaveNewProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: LyricistProfile = {
      id: Date.now().toString(),
      name: newProfileName.trim(),
      rules: lyricistPersonality
    };
    setProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setNewProfileName('');
    setIsSavingProfile(false);
  };

  const handleDeleteProfile = () => {
    if (activeProfileId) {
      setProfiles(prev => prev.filter(p => p.id !== activeProfileId));
      setActiveProfileId('');
      setLyricistPersonality('');
    }
  };

  const onDropAnalyze = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setAnalyzeSong({ type: 'file', file: acceptedFiles[0] });
      setError(null);
    }
  }, []);

  const onDropCompare1 = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCompareSong1({ type: 'file', file: acceptedFiles[0] });
      setError(null);
    }
  }, []);

  const onDropCompare2 = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCompareSong2({ type: 'file', file: acceptedFiles[0] });
      setError(null);
    }
  }, []);

  const dropzoneConfig = {
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
      'video/mp4': ['.mp4']
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024, // 15MB limit for inlineData
  };

  const { getRootProps: getRootPropsAnalyze, getInputProps: getInputPropsAnalyze, isDragActive: isDragActiveAnalyze } = useDropzone({
    onDrop: onDropAnalyze,
    ...dropzoneConfig
  });

  const { getRootProps: getRootPropsCompare1, getInputProps: getInputPropsCompare1, isDragActive: isDragActiveCompare1 } = useDropzone({
    onDrop: onDropCompare1,
    ...dropzoneConfig
  });

  const { getRootProps: getRootPropsCompare2, getInputProps: getInputPropsCompare2, isDragActive: isDragActiveCompare2 } = useDropzone({
    onDrop: onDropCompare2,
    ...dropzoneConfig
  });

  // Helper for syllable counting
  const countSyllables = (word: string) => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const match = word.match(/[aeiouy]{1,2}/g);
    return match ? match.length : 1;
  };

  const countLineSyllables = (line: string) => {
    return line.split(/\s+/).reduce((acc, word) => acc + countSyllables(word), 0);
  };

  const handleGhostwriteContent = async (index: number) => {
    setIsGhostwriting(true);
    try {
      const newLines = await ghostwriteNextLine(
        segmentEditValue, 
        lyricsTheme.trim() || extractedProfile?.emotionalTone || 'A song', 
        lyricistPersonality, 
        rhymeComplexity,
        currentAIConfig
      );
      const appendPrefix = segmentEditValue.endsWith('\n') ? '' : '\n';
      setSegmentEditValue(segmentEditValue + appendPrefix + newLines);
    } catch(e: any) {
      if (e.message?.includes('429')) {
        setError('The Songwriter is currently overloaded. Please wait 60 seconds and try again. (Quota Exceeded)');
      } else {
        setError(e.message || "Failed to ghostwrite next line.");
      }
    } finally {
      setIsGhostwriting(false);
    }
  };

  const handleAnalyzeAction = async (action: 'analyze' | 'lyrics' | 'compare') => {
    setError(null);
    
      if (action === 'analyze' || action === 'compare') {
      setResult(null);
      setGeneratedLyrics(null);
      setLyricsPrompt(null);
      setSongTitle(null);
      setDetectedLyrics(null);
      setLyricalDNADecryption(null);
    } else if (action === 'lyrics') {
      setGeneratedLyrics(null);
      setLyricsPrompt(null);
      setSongTitle(null);
      // Keep result intact so they can be viewed simultaneously
    }

    setError(null);
    setSuccess(null);
    setIsAnalyzing(true);
    setCurrentAction(action);

    try {
      if (action === 'analyze') {
        let s: SongInput | null = analyzeSong;
        if (analyzeInputType === 'link' && analyzeLink.trim()) {
          s = { type: 'link', link: analyzeLink.trim() };
        }
        
        if (s) {
          let analysisData: AnalysisResult;
          if (s.type === 'file') {
            analysisData = await analyzeAudioFile(s.file, currentAIConfig);
          } else {
            analysisData = await analyzeSongLink(s.link, currentAIConfig);
          }
          setResult(analysisData.markdown);
          setExtractedProfile(analysisData.profile);

          let extractedTheme = lyricsTheme;
          // Auto-populate lyrics theme from extracted profile if empty
          if (!extractedTheme && analysisData.profile && (analysisData.profile.emotionalTone || analysisData.profile.vocalPersona || analysisData.profile.lyricalTheme)) {
             extractedTheme = analysisData.profile.lyricalTheme || `Vocal Persona: ${analysisData.profile.vocalPersona} | Tone: ${analysisData.profile.emotionalTone}`;
             setLyricsTheme(extractedTheme);
          }
        } else {
          setError('Please provide a song to analyze.');
        }
      } else if (action === 'compare') {
        let s1: SongInput | null = compareSong1;
        let s2: SongInput | null = compareSong2;

        if (compareInputType1 === 'link' && compareLink1.trim()) {
          s1 = { type: 'link', link: compareLink1.trim() };
        }
        if (compareInputType2 === 'link' && compareLink2.trim()) {
          s2 = { type: 'link', link: compareLink2.trim() };
        }

        if (s1 && s2) {
          const analysis = await compareSongs(s1, s2, currentAIConfig);
          setResult(analysis);
        } else {
           setError('Please provide both songs to compare.');
        }
      } else if (action === 'lyrics') {
        let s: SongInput | null = analyzeSong;
        if (analyzeInputType === 'link' && analyzeLink.trim()) {
          s = { type: 'link', link: analyzeLink.trim() };
        }

        if (!s) {
          setError('Please provide a reference song first (Link or Upload).');
          setIsAnalyzing(false);
          setCurrentAction(null);
          return;
        }

        // If no theme provided, we use a default or the extracted profile if available
        const theme = lyricsTheme.trim() || (extractedProfile ? `A new song matching the style of ${extractedProfile.vocalPersona}` : "A new song in this style");

        const lyrics = await generateLyrics(
          s, 
          theme, 
          lyricistPersonality, 
          extractedProfile || undefined, 
          visualAnchor.trim() || undefined, 
          customStructure.trim() || undefined, 
          injectVocalTags, 
          rhymeComplexity, 
          emotionalArc, 
          instrumentalPacing,
          currentAIConfig
        );
        setGeneratedLyrics(lyrics.segments);
        setLyricsExcerpt(lyrics.excerpt || null);
        setLyricsPrompt(lyrics.prompt);
        
        // Automatically suggest title after lyrics generation
        setIsGeneratingTitle(true);
        try {
          const title = await suggestSongTitle(s, lyrics.segments, currentAIConfig);
          setSongTitle(title);
        } catch (e) {
          console.error("Failed to generate title", e);
        } finally {
          setIsGeneratingTitle(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429')) {
        setError('The Songwriter is currently overloaded. Please wait 60 seconds and try again. (Quota Exceeded)');
      } else if (msg.includes('503') || msg.includes('high demand') || msg.includes('service unavailable')) {
        setError('Gemini is currently experiencing high demand. Retrying via the engine, but you may need to wait 30 seconds and try again.');
      } else if (msg.includes('500') || msg.includes('internal error')) {
        setError('Gemini encountered an internal error. We are attempting to recover but you may need to re-submit your request.');
      } else {
        setError(msg || 'An error occurred.');
      }
    } finally {
      setIsAnalyzing(false);
      setCurrentAction(null);
    }
  };

  const handleGenerateVisual = async () => {
    if (!extractedProfile?.visualPrompt) return;
    setIsGeneratingMoodVisual(true);
    setError(null);
    try {
      const url = await generateMoodVisual(extractedProfile.visualPrompt, lyricistPersonality, lyricsTheme);
      setMoodVisualUrl(url);
    } catch (e: any) {
      setError(e.message || "Failed to generate mood visual.");
    } finally {
      setIsGeneratingMoodVisual(false);
    }
  };

  const handleReset = () => {
    setAnalyzeSong(null);
    setAnalyzeLink('');
    setCompareSong1(null);
    setCompareSong2(null);
    setCompareLink1('');
    setCompareLink2('');
    setLyricsTheme('');
    setVisualAnchor('');
    setCustomStructure('');
    setInjectVocalTags(false);
    setRhymeComplexity('default');
    setEmotionalArc('static');
    setInstrumentalPacing('default');
    setResult(null);
    setGeneratedLyrics(null);
    setLyricsExcerpt(null);
    setLyricsPrompt(null);
    setSongTitle(null);
    setError(null);
    setSuccess(null);
    setCopiedId(null);
    setRewriteOptions(null);
    setMoodVisualUrl(null);
    setExtractedProfile(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveSegmentEdit = (index: number) => {
    if (generatedLyrics) {
      const newLyrics = [...generatedLyrics];
      newLyrics[index].text = segmentEditValue;
      setGeneratedLyrics(newLyrics);
    }
    setEditingSegmentIndex(null);
  };

  const handleRegenerateSegment = async (index: number) => {
    if (!generatedLyrics) return;
    
    let s: SongInput | null = analyzeSong;
    if (analyzeInputType === 'link' && analyzeLink.trim()) {
      s = { type: 'link', link: analyzeLink.trim() };
    }
    if (!s) return;

    setRewritingSegmentIndex(index);
    setIsGeneratingRewrite(true);
    setRewriteOptions(null);
    setRewriteInstruction('Regenerate this section to be fresh, original, and lyrically compelling while strictly maintaining the flow and narrative context of the entire song.');

    try {
      const options = await rewriteLyricSegment(
        s, 
        generatedLyrics, 
        index, 
        'Regenerate this section to be fresh, original, and lyrically compelling while strictly maintaining the flow and narrative context of the entire song.', 
        lyricistPersonality, 
        lockSyllables, 
        rhymeComplexity,
        currentAIConfig
      );
      setRewriteOptions(options);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429')) {
        setError('The Songwriter is currently overloaded. Please wait 60 seconds and try again. (Quota Exceeded)');
      } else {
        setError("Failed to regenerate section.");
      }
    } finally {
      setIsGeneratingRewrite(false);
    }
  };

  const handleRewriteSegment = async (index: number) => {
    if (!generatedLyrics || !rewriteInstruction.trim()) return;
    
    let s: SongInput | null = analyzeSong;
    if (analyzeInputType === 'link' && analyzeLink.trim()) {
      s = { type: 'link', link: analyzeLink.trim() };
    }
    if (!s) return;

    setIsGeneratingRewrite(true);
    setRewriteOptions(null);

    try {
      const options = await rewriteLyricSegment(
        s, 
        generatedLyrics, 
        index, 
        rewriteInstruction.trim(), 
        lyricistPersonality, 
        lockSyllables, 
        rhymeComplexity,
        currentAIConfig
      );
      setRewriteOptions(options);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429')) {
        setError('The Songwriter is currently overloaded. Please wait 60 seconds and try again. (Quota Exceeded)');
      } else {
        setError("Failed to generate rewrite options.");
      }
    } finally {
      setIsGeneratingRewrite(false);
    }
  };

  const commitRewriteOption = (index: number, chosenText: string) => {
    if (!generatedLyrics) return;
    const updatedLyrics = [...generatedLyrics];
    updatedLyrics[index].text = chosenText;
    setGeneratedLyrics(updatedLyrics);
    setRewritingSegmentIndex(null);
    setRewriteInstruction('');
    setRewriteOptions(null);
  };

  const handleRegenerateTitle = async () => {
    if (!generatedLyrics) return;
    let s: SongInput | null = analyzeSong;
    if (analyzeInputType === 'link' && analyzeLink.trim()) {
      s = { type: 'link', link: analyzeLink.trim() };
    }
    if (!s) return;

    setIsGeneratingTitle(true);
    try {
      const title = await suggestSongTitle(s, generatedLyrics, currentAIConfig);
      setSongTitle(title);
    } catch (e) {
      console.error("Failed to generate title", e);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const [isExpertSettingsOpen, setIsExpertSettingsOpen] = useState(false);

  const handleFetchYtInfo = async () => {
    if (!ytLink.trim()) return;
    setIsFetchingYt(true);
    setError(null);
    setYtInfo(null);
    try {
      const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(ytLink.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch YouTube info');
      }
      const data = await res.json();
      setYtInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFetchingYt(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingInfo, setRecordingInfo] = useState<{ title: string, author: string } | null>(null);

  const handleDownloadYt = async () => {
    if (!ytLink.trim()) return;
    setIsDownloading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const checkRes = await fetch(`/api/youtube/info?url=${encodeURIComponent(ytLink.trim())}`);
      if (!checkRes.ok) throw new Error("Song not found or inaccessible.");
      const info = await checkRes.json();
      
      const safeTitle = (info.title || 'song').replace(/[/\\?%*:|"<>]/g, '-');
      const downloadUrl = `/api/youtube/download?url=${encodeURIComponent(ytLink.trim())}`;
      
      // Trigger Direct Server Extraction (Fast)
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${safeTitle}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(`Direct Studio Extraction initiated for "${info.title}". Check your downloads.`);
    } catch (err: any) {
      setError(`Extraction Failed: ${err.message}. Try another song.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCaptureLive = async () => {
    if (!ytLink.trim()) return;
    setIsDownloading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const checkRes = await fetch(`/api/youtube/info?url=${encodeURIComponent(ytLink.trim())}`);
      if (!checkRes.ok) throw new Error("Song not found.");
      const info = await checkRes.json();
      
      if (info.streamUrl) {
        setRecordingInfo({ title: info.title, author: info.author });
        startRecording(info.streamUrl, info.title);
      } else {
        // One last attempt: maybe we can get it manually now
        const retryRes = await fetch(`/api/youtube/info?url=${encodeURIComponent(ytLink.trim())}`);
        const retryInfo = await retryRes.json();
        if (retryInfo.streamUrl) {
           setRecordingInfo({ title: retryInfo.title, author: retryInfo.author });
           startRecording(retryInfo.streamUrl, retryInfo.title);
        } else {
           throw new Error("Extreme YouTube throttling detected. Live stream capture is temporarily locked. Try Direct Studio Extraction instead.");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const startRecording = async (streamUrl: string, title: string) => {
    setIsRecording(true);
    setRecordingProgress(0);
    setAudioLevel(0);
    
    try {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = `/api/youtube/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaElementSource(audio);
      const destination = audioCtx.createMediaStreamDestination();
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      source.connect(destination);
      source.connect(audioCtx.destination); 

      let isCaptured = true;
      const updateSignal = () => {
        if (!isCaptured || audioCtx.state === 'closed') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const level = sum / bufferLength;
        setAudioLevel(level);
        requestAnimationFrame(updateSignal);
      };
      updateSignal();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/ogg;codecs=opus';
        
      const recorder = new MediaRecorder(destination.stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const finalizeRecording = () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        audio.pause();
        audioCtx.close();
        isCaptured = false;
      };

      recorder.onstop = () => {
        isCaptured = false;
        setAudioLevel(0);
        if (chunks.length === 0 || chunks[0].size < 1000) {
          setError("Silent Capture: No audio data detected in the stream. Try Direct Studio Extraction.");
          setIsRecording(false);
          setRecordingInfo(null);
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-') || 'studio-extract';
        a.download = `${safeTitle}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setIsRecording(false);
        setRecordingInfo(null);
        setSuccess(`" ${title} " captured and saved to your device.`);
      };

      audio.onplay = () => {
        recorder.start(1000); 
        
        setTimeout(() => {
          if (audioLevel < 0.5 && isRecording) {
            setError("Low Signal: The stream seems to be silent. This is likely a YouTube CDN block.");
          }
        }, 8000);
      };

      audio.onerror = (e) => {
        setError("Stream Failed: YouTube blocked this specific CDN server. Try another track.");
        if (recorder.state === 'recording') recorder.stop();
      };

      audio.ontimeupdate = () => {
        if (audio.duration && audio.duration !== Infinity) {
          setRecordingProgress((audio.currentTime / audio.duration) * 100);
        } else {
          setRecordingProgress(prev => (prev + 0.05) % 100);
        }
      };

      audio.onended = () => {
        finalizeRecording();
      };

      // Expose manual stop
      (window as any).stopStudioRecording = finalizeRecording;

      await audio.play();
    } catch (err: any) {
      console.error("Recording error:", err);
      setError("Failed to start stream recorder. Using fallback...");
      setIsRecording(false);
    }
  };

  const updateProfileField = (key: keyof ExtractedProfile, value: string) => {
    setExtractedProfile(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleAbstractDNA = async () => {
    if (!extractedProfile) return;
    setIsAbstracting(true);
    setError(null);
    try {
      const abstracted = await abstractProfileFields(extractedProfile, currentAIConfig);
      setExtractedProfile(abstracted);
      setSuccess("Creative DNA has been successfully abstracted into deep patterns.");
    } catch (e: any) {
      setError(e.message || "Failed to abstract Creative DNA.");
    } finally {
      setIsAbstracting(false);
    }
  };

  const handleDetectLyricalDNA = async () => {
    let s: SongInput | null = analyzeSong;
    if (analyzeInputType === 'link' && analyzeLink.trim()) {
      s = { type: 'link', link: analyzeLink.trim() };
    }

    if (!s) {
      setError("Please provide a song to analyze (Link or Upload) first.");
      return;
    }

    setIsDetectingLyrics(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await detectLyricsAndAnalyzeDNA(s, currentAIConfig);
      setDetectedLyrics(data.lyrics);
      setLyricalDNADecryption(data.lyricalDNA);
      setSuccess("Lyrical DNA successfully decrypted and original lyrics retrieved!");
    } catch (e: any) {
      setError(e.message || "Failed to detect lyrics and analyze creative lyrical DNA.");
    } finally {
      setIsDetectingLyrics(false);
    }
  };

  const renderInputSelector = (
    label: string,
    song: SongInput | null,
    inputType: 'upload' | 'link',
    setInputType: (type: 'upload' | 'link') => void,
    linkValue: string,
    setLinkValue: (val: string) => void,
    getRootProps: any,
    getInputProps: any,
    isDragActive: boolean,
    onRemoveFile: () => void
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-zinc-300">
            {label}
          </label>
          <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setInputType('link')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                inputType === 'link' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Link
            </button>
            <button
              onClick={() => setInputType('upload')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                inputType === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Upload
            </button>
          </div>
        </div>

        {inputType === 'link' ? (
          <input
            type="text"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="e.g., 'Bohemian Rhapsody' or YouTube link"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
        ) : (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 
              (song && song.type === 'file') ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
            }`}
          >
            <input {...getInputProps()} />
            {(song && song.type === 'file') ? (
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="font-medium text-zinc-200 truncate text-sm">{song.file.name}</p>
                  <p className="text-xs text-zinc-500">{(song.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(); }}
                  className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-5 h-5 text-zinc-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-zinc-300">Drop audio or video file</p>
                  <p className="text-xs text-zinc-500">MP3, WAV, MP4 up to 15MB</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px] transition-all duration-1000" />
        <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/[0.03]">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleReset()}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform rotate-2">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SonoPrompt <span className="text-indigo-400 font-black text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded-full tracking-widest uppercase">Elite</span>
              </h1>
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] -mt-1">Creative AI Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setIsSettingsOpen(true);
                if (availableModels.length === 0) fetchOpenRouterModels();
              }}
              className="p-2 text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group"
              title="AI Settings"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Settings</span>
            </button>
            <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block"></div>
            <a href="https://sonoteller.ai" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block">
              V.0.4.2
            </a>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">AI Configuration</h2>
                  <p className="text-xs text-zinc-500 mt-1">Select your preferred AI provider and models.</p>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                {/* Provider Toggle */}
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">AI Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAiProvider('gemini')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        aiProvider === 'gemini' 
                          ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      <Sparkles className={`w-6 h-6 ${aiProvider === 'gemini' ? 'text-indigo-400' : 'text-zinc-600'}`} />
                      <span className="text-sm font-medium">Gemini API</span>
                    </button>
                    <button
                      onClick={() => setAiProvider('openrouter')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        aiProvider === 'openrouter' 
                          ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      <ExternalLink className={`w-6 h-6 ${aiProvider === 'openrouter' ? 'text-indigo-400' : 'text-zinc-600'}`} />
                      <span className="text-sm font-medium">OpenRouter</span>
                    </button>
                  </div>
                </div>

                {aiProvider === 'openrouter' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">OpenRouter API Key</label>
                      <input
                        type="password"
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Keys are stored locally in your browser.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Model Selection</label>
                        <button 
                          onClick={fetchOpenRouterModels}
                          disabled={isFetchingModels}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                        >
                          {isFetchingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Refresh Models
                        </button>
                      </div>

                      {/* Analysis Model */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Analysis & Context Tasks</label>
                        <p className="text-[10px] text-zinc-600 mb-2">Used for analyzing audio, parsing links, comparing songs, and structuring data.</p>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                            <Search className="w-4 h-4" />
                          </div>
                          <input
                            list="openrouter-models"
                            value={openRouterAnalysisModel}
                            onChange={(e) => setOpenRouterAnalysisModel(e.target.value)}
                            placeholder="auto (gemini-3-flash-preview)"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">
                          Selected: <span className="text-zinc-400">{openRouterAnalysisModel === 'auto' ? 'google/gemini-3-flash-preview' : openRouterAnalysisModel}</span>
                        </p>
                      </div>

                      {/* Creative Model */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Creative & Generative Tasks</label>
                        <p className="text-[10px] text-zinc-600 mb-2">Used for writing lyrics, punch-in rewrites, ghostwriting, and titling.</p>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                            <Search className="w-4 h-4" />
                          </div>
                          <input
                            list="openrouter-models"
                            value={openRouterCreativeModel}
                            onChange={(e) => setOpenRouterCreativeModel(e.target.value)}
                            placeholder="auto (claude-3.7-sonnet)"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">
                          Selected: <span className="text-zinc-400">{openRouterCreativeModel === 'auto' ? 'anthropic/claude-3.7-sonnet' : openRouterCreativeModel}</span>
                        </p>
                      </div>

                      <datalist id="openrouter-models">
                        <option value="auto">Auto (Use default model for this task type)</option>
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                      </datalist>
                    </div>
                  </motion.div>
                )}

                {aiProvider === 'gemini' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl"
                  >
                    <p className="text-sm text-indigo-300">
                      Using the default <span className="font-semibold text-white">Gemini 3 Flash</span> models directly via the frontend SDK.
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
                >
                  Apply Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-[1440px] mx-auto px-6 py-16">
        <div className="text-center mb-16 relative">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-[80px]" />
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent leading-tight">
            Decode the Sonic DNA <br /> of any master record.
          </h1>
          <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto font-medium">
            Analyze structures, extract vocal personas, and transform references into refined creative prompts.
          </p>
        </div>

        <div className="mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-2 flex flex-wrap gap-2 max-w-3xl mx-auto">
            <button
              onClick={() => setActiveTab('analyze')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'analyze' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Analyze & Lyrics
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'compare' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              Compare
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'studio' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Studio
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'youtube' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Youtube className="w-4 h-4" />
              YT Downloader
            </button>
          </div>
        </div>

        <div className={activeTab === 'studio' ? "block -mx-6 lg:mx-0 h-[calc(100vh-140px)]" : "hidden"}>
          <Studio aiConfig={currentAIConfig} />
        </div>

        <div className={activeTab !== 'studio' ? "grid grid-cols-1 lg:grid-cols-12 gap-12" : "hidden"}>
          {/* Input Section */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-zinc-900/40 border border-white/[0.03] rounded-[32px] p-8 min-h-[300px] flex flex-col shadow-2xl glass-card">
              <div className={activeTab === 'analyze' ? 'flex-1 flex flex-col justify-center gap-8' : 'hidden'}>
                {renderInputSelector(
                  "Song (Upload or Link)", analyzeSong, analyzeInputType, setAnalyzeInputType, analyzeLink, setAnalyzeLink,
                  getRootPropsAnalyze, getInputPropsAnalyze, isDragActiveAnalyze, () => setAnalyzeSong(null)
                )}
                
                <div className="space-y-4">
                  <label htmlFor="lyrics-theme" className="block text-sm font-medium text-zinc-300">
                    Theme or Mood (Optional, for Lyrics)
                  </label>
                  <input
                    id="lyrics-theme"
                    type="text"
                    value={lyricsTheme}
                    onChange={(e) => setLyricsTheme(e.target.value)}
                    placeholder="e.g., 'A bittersweet breakup in the rain' or 'Cyberpunk rebellion'"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <label htmlFor="lyricist-personality" className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-indigo-400" /> Lyricist Style Engine
                    </label>

                    {/* Mode switcher for blending */}
                    <div className="flex bg-zinc-950 p-1 rounded-lg gap-1 border border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => { setIsUsingJoystick(false); setIsUsingLayers(true); }}
                        className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all ${!isUsingJoystick ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        id="tab-discrete-layers"
                      >
                        Discrete
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsUsingJoystick(true); setIsUsingLayers(false); }}
                        className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all ${isUsingJoystick ? 'bg-indigo-600/15 text-indigo-400 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        id="tab-joystick-layers"
                      >
                        Joystick
                      </button>
                    </div>
                  </div>
                  
                  {/* Layered Preset Selectors or Joystick Control */}
                  {!isUsingJoystick ? (
                    <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Lane (Identity)</label>
                          <select 
                            value={selectedLaneId}
                            onChange={(e) => {
                              setSelectedLaneId(e.target.value);
                              setIsUsingLayers(true);
                            }}
                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500 font-bold uppercase tracking-tight"
                          >
                            {STYLE_LANES.map(lane => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Craft (Technique)</label>
                          <select 
                            value={selectedCraftId}
                            onChange={(e) => {
                              setSelectedCraftId(e.target.value);
                              setIsUsingLayers(true);
                            }}
                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500 font-bold uppercase tracking-tight"
                          >
                            {CRAFT_LAYERS.map(craft => <option key={craft.id} value={craft.id}>{craft.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Heat (Intensity)</label>
                          <select 
                            value={selectedHeatId}
                            onChange={(e) => {
                              setSelectedHeatId(e.target.value);
                              setIsUsingLayers(true);
                            }}
                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500 font-bold uppercase tracking-tight"
                          >
                            {HEAT_MODIFIERS.map(heat => <option key={heat.id} value={heat.id}>{heat.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <StyleJoystick
                        onStyleBlend={(desc, rules) => {
                          setJoystickBlendDescription(desc);
                          setLyricistPersonality(rules);
                          setActiveProfileId('');
                        }}
                      />
                      {joystickBlendDescription && (
                        <div className="mt-2 px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[8.5px] font-mono text-indigo-400 uppercase tracking-wider text-center">
                          {joystickBlendDescription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Persona Profile Selection (User Saved Profiles) */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {profiles.length > 0 && (
                      <div className="w-full mb-1">
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Standalone Presets</span>
                      </div>
                    )}
                    {profiles.map(profile => (
                      <button
                        key={profile.id}
                        onClick={() => handleProfileSelect(profile.id)}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                          activeProfileId === profile.id 
                            ? 'bg-white text-black border-white shadow-xl' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                      >
                        {profile.name}
                      </button>
                    ))}
                    {!isSavingProfile ? (
                      <button
                        onClick={() => setIsSavingProfile(true)}
                        disabled={!lyricistPersonality.trim()}
                        className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-zinc-950 border border-zinc-800 text-zinc-600 hover:text-indigo-400 transition-all flex items-center gap-2 disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" /> NEW ENGINE
                      </button>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded-xl border border-indigo-500 shadow-lg shadow-indigo-500/20"
                      >
                        <input
                          type="text"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          placeholder="Name..."
                          className="bg-transparent border-none px-0 py-0.5 text-[10px] text-white focus:ring-0 w-20 font-bold uppercase"
                          autoFocus
                        />
                        <button onClick={handleSaveNewProfile} disabled={!newProfileName.trim()} className="text-white hover:text-indigo-400">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setIsSavingProfile(false)} className="text-zinc-600 hover:text-white">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </div>

                  <textarea
                    id="lyricist-personality"
                    value={lyricistPersonality}
                    onChange={(e) => handlePersonalityChange(e.target.value)}
                    placeholder={activeProfileId ? "Refine your creative rules..." : "e.g., 'Write like a noir detective. Cinematic imagery. No rhyming metaphors.'"}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-200 placeholder:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[120px] custom-scrollbar shadow-inner"
                  />
                </div>
                
                  {/* Expert Settings / Songwriter Profile Options */}
                  <div className="space-y-4 border-t border-zinc-800/50 pt-8 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-400">
                          <Settings2 className="w-4 h-4" />
                        </div>
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Creative DNA Engine</h3>
                      </div>
                      
                      {extractedProfile && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleDetectLyricalDNA}
                            disabled={isDetectingLyrics}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest disabled:opacity-50"
                          >
                            {isDetectingLyrics ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                            )}
                            Decrypt Lyrics DNA
                          </button>

                          <button
                            onClick={handleAbstractDNA}
                            disabled={isAbstracting}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[9px] font-black text-indigo-400 hover:text-white hover:border-indigo-500/50 transition-all uppercase tracking-widest disabled:opacity-50 group"
                          >
                            {isAbstracting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <GitCompare className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                            )}
                            Abstraction Pass
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Rhyme Scheme</label>
                          <select 
                            value={rhymeComplexity} 
                            onChange={(e) => setRhymeComplexity(e.target.value)}
                            className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 appearance-none font-bold"
                          >
                            <option value="default">NATURAL (AABB/ABAB)</option>
                            <option value="slant">MODERN / SLANT RHYME</option>
                            <option value="multi">COMPLEX / MULTI-SYLLABIC</option>
                            <option value="narrative">FREE VERSE / NARRATIVE</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Emotional Arc</label>
                          <select 
                            value={emotionalArc} 
                            onChange={(e) => setEmotionalArc(e.target.value)}
                            className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 appearance-none font-bold"
                          >
                            <option value="static">STATIC (STABLE)</option>
                            <option value="upward">UPWARD ARC (CLIMAX)</option>
                            <option value="downward">DOWNWARD SPIRAL</option>
                            <option value="waves">WAVES (OSCILLATING)</option>
                            <option value="climax">CENTERED CLIMAX</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Instrumental Pacing</label>
                          <select 
                            value={instrumentalPacing} 
                            onChange={(e) => setInstrumentalPacing(e.target.value)}
                            className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 appearance-none font-bold"
                          >
                            <option value="default">STANDARD</option>
                            <option value="balanced">BALANCED BREAKS</option>
                            <option value="cinematic">CINEMATIC / SPACIOUS</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Audio Tags</label>
                          <button
                            onClick={() => setInjectVocalTags(!injectVocalTags)}
                            className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-black transition-all border ${
                              injectVocalTags 
                                ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                                : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                            }`}
                          >
                            {injectVocalTags ? 'TAG_ENGINE_ON' : 'TAG_ENGINE_OFF'}
                          </button>
                        </div>
                      </div>

                      {extractedProfile ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Vocal Persona</label>
                              <input type="text" value={extractedProfile.vocalPersona} onChange={(e) => updateProfileField('vocalPersona', e.target.value)} className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Emotional Tone</label>
                              <input type="text" value={extractedProfile.emotionalTone} onChange={(e) => updateProfileField('emotionalTone', e.target.value)} className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Relationship</label>
                              <input type="text" value={extractedProfile.relationshipDynamic || ''} onChange={(e) => updateProfileField('relationshipDynamic', e.target.value)} placeholder="Tension, intimacy..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Lyrical Density</label>
                              <input type="text" value={extractedProfile.lyricalDensity || ''} onChange={(e) => updateProfileField('lyricalDensity', e.target.value)} placeholder="Sparse, dense..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Environment</label>
                              <input type="text" value={extractedProfile.environment || ''} onChange={(e) => updateProfileField('environment', e.target.value)} placeholder="Neon-drenched hallway..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Sensory Palette</label>
                              <input type="text" value={extractedProfile.sensoryPalette || ''} onChange={(e) => updateProfileField('sensoryPalette', e.target.value)} placeholder="Ozone, cold rain..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Physical Motif</label>
                              <input type="text" value={extractedProfile.physicalMotif || ''} onChange={(e) => updateProfileField('physicalMotif', e.target.value)} placeholder="Broken glass, leather..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Chorus Behavior</label>
                              <input type="text" value={extractedProfile.chorusBehavior || ''} onChange={(e) => updateProfileField('chorusBehavior', e.target.value)} placeholder="Blunt, direct..." className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                          </div>

                          <div className="space-y-2">
                             <div className="flex items-center justify-between pl-1">
                               <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest">Lyrical DNA / Themes</label>
                               <button
                                 type="button"
                                 onClick={handleDetectLyricalDNA}
                                 disabled={isDetectingLyrics}
                                 className="flex items-center gap-1 text-[8px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                               >
                                 {isDetectingLyrics ? (
                                   <>
                                     <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                     Decrypting...
                                   </>
                                 ) : (
                                   <>
                                     <Sparkles className="w-2.5 h-2.5" />
                                     Decrypt Lyrics DNA
                                   </>
                                 )}
                               </button>
                             </div>
                             <textarea 
                               value={extractedProfile.lyricalTheme || ''} 
                               onChange={(e) => updateProfileField('lyricalTheme', e.target.value)} 
                               placeholder="Thematic analysis..." 
                               className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors min-h-[80px]"
                             />
                           </div>
                        </>
                      ) : (
                        <div className="p-6 border border-dashed border-zinc-800 rounded-2xl text-center">
                          <p className="text-xs text-zinc-500 mb-4 font-bold uppercase tracking-widest">No Lyrical DNA Extracted</p>
                          <button
                            onClick={() => setExtractedProfile({
                              vocalPersona: "New Artist",
                              emotionalTone: "Nuanced",
                              relationshipDynamic: "Complex",
                              lyricalDensity: "Balanced",
                              environment: "",
                              sensoryPalette: "",
                              physicalMotif: "",
                              chorusBehavior: "",
                              lyricalTheme: "",
                              sonicDNA: { energy: 50, rhythmicComplexity: 50, emotionalDarkness: 50, vocalClarity: 50, productionPolish: 50 },
                              visualPrompt: "",
                              musicalPrompt: "",
                              stylePrompt: ""
                            })}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 px-6 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest"
                          >
                            Initialize Studio DNA
                          </button>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Visual Anchor / Seed Object</label>
                          <input 
                            type="text" 
                            value={visualAnchor} 
                            onChange={(e) => setVisualAnchor(e.target.value)} 
                            placeholder="e.g., 'A cracked iPhone screen', 'A single red balloon'" 
                            className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Structural Blueprint</label>
                          <input 
                            type="text" 
                            value={customStructure} 
                            onChange={(e) => setCustomStructure(e.target.value)} 
                            placeholder="e.g., '[Intro], [Verse 1], [Beat Drop], [Chorus]'" 
                            className="w-full bg-zinc-950/30 border border-zinc-800/80 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={activeTab === 'compare' ? 'flex-1 flex flex-col justify-center gap-6' : 'hidden'}>
                {renderInputSelector(
                  "Song 1 (Target Sound)", compareSong1, compareInputType1, setCompareInputType1, compareLink1, setCompareLink1,
                  getRootPropsCompare1, getInputPropsCompare1, isDragActiveCompare1, () => setCompareSong1(null)
                )}
                
                <div className="relative flex items-center justify-center py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative bg-zinc-900/50 px-4 text-xs font-medium text-zinc-500 uppercase tracking-widest">
                    VS
                  </div>
                </div>

                {renderInputSelector(
                  "Song 2 (Current Sound)", compareSong2, compareInputType2, setCompareInputType2, compareLink2, setCompareLink2,
                  getRootPropsCompare2, getInputPropsCompare2, isDragActiveCompare2, () => setCompareSong2(null)
                )}
              </div>

              <div className={activeTab === 'youtube' ? 'flex-1 flex flex-col justify-center gap-6' : 'hidden'}>
                <div className="space-y-4">
                  <label htmlFor="yt-link" className="block text-sm font-medium text-zinc-300">
                    YouTube Video Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="yt-link"
                      type="text"
                      value={ytLink}
                      onChange={(e) => setYtLink(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                    <button
                      onClick={handleFetchYtInfo}
                      disabled={!ytLink.trim() || isFetchingYt}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                    >
                      {isFetchingYt ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Fetch Info'}
                    </button>
                  </div>
                </div>

                {ytInfo && (
                  <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 flex gap-4 items-center">
                    {ytInfo.thumbnail && (
                      <img src={ytInfo.thumbnail} alt={ytInfo.title} className="w-24 h-auto rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-zinc-200 font-medium truncate">{ytInfo.title}</h3>
                      <p className="text-zinc-500 text-sm truncate">{ytInfo.author}</p>
                    </div>
                    <div className="flex gap-2">
                       <button
                        onClick={handleCaptureLive}
                        disabled={isDownloading || isRecording}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 p-4 rounded-2xl border border-zinc-800 transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                        title="Real-Time Stream Capture"
                      >
                        <Radio className="w-6 h-6" />
                      </button>
                      <button
                        onClick={handleDownloadYt}
                        disabled={isDownloading || isRecording}
                        className="bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white p-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                        title="Direct Studio Extraction"
                      >
                        {isDownloading || isRecording ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>
                )}

                {isRecording && recordingInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Studio Recording</p>
                        <p className="text-sm font-bold text-white truncate max-w-[200px]">{recordingInfo.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE CAPTURE</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase">
                        <span>Playback Progress</span>
                        <span>{recordingProgress.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${recordingProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase">
                        <span>Signal Integrity</span>
                        <span className={audioLevel > 5 ? "text-emerald-500" : "text-amber-500"}>
                          {audioLevel > 5 ? "ACTIVE SIGNAL" : "NO SIGNAL DETECTED"}
                        </span>
                      </div>
                      <div className="h-3 flex items-end gap-0.5 bg-zinc-900/50 p-0.5 rounded-lg overflow-hidden">
                        {[...Array(24)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="flex-1 bg-indigo-400/30 rounded-t-sm"
                            animate={{ 
                              height: `${Math.max(10, (audioLevel / 100) * (60 + Math.random() * 40))}%`,
                              backgroundColor: audioLevel > 5 ? 'rgb(129, 140, 248)' : 'rgba(129, 140, 248, 0.1)'
                            }}
                            transition={{ duration: 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-[9px] text-zinc-500 text-center font-bold">
                      DO NOT CLOSE THIS TAB. Audio is being captured in real-time.
                    </p>

                    <button
                      onClick={() => (window as any).stopStudioRecording?.()}
                      className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Finalize & Save Recording
                    </button>
                  </motion.div>
                )}
              </div>

              {activeTab === 'analyze' && (
                <div className="mt-6 flex flex-col gap-3">
                  {!extractedProfile ? (
                    <button
                      onClick={() => handleAnalyzeAction('analyze')}
                      disabled={
                        isAnalyzing || 
                        (analyzeInputType === 'link' && !analyzeLink.trim()) || 
                        (analyzeInputType === 'upload' && !analyzeSong)
                      }
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isAnalyzing && currentAction === 'analyze' ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" /> Step 1: Extract Musical DNA</>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleAnalyzeAction('analyze')}
                        disabled={
                          isAnalyzing || 
                          (analyzeInputType === 'link' && !analyzeLink.trim()) || 
                          (analyzeInputType === 'upload' && !analyzeSong)
                        }
                        className="flex-[0.5] bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isAnalyzing && currentAction === 'analyze' ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        Re-Analyze
                      </button>
                      <button
                        onClick={() => handleAnalyzeAction('lyrics')}
                        disabled={
                          isAnalyzing || 
                          (!lyricsTheme.trim() && !extractedProfile)
                        }
                        className="flex-[1.5] bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isAnalyzing && currentAction === 'lyrics' ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                        ) : (
                          <><FileText className="w-5 h-5" /> Step 3: Generate Lyrics</>
                        )}
                      </button>
                    </div>
                  )}
                  {extractedProfile && !lyricsTheme.trim() && (
                     <button
                        onClick={() => handleAnalyzeAction('lyrics')}
                        disabled={
                          isAnalyzing || 
                          (analyzeInputType === 'link' && !analyzeLink.trim()) || 
                          (analyzeInputType === 'upload' && !analyzeSong)
                        }
                        className="hidden" // Hiding the old secondary button since it's merged above
                      >
                      </button>
                  )}
                </div>
              )}
              {activeTab === 'compare' && (
                <div className="mt-6">
                  <button
                    onClick={() => handleAnalyzeAction('compare')}
                    disabled={
                      isAnalyzing || 
                      (compareInputType1 === 'link' && !compareLink1.trim()) || (compareInputType1 === 'upload' && !compareSong1) ||
                      (compareInputType2 === 'link' && !compareLink2.trim()) || (compareInputType2 === 'upload' && !compareSong2)
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAnalyzing && currentAction === 'compare' ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Comparing...</>
                    ) : (
                      <><GitCompare className="w-5 h-5" /> Compare Songs</>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-400 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 text-emerald-400 text-[11px] font-bold"
                  >
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <p>{success}</p>
                  </motion.div>
                )}
          </div>

          {/* Result Section */}
          <div className="lg:col-span-8 space-y-12">
            {!isAnalyzing && !generatedLyrics && !result ? (
               <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-900 rounded-[48px] p-12 text-center group bg-zinc-950/20 glass-card">
                 <div className="w-24 h-24 rounded-[32px] bg-zinc-900 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700 border border-white/[0.03] shadow-2xl relative">
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-[32px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Music className="w-10 h-10 text-zinc-700 relative z-10" />
                 </div>
                 <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase leading-none">Awaiting Signal</h2>
                 <p className="text-zinc-500 max-w-sm mx-auto font-medium text-sm leading-relaxed">
                   Provide a song reference or lyrical theme to hydrate the creative pipeline.
                 </p>
               </div>
            ) : (
              <div className="space-y-16 pb-24">
                {isAnalyzing ? (
                  <div className="h-[500px] flex flex-col items-center justify-center space-y-8 bg-zinc-900/20 border border-white/[0.03] rounded-[48px] glass-card">
                    <div className="relative">
                      <div className="w-24 h-24 border-2 border-zinc-900 rounded-full"></div>
                      <div className="w-24 h-24 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0 shadow-[0_0_30px_rgba(99,102,241,0.3)]"></div>
                    </div>
                    <div className="text-center space-y-2">
                       <p className="text-sm font-black text-white uppercase tracking-[0.4em] animate-pulse">
                         {currentAction === 'compare' ? 'Syncing DNA' : currentAction === 'lyrics' ? 'Drafting Score' : 'Deconstructing Signal'}
                       </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-16 animate-in fade-in duration-1000">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-indigo-400 border border-indigo-500/10 shadow-inner">
                           {generatedLyrics && !result ? <FileText className="w-7 h-7" /> : <Library className="w-7 h-7" />}
                        </div>
                        <div>
                          <h2 className="text-3xl font-black text-white tracking-tighter leading-none">
                            {generatedLyrics && !result ? 'LYRIC OPS' : generatedLyrics && result ? 'STUDIO DUMP' : 'SONIC REPORT'}
                          </h2>
                          <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.3em] font-black">Ref: {songTitle || 'External Signal'}</p>
                        </div>
                      </div>
                      <button onClick={handleReset} className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest border border-zinc-900 transition-all active:scale-95">Reset Session</button>
                    </div>
                    {/* Dashboard Modules */}
                    <div className="space-y-16">
                      {/* Analysis Block */}
                      {result && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] p-12 glass-card shadow-3xl relative group overflow-hidden"
                        >
                           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -mr-32 -mt-32" />
                           <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleCopy(result, 'report')}
                              className="p-3 bg-zinc-950 border border-zinc-900 rounded-[20px] text-zinc-600 hover:text-indigo-400 transition-all shadow-xl"
                            >
                              {copiedId === 'report' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                          <div className="prose prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-indigo-400 lg:prose-xl font-medium text-zinc-300">
                             <ReactMarkdown>{result}</ReactMarkdown>
                          </div>
                        </motion.div>
                      )}

                      {/* Visual Content Block */}
                      {extractedProfile?.sonicDNA && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                          <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] p-10 glass-card"
                          >
                            <div className="flex items-center gap-4 mb-10">
                              <div className="w-12 h-12 rounded-2xl bg-orange-500/5 flex items-center justify-center text-orange-400 border border-orange-500/10">
                                <Activity className="w-6 h-6" />
                              </div>
                              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Sonic Signature</h3>
                            </div>
                            <div className="aspect-square flex items-center justify-center">
                              <SonicRadarChart data={extractedProfile.sonicDNA} />
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] p-10 glass-card flex flex-col"
                          >
                             <div className="flex items-center gap-4 mb-10">
                              <div className="w-12 h-12 rounded-2xl bg-purple-500/5 flex items-center justify-center text-purple-400 border border-purple-500/10">
                                <Monitor className="w-6 h-6" />
                              </div>
                              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Visual DNA</h3>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center gap-6 min-h-[380px]">
                              {!moodVisualUrl ? (
                                <div className="flex-1 bg-zinc-950/20 border-2 border-dashed border-zinc-900 rounded-[32px] flex flex-col items-center justify-center p-12 text-center group/art">
                                  <p className="text-xs text-zinc-600 mb-8 font-serif leading-loose px-8">"{extractedProfile.visualPrompt}"</p>
                                  <button
                                    onClick={handleGenerateVisual}
                                    disabled={isGeneratingMoodVisual}
                                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-full transition-all shadow-2xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95 flex items-center gap-3"
                                  >
                                    {isGeneratingMoodVisual ? <><Loader2 className="w-4 h-4 animate-spin" /> RENDER_IN_PROGRESS</> : <><Sparkles className="w-4 h-4" /> GENERATE_ART</>}
                                  </button>
                                </div>
                              ) : (
                                <div className="relative group aspect-square rounded-[32px] overflow-hidden shadow-3xl border border-white/[0.05]">
                                  <img src={moodVisualUrl} alt="Visual" className="w-full h-full object-cover grayscale-[0.2] transition-all duration-1000 group-hover:scale-110 group-hover:grayscale-0" />
                                  <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center p-12 text-center backdrop-blur-md">
                                    <button
                                      onClick={() => handleCopy(moodVisualUrl, 'moodImg')}
                                      className="bg-white text-black px-10 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-2xl"
                                    >
                                      Copy Visual Link
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      )}
                      
                      {/* Lyrical DNA / Lyrics Block */}
                      {(isDetectingLyrics || detectedLyrics || lyricalDNADecryption) && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] p-10 glass-card space-y-10"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Decrypted Lyrical DNA & Lyrics</h3>
                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Authentic Lyrics Extraction + Technical Lyricist Breakdown</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              {detectedLyrics && (
                                <button
                                  onClick={() => handleCopy(detectedLyrics, 'original-lyrics')}
                                  className="px-4 py-2 bg-zinc-950 border border-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                                >
                                  {copiedId === 'original-lyrics' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  Copy Lyrics
                                </button>
                              )}
                              
                              {lyricalDNADecryption && (
                                <button
                                  onClick={() => handleCopy(lyricalDNADecryption, 'lyrical-dna')}
                                  className="px-4 py-2 bg-zinc-950 border border-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                                >
                                  {copiedId === 'lyrical-dna' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  Copy DNA Report
                                </button>
                              )}
                            </div>
                          </div>

                          {isDetectingLyrics ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-zinc-300 uppercase tracking-widest animate-pulse">Decrypting Lyrical DNA...</p>
                                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">Scouring standard references via Google Search to identify authentic lyrics, analyze metrics, and decode rhyme patterns.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                              {/* Detected Lyrics Column */}
                              <div className="space-y-4 border-r border-zinc-800/30 pr-0 lg:pr-10">
                                <div className="flex items-center gap-2">
                                  <Music className="w-4 h-4 text-indigo-400" />
                                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Identified Lyrical Transcript</h4>
                                </div>
                                <div className="p-8 bg-zinc-950/40 border border-white/[0.02] rounded-[32px] max-h-[500px] overflow-y-auto custom-scrollbar">
                                  <p className="text-sm text-zinc-400 leading-relaxed font-serif whitespace-pre-line select-text">
                                    {detectedLyrics || "No lyrics detected."}
                                  </p>
                                </div>
                              </div>

                              {/* Lyrical DNA Column */}
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-purple-400" />
                                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Creative DNA Decryption</h4>
                                </div>
                                <div className="p-8 bg-zinc-950/40 border border-white/[0.02] rounded-[32px] max-h-[500px] overflow-y-auto custom-scrollbar prose prose-invert prose-indigo max-w-none prose-sm leading-relaxed text-zinc-300">
                                  <ReactMarkdown>{lyricalDNADecryption || "Waiting for decryption..."}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                      
                      {/* AI Generator Suite */}
                      {(extractedProfile?.musicalPrompt || extractedProfile?.stylePrompt) && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] p-10 glass-card space-y-12"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                                <Sparkles className="w-6 h-6" />
                              </div>
                              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">AI Generator Suite</h3>
                            </div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Optimized for Suno / Udio</p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {extractedProfile.musicalPrompt && (
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Master Musical DNA</h4>
                                  <button
                                    onClick={() => handleCopy(extractedProfile.musicalPrompt, 'music-gen')}
                                    className="p-3 hover:bg-zinc-950 rounded-2xl text-zinc-600 hover:text-white transition-all"
                                  >
                                    {copiedId === 'music-gen' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </div>
                                <div className="p-8 bg-zinc-950/40 border border-white/[0.02] rounded-3xl min-h-[160px] max-h-[300px] overflow-y-auto">
                                  <p className="text-xs text-zinc-500 font-mono leading-relaxed">{extractedProfile.musicalPrompt}</p>
                                </div>
                              </div>
                            )}

                            {extractedProfile.stylePrompt && (
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Style Tag Payload</h4>
                                  <button
                                    onClick={() => handleCopy(extractedProfile.stylePrompt, 'style-gen')}
                                    className="p-3 hover:bg-zinc-950 rounded-2xl text-zinc-600 hover:text-white transition-all"
                                  >
                                    {copiedId === 'style-gen' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </div>
                                <div className="p-8 bg-zinc-950/40 border border-white/[0.02] rounded-3xl min-h-[160px] flex items-center">
                                  <p className="text-lg font-black text-indigo-400 leading-tight uppercase tracking-tight">{extractedProfile.stylePrompt}</p>
                                </div>
                                <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Perfect for the 'Style' field in custom mode.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {generatedLyrics && result && <div className="w-full h-px bg-zinc-800/30"></div>}

                    {/* Lyrics Block */}
                    {generatedLyrics && (
                      <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-16"
                      >
                         {lyricsExcerpt && (
                          <div className="bg-indigo-500/5 border border-indigo-500/10 p-10 rounded-[48px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                              </div>
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                                The Narrative Core
                              </h4>
                            </div>
                            <p className="text-xl text-zinc-300 leading-relaxed italic font-light font-serif">
                              "{lyricsExcerpt}"
                            </p>
                          </div>
                        )}

                         <div className="bg-zinc-900/30 border border-white/[0.03] rounded-[48px] px-12 py-10 glass-card flex flex-col md:flex-row items-center justify-between gap-10">
                          <div className="flex items-center gap-10">
                            <div className="w-20 h-20 rounded-[28px] bg-white/[0.03] flex items-center justify-center shadow-2xl border border-white/[0.05]">
                               <Music className="w-10 h-10 text-glow text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-[10px] text-indigo-500 uppercase tracking-[0.4em] font-black mb-2">Lead Vocal Pipeline</p>
                              <h3 className="text-4xl font-black text-white tracking-tighter leading-none uppercase">{songTitle || "UNTITLED MASTER"}</h3>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => handleCopy(songTitle, 'title')}
                              className="p-5 bg-zinc-950 border border-zinc-900 rounded-[24px] text-zinc-500 hover:text-white transition-all shadow-2xl"
                            >
                              {copiedId === 'title' ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
                            </button>
                          </div>
                        </div>

                        {/* Real-time Rhythmic Syllable Matrix Grid */}
                        <div className="px-6">
                          <MetricGrid lyricsText={generatedLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n')} />
                        </div>

                        <div className="grid grid-cols-1 gap-12 px-6">
                          {generatedLyrics.map((segment, index) => (
                            <div key={index} className="bg-zinc-950/40 border border-white/[0.02] rounded-[48px] overflow-hidden group hover:border-indigo-500/20 transition-all duration-500 glass-card p-12">
                              <div className="flex items-center justify-between mb-8">
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] group-hover:text-indigo-400 transition-colors">{segment.label}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleRegenerateSegment(index)} 
                                    className="opacity-0 group-hover:opacity-100 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-indigo-400 transition-all shadow-xl"
                                    title="Regenerate Section (Context Aware)"
                                  >
                                    <RefreshCw className={`w-5 h-5 ${isGeneratingRewrite && rewritingSegmentIndex === index ? 'animate-spin text-indigo-400' : ''}`} />
                                  </button>
                                  <button 
                                    onClick={() => { setRewritingSegmentIndex(index); setRewriteOptions(null); setRewriteInstruction(''); }} 
                                    className="opacity-0 group-hover:opacity-100 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-indigo-400 transition-all shadow-xl"
                                    title="Custom Rewrite"
                                  >
                                    <Wand2 className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => { setEditingSegmentIndex(index); setSegmentEditValue(segment.text); }} 
                                    className="opacity-0 group-hover:opacity-100 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all shadow-xl"
                                    title="Manual Edit"
                                  >
                                    <Edit3 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              
                              {rewritingSegmentIndex === index ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={rewriteInstruction}
                                      onChange={(e) => setRewriteInstruction(e.target.value)}
                                      placeholder="How should I rewrite this? (e.g., 'Make it more aggressive', 'Add a metaphor about rain')"
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl px-8 py-5 text-lg font-bold text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-zinc-700"
                                      onKeyDown={(e) => e.key === 'Enter' && handleRewriteSegment(index)}
                                    />
                                    <button
                                      onClick={() => handleRewriteSegment(index)}
                                      disabled={isGeneratingRewrite || !rewriteInstruction.trim()}
                                      className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 font-black text-[10px] uppercase tracking-widest text-white rounded-2xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:grayscale"
                                    >
                                      {isGeneratingRewrite ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GO'}
                                    </button>
                                  </div>

                                  {rewriteOptions && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                      {rewriteOptions.map((option, i) => (
                                        <button
                                          key={i}
                                          onClick={() => commitRewriteOption(index, option)}
                                          className="text-left p-8 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.05] rounded-[32px] transition-all group/opt relative overflow-hidden"
                                        >
                                          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover/opt:opacity-100 transition-opacity">
                                            <div className="px-3 py-1 bg-indigo-500 text-[8px] font-black uppercase text-white rounded-full">Option {i + 1}</div>
                                          </div>
                                          <p className="text-sm font-bold text-zinc-300 leading-relaxed italic">
                                            "{option}"
                                          </p>
                                          <div className="mt-6 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover/opt:opacity-100 transition-all translate-y-2 group-hover/opt:translate-y-0">Use This</span>
                                            <Check className="w-4 h-4 text-zinc-700 group-hover/opt:text-indigo-400" />
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex justify-end">
                                    <button 
                                      onClick={() => { setRewritingSegmentIndex(null); setRewriteOptions(null); setRewriteInstruction(''); }} 
                                      className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : editingSegmentIndex === index ? (
                                 <div className="space-y-6">
                                  <textarea
                                    value={segmentEditValue}
                                    onChange={(e) => setSegmentEditValue(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 text-xl font-bold text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[220px]"
                                  />
                                  <MetricGrid lyricsText={segmentEditValue} />
                                  <div className="flex justify-end gap-3">
                                     <button onClick={() => setEditingSegmentIndex(null)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white">Cancel</button>
                                     <button 
                                        onClick={() => {
                                          const newLyrics = [...generatedLyrics];
                                          newLyrics[index].text = segmentEditValue;
                                          setGeneratedLyrics(newLyrics);
                                          setEditingSegmentIndex(null);
                                        }}
                                        className="px-8 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                     >
                                        Save Update
                                     </button>
                                  </div>
                                 </div>
                              ) : (
                                <div className="space-y-12">
                                  <p className="text-2xl md:text-3xl font-black text-white leading-[1.6] whitespace-pre-wrap tracking-tight">
                                    {segment.text}
                                  </p>
                                  {(segment.explanation || segment.transition) && (
                                    <div className="pt-10 border-t border-white/[0.03] grid grid-cols-1 md:grid-cols-2 gap-10">
                                      {segment.explanation && (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Narrative Purpose</span>
                                          </div>
                                          <p className="text-[12px] text-zinc-400 leading-relaxed font-light italic">
                                            "{segment.explanation}"
                                          </p>
                                        </div>
                                      )}
                                      {segment.transition && (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Connecting Tissue</span>
                                          </div>
                                          <p className="text-[12px] text-zinc-400 leading-relaxed font-light">
                                            {segment.transition}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => {
                            const text = generatedLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');
                            handleCopy(text, 'master-lyrics-data');
                          }}
                                className="w-full py-8 bg-indigo-600 text-white rounded-[40px] font-black text-xs uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
                        >
                           {copiedId === 'master-lyrics-data' ? 'COPIED MASTER PAYLOAD' : 'COPY MASTER DATA'}
                        </button>
                      </motion.div>
                    )}

                    {lyricsPrompt && (
                      <div className="pt-24">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-zinc-950/80 border border-white/[0.03] rounded-[48px] overflow-hidden shadow-3xl glass-card"
                        >
                          <div className="px-10 py-6 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.02]">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-4">
                              <Wand2 className="w-5 h-5" /> Musical Blueprint
                            </p>
                            <button
                              onClick={() => handleCopy(lyricsPrompt, 'raw')}
                              className="p-3 hover:bg-zinc-900 rounded-2xl text-zinc-600 hover:text-white transition-all shadow-xl"
                            >
                              {copiedId === 'raw' ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                          <div className="p-10">
                            <p className="text-sm text-zinc-500 font-mono leading-loose whitespace-pre-wrap">
                              {lyricsPrompt}
                            </p>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
    
    <AnimatePresence>
      {isBoothMode && generatedLyrics && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black overflow-y-auto flex flex-col items-center py-32 px-12 sm:px-32"
        >
          <div className="fixed inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          <button 
            onClick={() => setIsBoothMode(false)}
            className="fixed top-12 right-12 p-6 bg-zinc-950 border border-white/[0.05] text-zinc-500 hover:text-white rounded-[24px] transition-all z-[60] shadow-3xl active:scale-95"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-5xl w-full mx-auto space-y-48 relative z-50">
             <div className="text-center space-y-4 mb-32 group">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.6em]">Recording Session</p>
                <h1 className="text-6xl sm:text-8xl font-black text-white tracking-tighter uppercase">{songTitle || "UNTITLED MASTER"}</h1>
             </div>

            {generatedLyrics.map((seg, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 100 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="text-center pb-24 border-b border-white/[0.02] last:border-0"
              >
                <div className="inline-block px-8 py-2 rounded-full bg-white/[0.03] text-indigo-400 font-black text-xs uppercase tracking-[0.5em] mb-16 border border-white/[0.05]">
                  {seg.label}
                </div>
                <div className="text-zinc-100 text-5xl sm:text-7xl md:text-9xl font-black leading-[1.1] whitespace-pre-wrap tracking-tighter hyphens-auto mb-16">
                  {seg.text}
                </div>
                {(seg.explanation || seg.transition) && (
                  <div className="max-w-2xl mx-auto space-y-6 opacity-40 hover:opacity-100 transition-opacity duration-700">
                    {seg.explanation && (
                      <p className="text-xl text-indigo-400 font-light italic leading-relaxed">
                        "{seg.explanation}"
                      </p>
                    )}
                    {seg.transition && (
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">
                        → {seg.transition}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            
            <div className="h-64 flex flex-col items-center justify-center">
               <div className="w-1 h-24 bg-gradient-to-b from-indigo-500 to-transparent" />
               <p className="text-[10px] font-black text-indigo-500/30 uppercase tracking-[0.5em] mt-8">End of session</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
