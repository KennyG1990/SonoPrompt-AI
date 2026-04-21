import { useState, useCallback, useEffect } from 'react';
import { Upload, Link as LinkIcon, Music, Loader2, Sparkles, RefreshCw, AlertCircle, GitCompare, X, FileText, Wand2, Edit3, Check, LayoutDashboard, Youtube, Download, Save, Trash2, Copy, Mic, Settings, ExternalLink, ChevronDown, Search } from 'lucide-react';
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 group cursor-pointer" onClick={() => handleReset()}>
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">SonoPrompt AI</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setIsSettingsOpen(true);
                if (availableModels.length === 0) fetchOpenRouterModels();
              }}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
              title="AI Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">Settings</span>
            </button>
            <a href="https://sonoteller.ai" target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors hidden sm:block">
              Inspired by Sonoteller
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

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Decode the DNA of any song.
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Upload an audio file, paste a link, compare two songs, or generate lyrics based on a song's structure.
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

        <div className={activeTab !== 'studio' ? "grid grid-cols-1 lg:grid-cols-12 gap-8" : "hidden"}>
          {/* Input Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[300px] flex flex-col">
              <div className={activeTab === 'analyze' ? 'flex-1 flex flex-col justify-center gap-6' : 'hidden'}>
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="lyricist-personality" className="block text-sm font-medium text-zinc-300">
                      Lyricist Personality & Rules (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeProfileId}
                        onChange={(e) => handleProfileSelect(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 text-xs text-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- Custom / None --</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {activeProfileId ? (
                        <button
                          onClick={handleDeleteProfile}
                          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsSavingProfile(true)}
                          className="p-1 text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                          title="Save as Profile"
                          disabled={!lyricistPersonality.trim()}
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isSavingProfile && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-xl mb-4"
                    >
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Enter profile name (e.g. 'Hip Hop')"
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveNewProfile}
                        disabled={!newProfileName.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsSavingProfile(false);
                          setNewProfileName('');
                        }}
                        className="text-zinc-400 hover:text-zinc-200 px-2 py-1.5 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}

                  <textarea
                    id="lyricist-personality"
                    value={lyricistPersonality}
                    onChange={(e) => handlePersonalityChange(e.target.value)}
                    placeholder={activeProfileId ? "Edit the rules for this profile here... Changes are saved automatically." : "e.g., 'Write in the style of Eminem. Use multi-syllabic rhymes. Do not use generic structures. Be highly explicit and raw.'"}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[100px] custom-scrollbar resize-y mt-2"
                  />
                </div>
                
                {extractedProfile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 border-t border-zinc-800/80 pt-6 mt-2"
                  >
                    <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Step 2: Songwriter Profile (Tweakable)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Vocal Persona</label>
                        <input type="text" value={extractedProfile.vocalPersona} onChange={(e) => updateProfileField('vocalPersona', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Emotional Flavor / Tone</label>
                        <input type="text" value={extractedProfile.emotionalTone} onChange={(e) => updateProfileField('emotionalTone', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Relationship</label>
                        <input type="text" value={extractedProfile.relationshipDynamic} onChange={(e) => updateProfileField('relationshipDynamic', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Lyrical Density</label>
                        <input type="text" value={extractedProfile.lyricalDensity} onChange={(e) => updateProfileField('lyricalDensity', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Environment / Setting</label>
                        <input type="text" value={extractedProfile.environment || ''} onChange={(e) => updateProfileField('environment', e.target.value)} placeholder="e.g., A dimly lit elevator stalled between floors" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Sensory Palette</label>
                        <input type="text" value={extractedProfile.sensoryPalette || ''} onChange={(e) => updateProfileField('sensoryPalette', e.target.value)} placeholder="e.g., Cold steel, expensive cologne, sweat-damp silk" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Physical Motif</label>
                          <input type="text" value={extractedProfile.physicalMotif || ''} onChange={(e) => updateProfileField('physicalMotif', e.target.value)} placeholder="e.g., Heat of a palm on the small of the back" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Chorus Behavior</label>
                          <input type="text" value={extractedProfile.chorusBehavior || ''} onChange={(e) => updateProfileField('chorusBehavior', e.target.value)} placeholder="e.g., A rhythmic, whispered surrender" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="injectVocalTags" 
                          checked={injectVocalTags} 
                          onChange={(e) => setInjectVocalTags(e.target.checked)}
                          className="rounded bg-zinc-900 border-zinc-700 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                        />
                        <label htmlFor="injectVocalTags" className="text-xs text-zinc-300 cursor-pointer font-medium">Inject Audio Generator Tags (Suno/Udio braces & parentheses)</label>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">Rhyme Scheme</label>
                          <select 
                            value={rhymeComplexity} 
                            onChange={(e) => setRhymeComplexity(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            <option value="default">Default (Any)</option>
                            <option value="slant">Modern / Slant Rhymes</option>
                            <option value="multi">Complex / Multi-syllabic</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">Emotional Arc</label>
                          <select 
                            value={emotionalArc} 
                            onChange={(e) => setEmotionalArc(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            <option value="static">Static / Vibe</option>
                            <option value="downward">Downward Spiral (Gets darker)</option>
                            <option value="realization">The Realization (Epiphany)</option>
                            <option value="upward">Triumphant (Builds up)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">Instrumental Pacing</label>
                          <select 
                            value={instrumentalPacing} 
                            onChange={(e) => setInstrumentalPacing(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            <option value="default">Vocal-heavy (Default)</option>
                            <option value="balanced">Balanced (Instrumental breaks)</option>
                            <option value="cinematic">Cinematic / Spacious</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs font-medium text-zinc-300 mb-1">Visual Anchor / Seed Object (Optional)</label>
                        <input 
                          type="text" 
                          value={visualAnchor} 
                          onChange={(e) => setVisualAnchor(e.target.value)} 
                          placeholder="e.g., 'A cracked iPhone screen', 'A single red balloon'" 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">Structural Blueprint (Optional)</label>
                        <input 
                          type="text" 
                          value={customStructure} 
                          onChange={(e) => setCustomStructure(e.target.value)} 
                          placeholder="e.g., '[Intro], [Verse 1], [Beat Drop], [Chorus]'" 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono" 
                        />
                      </div>
                    </div>
                  </motion.div>
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
          <div className="lg:col-span-7">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 h-full min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/50">
                <h2 className="text-lg font-medium text-zinc-200 flex items-center gap-2">
                  {generatedLyrics && !result ? <FileText className="w-5 h-5 text-indigo-400" /> : <Music className="w-5 h-5 text-indigo-400" />}
                  {generatedLyrics && !result ? 'Generated Lyrics' : generatedLyrics && result ? 'Analysis & Lyrics' : 'Analysis Result'}
                </h2>
                {(result || generatedLyrics) && (
                  <button 
                    onClick={handleReset}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 py-12">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-zinc-800 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                      {currentAction === 'lyrics' ? (
                        <FileText className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400 animate-pulse" />
                      ) : (
                        <Music className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-sm animate-pulse">
                      {currentAction === 'compare' ? 'Comparing musical DNA...' : currentAction === 'lyrics' ? 'Writing lyrics...' : 'Extracting musical DNA...'}
                    </p>
                  </div>
                ) : generatedLyrics || result ? (
                  <div className="flex flex-col gap-10">
                    {result && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:text-zinc-200 prose-a:text-indigo-400 relative group"
                      >
                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {result.toLowerCase().includes('generator prompt') && (
                            <button 
                              onClick={() => {
                                const match = result.match(/Music Generator Prompt(?:\*\*)?:?\s*([\s\S]*)$/i);
                                const promptPart = match ? match[1].trim() : result;
                                handleCopy(promptPart, 'prompt');
                              }}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors flex items-center gap-2 text-xs"
                              title="Copy Generator Prompt"
                            >
                              {copiedId === 'prompt' ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Prompt</>}
                            </button>
                          )}
                        </div>
                        <ReactMarkdown>{result}</ReactMarkdown>

                        {extractedProfile?.sonicDNA && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-12 space-y-8"
                          >
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                              <div className="flex-1 w-full">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                  <LayoutDashboard className="w-4 h-4" /> Sonic DNA Radar
                                </h3>
                                <SonicRadarChart data={extractedProfile.sonicDNA} />
                              </div>
                              
                              <div className="flex-1 w-full space-y-6">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" /> Mood Visual (Album Art)
                                </h3>
                                
                                {!moodVisualUrl ? (
                                  <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center group">
                                    <div className="h-20 w-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                      <Wand2 className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-6 italic">"{extractedProfile.visualPrompt}"</p>
                                    <button
                                      onClick={handleGenerateVisual}
                                      disabled={isGeneratingMoodVisual}
                                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                      {isGeneratingMoodVisual ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Rendering Mood...</>
                                      ) : (
                                        <><Sparkles className="w-4 h-4" /> Generate Album Art</>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group aspect-square rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
                                  >
                                    <img src={moodVisualUrl} alt="Mood Visual" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                                      <div className="text-center">
                                        <button
                                          onClick={() => handleCopy(moodVisualUrl, 'moodImg')}
                                          className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xl hover:scale-105 active:scale-95"
                                        >
                                          {copiedId === 'moodImg' ? 'Copied URL!' : 'Share Visual'}
                                        </button>
                                        <p className="text-[10px] text-zinc-300 mt-4 px-4 line-clamp-3 italic opacity-80">
                                          {extractedProfile.visualPrompt}
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {generatedLyrics && result && <div className="w-full h-px bg-zinc-800/50"></div>}

                    {lyricsPrompt && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <Wand2 className="w-3.5 h-3.5" /> Raw LLM Prompt Sent
                          </p>
                          <button
                            onClick={() => handleCopy(lyricsPrompt, 'rawPrompt')}
                            className="text-xs font-medium text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                          >
                            {copiedId === 'rawPrompt' ? <><Check className="w-3 h-3 text-green-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Prompt</>}
                          </button>
                        </div>
                        <div className="p-4 overflow-x-auto">
                          <pre className="text-[11px] text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed">
                            {lyricsPrompt}
                          </pre>
                        </div>
                      </motion.div>
                    )}

                    {generatedLyrics && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Suggested Title</p>
                        {isGeneratingTitle ? (
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Generating title...</span>
                          </div>
                        ) : (
                          <h3 className="text-xl font-bold text-zinc-100">{songTitle || "Untitled"}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {songTitle && (
                          <button 
                            onClick={() => handleCopy(songTitle, 'title')}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors"
                            title="Copy Title"
                          >
                            {copiedId === 'title' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                        <button 
                          onClick={handleRegenerateTitle}
                          disabled={isGeneratingTitle}
                          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-50"
                          title="Regenerate Title"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {Array.isArray(generatedLyrics) && generatedLyrics.length > 0 && (
                        <div className="flex justify-end px-1 gap-2">
                          <button
                            onClick={() => {
                              let musicPrompt = '';
                              if (result) {
                                const match = result.match(/\*\*(?:Music )?Generator Prompt(?:\*\*)?:?\s*([\s\S]*)$/i);
                                musicPrompt = match ? match[1].trim() : result;
                              }
                              const text = generatedLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');
                              const payload = musicPrompt ? `${musicPrompt}\n\n${text}` : text;
                              handleCopy(payload, 'masterPayload');
                            }}
                            className="text-xs font-medium text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                          >
                            {copiedId === 'masterPayload' ? <><Check className="w-3 h-3 text-green-500" /> Copied Payload</> : <><Copy className="w-3 h-3" /> Master Payload (Suno/Udio)</>}
                          </button>
                          <span className="text-zinc-800">|</span>
                          <button
                            onClick={() => {
                              const text = generatedLyrics.map(s => `[${s.label}]\n${s.text}`).join('\n\n');
                              handleCopy(text, 'lyrics');
                            }}
                            className="text-xs font-medium text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                          >
                            {copiedId === 'lyrics' ? <><Check className="w-3 h-3 text-green-500" /> Copied to clipboard</> : <><Copy className="w-3 h-3" /> Copy Lyrics</>}
                          </button>
                          <span className="text-zinc-800">|</span>
                          <button
                            onClick={() => setIsBoothMode(true)}
                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded"
                          >
                            <Mic className="w-3 h-3" /> Enter Booth Mode
                          </button>
                        </div>
                      )}
                      {Array.isArray(generatedLyrics) && generatedLyrics.map((segment, index) => (
                        <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
                          <div className="bg-zinc-950/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{segment.label}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingSegmentIndex(index);
                                  setSegmentEditValue(segment.text);
                                  setRewritingSegmentIndex(null);
                                }}
                                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Edit manually"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => {
                                  setRewritingSegmentIndex(index);
                                  setEditingSegmentIndex(null);
                                  setRewriteInstruction('');
                                }}
                                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-indigo-400 transition-colors"
                                title="Rewrite with AI"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            {editingSegmentIndex === index ? (
                              <div className="space-y-3">
                                <textarea
                                  value={segmentEditValue}
                                  onChange={(e) => setSegmentEditValue(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                                />
                                <div className="flex justify-between items-center mt-3 border-t border-zinc-800/80 pt-3">
                                  <button
                                    onClick={() => handleGhostwriteContent(index)}
                                    disabled={isGhostwriting}
                                    className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isGhostwriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                    {isGhostwriting ? 'Writing...' : 'Continue The Thought'}
                                  </button>
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingSegmentIndex(null)}
                                      className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleSaveSegmentEdit(index)}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : rewritingSegmentIndex === index ? (
                              <div className="space-y-3">
                                <div className="whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed mb-4 opacity-50">
                                  {segment.text}
                                </div>
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                                  <label className="block text-xs font-medium text-indigo-300 mb-2">How should AI rewrite this?</label>
                                  <input
                                    type="text"
                                    value={rewriteInstruction}
                                    onChange={(e) => setRewriteInstruction(e.target.value)}
                                    placeholder="e.g., 'Make it more melancholic' or 'Change the perspective to first person'"
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-3"
                                  />
                                  <div className="flex items-center gap-2 mb-3">
                                    <input 
                                      type="checkbox" 
                                      id="lockSyllables" 
                                      checked={lockSyllables} 
                                      onChange={(e) => setLockSyllables(e.target.checked)}
                                      className="rounded bg-zinc-900 border-zinc-700 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                                    />
                                    <label htmlFor="lockSyllables" className="text-xs text-zinc-400 cursor-pointer">Lock Syllable Count (Match Rhythm)</label>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setRewritingSegmentIndex(null)}
                                      className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleRewriteSegment(index)}
                                      disabled={!rewriteInstruction.trim() || isGeneratingRewrite}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isGeneratingRewrite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} 
                                      {isGeneratingRewrite ? 'Punching in...' : 'Punch In (3 Options)'}
                                    </button>
                                  </div>
                                  
                                  {rewriteOptions && (
                                    <div className="mt-4 space-y-2 border-t border-indigo-500/20 pt-4">
                                      <p className="text-xs text-indigo-300 font-medium mb-2">Select a version to commit:</p>
                                      {rewriteOptions.map((opt, i) => (
                                        <div 
                                          key={i}
                                          onClick={() => commitRewriteOption(index, opt)}
                                          className="bg-zinc-950 border border-zinc-700 hover:border-indigo-500 p-3 rounded-lg cursor-pointer transition-all group relative"
                                        >
                                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="bg-indigo-500 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Use This</span>
                                          </div>
                                          <p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono relative z-10 pr-16">{opt}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
                                {segment.text.split('\n').map((line, i) => (
                                  <div key={i} className="flex justify-between items-start group/line py-0.5">
                                    <span>{line}</span>
                                    {line.trim() && !line.startsWith('[') && !line.startsWith('(') && (
                                      <span className="text-[10px] text-zinc-600 bg-zinc-800/40 px-1.5 py-0.5 rounded opacity-50 group-hover/line:opacity-100 transition-opacity select-none font-mono tracking-tighter" title="Syllable count">
                                        {countLineSyllables(line)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 py-12">
                    <Sparkles className="w-10 h-10 opacity-20" />
                    <p className="text-sm">Your analysis will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    
    <AnimatePresence>
      {isBoothMode && generatedLyrics && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 bg-zinc-950 overflow-y-auto flex flex-col items-center p-8 sm:p-24 pb-64"
        >
          <button 
            onClick={() => setIsBoothMode(false)}
            className="fixed top-8 right-8 p-4 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors z-[60] shadow-2xl"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-4xl w-full mx-auto space-y-24 pt-12 relative z-50">
             {songTitle && <h1 className="text-zinc-500 font-bold text-2xl text-center mb-12 opacity-50">{songTitle}</h1>}
            {generatedLyrics.map((seg, i) => (
              <div key={i} className="text-center">
                <div className="text-indigo-500 font-mono text-xl sm:text-2xl font-bold mb-8 uppercase tracking-[0.3em] opacity-80">{seg.label}</div>
                <div className="text-zinc-100 text-4xl sm:text-5xl md:text-6xl font-black leading-tight sm:leading-snug whitespace-pre-wrap tracking-tight">
                  {seg.text}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
