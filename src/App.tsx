import { useState, useCallback, useEffect } from 'react';
import { Upload, Link as LinkIcon, Music, Loader2, Sparkles, RefreshCw, AlertCircle, GitCompare, X, FileText, Wand2, Edit3, Check, LayoutDashboard, Youtube, Download, Save, Trash2, Copy, Mic, Settings, ExternalLink, ChevronDown, Search, Plus, Settings2, Library, Activity, Monitor } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAudioFile, analyzeSongLink, compareSongs, generateLyrics, rewriteLyricSegment, suggestSongTitle, ghostwriteNextLine, generateMoodVisual, SongInput, LyricSegment, ExtractedProfile, AnalysisResult, AIConfig } from './services/geminiService';
import Studio from './components/Studio';
import SonicRadarChart from './components/SonicRadarChart';

export interface LyricistProfile {
  id: string;
  name: string;
  rules: string;
}

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

  // YouTube Downloader state
  const [ytLink, setYtLink] = useState('');
  const [ytInfo, setYtInfo] = useState<{title: string, thumbnail: string, author: string} | null>(null);
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [isDownloadingYt, setIsDownloadingYt] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lyricist-profiles');
    if (saved) {
      try {
        setProfiles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse profiles', e);
      }
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
    if (id) {
      const p = profiles.find(x => x.id === id);
      if (p) setLyricistPersonality(p.rules);
    } else {
      setLyricistPersonality(''); 
    }
  };

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
    } else if (action === 'lyrics') {
      setGeneratedLyrics(null);
      setLyricsPrompt(null);
      setSongTitle(null);
      // Keep result intact so they can be viewed simultaneously
    }

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
          if (!extractedTheme && analysisData.profile && (analysisData.profile.emotionalTone || analysisData.profile.vocalPersona)) {
             extractedTheme = `Vocal Persona: ${analysisData.profile.vocalPersona} | Tone: ${analysisData.profile.emotionalTone}`;
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

        if (s && (lyricsTheme.trim() || extractedProfile)) {
          const lyrics = await generateLyrics(
            s, 
            lyricsTheme.trim() || "A new song matching the core emotion", 
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
        } else {
          setError('Please provide a song and a theme/mood.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429')) {
        setError('The Songwriter is currently overloaded. Please wait 60 seconds and try again. (Quota Exceeded)');
      } else {
        setError(err.message || 'An error occurred.');
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
      const url = await generateMoodVisual(extractedProfile.visualPrompt);
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
    setLyricsPrompt(null);
    setSongTitle(null);
    setError(null);
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

  const handleDownloadYt = () => {
    if (!ytLink.trim()) return;
    window.location.href = `/api/youtube/download?url=${encodeURIComponent(ytLink.trim())}`;
  };

  const updateProfileField = (key: keyof ExtractedProfile, value: string) => {
    setExtractedProfile(prev => prev ? { ...prev, [key]: value } : null);
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
                            placeholder="auto (gemini-1.5-flash)"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">
                          Selected: <span className="text-zinc-400">{openRouterAnalysisModel === 'auto' ? 'google/gemini-1.5-flash' : openRouterAnalysisModel}</span>
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
                      Using the default <span className="font-semibold text-white">Gemini 1.5 Flash</span> models via the server backend.
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
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="lyricist-personality" className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" /> Lyricist Style Engine
                    </label>
                  </div>
                  
                  {/* Persona Profile Selection */}
                  <div className="flex flex-wrap gap-2 mb-4">
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
                
                {extractedProfile && (
                  <div className="space-y-4 border-t border-zinc-800/50 pt-8 mt-4">
                    <button 
                      onClick={() => setIsExpertSettingsOpen(!isExpertSettingsOpen)}
                      className="w-full flex items-center justify-between group py-2"
                    >
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                          <Settings2 className="w-4 h-4" />
                        </div>
                        Creative DNA Engine
                      </h3>
                      <div className={`transition-transform duration-300 ${isExpertSettingsOpen ? 'rotate-180' : ''}`}>
                         <RefreshCw className="w-4 h-4 text-zinc-700" />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpertSettingsOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-6 pt-4 pb-2">
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
                            
                            <div className="space-y-4">
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
                                <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Rhyme Scheme</label>
                                <select 
                                  value={rhymeComplexity} 
                                  onChange={(e) => setRhymeComplexity(e.target.value)}
                                  className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 appearance-none font-bold"
                                >
                                  <option value="default">NATURAL (AABB/ABAB)</option>
                                  <option value="slant">MODERN / SLANT RHYME</option>
                                  <option value="multi">COMPLEX / MULTI-SYLLABIC</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-1">Emotional Arc</label>
                                <select 
                                  value={emotionalArc} 
                                  onChange={(e) => setEmotionalArc(e.target.value)}
                                  className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 appearance-none font-bold"
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
                                  className="w-full bg-zinc-950 text-indigo-400 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 appearance-none font-bold"
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
                                  className={`w-full py-2 px-4 rounded-xl text-[10px] font-black transition-all border ${
                                    injectVocalTags 
                                      ? 'bg-indigo-500 text-white border-indigo-400' 
                                      : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                                  }`}
                                >
                                  {injectVocalTags ? 'ENABLED' : 'DISABLED'}
                                </button>
                              </div>
                            </div>

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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
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
                    <button
                      onClick={handleDownloadYt}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors flex-shrink-0"
                      title="Download Audio"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
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

                        <div className="grid grid-cols-1 gap-12 px-6">
                          {generatedLyrics.map((segment, index) => (
                            <div key={index} className="bg-zinc-950/40 border border-white/[0.02] rounded-[48px] overflow-hidden group hover:border-indigo-500/20 transition-all duration-500 glass-card p-12">
                              <div className="flex items-center justify-between mb-8">
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] group-hover:text-indigo-400 transition-colors">{segment.label}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => { setEditingSegmentIndex(index); setSegmentEditValue(segment.text); }} 
                                    className="opacity-0 group-hover:opacity-100 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all shadow-xl"
                                  >
                                    <Edit3 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              
                              {editingSegmentIndex === index ? (
                                 <div className="space-y-6">
                                  <textarea
                                    value={segmentEditValue}
                                    onChange={(e) => setSegmentEditValue(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 text-xl font-bold text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[220px]"
                                  />
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
                                <p className="text-2xl md:text-3xl font-black text-white leading-[1.6] whitespace-pre-wrap tracking-tight">
                                  {segment.text}
                                </p>
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
                <div className="text-zinc-100 text-5xl sm:text-7xl md:text-9xl font-black leading-[1.1] whitespace-pre-wrap tracking-tighter hyphens-auto">
                  {seg.text}
                </div>
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
