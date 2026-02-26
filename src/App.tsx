import { useState, useCallback } from 'react';
import { Upload, Link as LinkIcon, Music, Loader2, Sparkles, RefreshCw, AlertCircle, GitCompare, X, FileText, Wand2, Edit3, Check, LayoutDashboard, Youtube, Download } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAudioFile, analyzeSongLink, compareSongs, generateLyrics, rewriteLyricSegment, suggestSongTitle, SongInput, LyricSegment } from './services/geminiService';
import Studio from './components/Studio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'compare' | 'lyrics' | 'studio' | 'youtube'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  
  // Compare state
  const [compareSong1, setCompareSong1] = useState<SongInput | null>(null);
  const [compareSong2, setCompareSong2] = useState<SongInput | null>(null);
  const [compareInputType1, setCompareInputType1] = useState<'upload' | 'link'>('link');
  const [compareInputType2, setCompareInputType2] = useState<'upload' | 'link'>('link');
  const [compareLink1, setCompareLink1] = useState('');
  const [compareLink2, setCompareLink2] = useState('');

  // Lyrics state
  const [lyricsSong, setLyricsSong] = useState<SongInput | null>(null);
  const [lyricsInputType, setLyricsInputType] = useState<'upload' | 'link'>('link');
  const [lyricsLink, setLyricsLink] = useState('');
  const [lyricsTheme, setLyricsTheme] = useState('');
  const [generatedLyrics, setGeneratedLyrics] = useState<LyricSegment[] | null>(null);
  const [songTitle, setSongTitle] = useState<string | null>(null);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [segmentEditValue, setSegmentEditValue] = useState('');
  const [rewritingSegmentIndex, setRewritingSegmentIndex] = useState<number | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // YouTube Downloader state
  const [ytLink, setYtLink] = useState('');
  const [ytInfo, setYtInfo] = useState<{title: string, thumbnail: string, author: string} | null>(null);
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [isDownloadingYt, setIsDownloadingYt] = useState(false);

  const onDropMain = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
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

  const onDropLyrics = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setLyricsSong({ type: 'file', file: acceptedFiles[0] });
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

  const { getRootProps: getRootPropsMain, getInputProps: getInputPropsMain, isDragActive: isDragActiveMain } = useDropzone({
    onDrop: onDropMain,
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

  const { getRootProps: getRootPropsLyrics, getInputProps: getInputPropsLyrics, isDragActive: isDragActiveLyrics } = useDropzone({
    onDrop: onDropLyrics,
    ...dropzoneConfig
  });

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);
    setGeneratedLyrics(null);
    setSongTitle(null);
    setIsAnalyzing(true);

    try {
      if (activeTab === 'upload' && file) {
        const analysis = await analyzeAudioFile(file);
        setResult(analysis);
      } else if (activeTab === 'link' && link.trim()) {
        const analysis = await analyzeSongLink(link.trim());
        setResult(analysis);
      } else if (activeTab === 'compare') {
        let s1: SongInput | null = compareSong1;
        let s2: SongInput | null = compareSong2;

        if (compareInputType1 === 'link' && compareLink1.trim()) {
          s1 = { type: 'link', link: compareLink1.trim() };
        }
        if (compareInputType2 === 'link' && compareLink2.trim()) {
          s2 = { type: 'link', link: compareLink2.trim() };
        }

        if (s1 && s2) {
          const analysis = await compareSongs(s1, s2);
          setResult(analysis);
        } else {
           setError('Please provide both songs to compare.');
        }
      } else if (activeTab === 'lyrics') {
        let s: SongInput | null = lyricsSong;
        if (lyricsInputType === 'link' && lyricsLink.trim()) {
          s = { type: 'link', link: lyricsLink.trim() };
        }

        if (s && lyricsTheme.trim()) {
          const lyrics = await generateLyrics(s, lyricsTheme.trim());
          setGeneratedLyrics(lyrics);
          
          // Automatically suggest title after lyrics generation
          setIsGeneratingTitle(true);
          try {
            const title = await suggestSongTitle(s, lyrics);
            setSongTitle(title);
          } catch (e) {
            console.error("Failed to generate title", e);
          } finally {
            setIsGeneratingTitle(false);
          }
        } else {
          setError('Please provide a song and a theme/mood.');
        }
      } else {
        setError('Please provide the required inputs to analyze.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setLink('');
    setCompareSong1(null);
    setCompareSong2(null);
    setCompareLink1('');
    setCompareLink2('');
    setLyricsSong(null);
    setLyricsLink('');
    setLyricsTheme('');
    setResult(null);
    setGeneratedLyrics(null);
    setSongTitle(null);
    setError(null);
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
    
    let s: SongInput | null = lyricsSong;
    if (lyricsInputType === 'link' && lyricsLink.trim()) {
      s = { type: 'link', link: lyricsLink.trim() };
    }
    if (!s) return;

    const originalText = generatedLyrics[index].text;
    
    // Optimistic UI update or loading state
    const newLyrics = [...generatedLyrics];
    newLyrics[index].text = "Rewriting...";
    setGeneratedLyrics(newLyrics);

    try {
      const newText = await rewriteLyricSegment(s, generatedLyrics, index, rewriteInstruction.trim());
      const updatedLyrics = [...generatedLyrics];
      updatedLyrics[index].text = newText;
      setGeneratedLyrics(updatedLyrics);
    } catch (err) {
      console.error(err);
      // Revert on error
      const revertedLyrics = [...generatedLyrics];
      revertedLyrics[index].text = originalText;
      setGeneratedLyrics(revertedLyrics);
      setError("Failed to rewrite segment.");
    } finally {
      setRewritingSegmentIndex(null);
      setRewriteInstruction('');
    }
  };

  const handleRegenerateTitle = async () => {
    if (!generatedLyrics) return;
    let s: SongInput | null = lyricsSong;
    if (lyricsInputType === 'link' && lyricsLink.trim()) {
      s = { type: 'link', link: lyricsLink.trim() };
    }
    if (!s) return;

    setIsGeneratingTitle(true);
    try {
      const title = await suggestSongTitle(s, generatedLyrics);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">SonoPrompt AI</span>
          </div>
          <a href="https://sonoteller.ai" target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            Inspired by Sonoteller
          </a>
        </div>
      </header>

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
              onClick={() => setActiveTab('upload')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'upload' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'link' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Link
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
              onClick={() => setActiveTab('lyrics')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'lyrics' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Lyrics
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

        {activeTab === 'studio' ? (
          <div className="-mx-6 lg:mx-0">
            <Studio />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[300px] flex flex-col">
              <AnimatePresence mode="wait">
                {activeTab === 'upload' ? (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col"
                  >
                    <div 
                      {...getRootPropsMain()} 
                      className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-colors ${
                        isDragActiveMain ? 'border-indigo-500 bg-indigo-500/5' : 
                        file ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
                      }`}
                    >
                      <input {...getInputPropsMain()} />
                      {file ? (
                        <div className="space-y-3">
                          <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                            <Music className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-medium text-zinc-200 truncate max-w-[200px] mx-auto">{file.name}</p>
                            <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                          <p className="text-xs text-indigo-400 pt-2">Click or drag to replace</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
                            <Upload className="w-6 h-6 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-medium text-zinc-300">Drop your audio or video file here</p>
                            <p className="text-xs text-zinc-500 mt-1">MP3, WAV, OGG, MP4 up to 15MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : activeTab === 'link' ? (
                  <motion.div
                    key="link"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col justify-center"
                  >
                    <div className="space-y-4">
                      <label htmlFor="song-link" className="block text-sm font-medium text-zinc-300">
                        Song Link or Name
                      </label>
                      <input
                        id="song-link"
                        type="text"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="e.g., https://youtube.com/watch?v=... or 'Bohemian Rhapsody'"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      />
                      <p className="text-xs text-zinc-500">
                        We'll use Google Search to find information about the song and analyze its characteristics.
                      </p>
                    </div>
                  </motion.div>
                ) : activeTab === 'compare' ? (
                  <motion.div
                    key="compare"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col justify-center gap-6"
                  >
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
                  </motion.div>
                ) : activeTab === 'lyrics' ? (
                  <motion.div
                    key="lyrics"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col justify-center gap-6"
                  >
                    {renderInputSelector(
                      "Reference Song (for structure)", lyricsSong, lyricsInputType, setLyricsInputType, lyricsLink, setLyricsLink,
                      getRootPropsLyrics, getInputPropsLyrics, isDragActiveLyrics, () => setLyricsSong(null)
                    )}
                    
                    <div className="space-y-4">
                      <label htmlFor="lyrics-theme" className="block text-sm font-medium text-zinc-300">
                        Theme or Mood
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
                  </motion.div>
                ) : activeTab === 'youtube' ? (
                  <motion.div
                    key="youtube"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col justify-center gap-6"
                  >
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
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {activeTab !== 'youtube' && (
                <div className="mt-6">
                  <button
                    onClick={handleAnalyze}
                    disabled={
                      isAnalyzing || 
                      (activeTab === 'upload' && !file) || 
                      (activeTab === 'link' && !link.trim()) ||
                      (activeTab === 'compare' && (
                        (compareInputType1 === 'link' && !compareLink1.trim()) || (compareInputType1 === 'upload' && !compareSong1) ||
                        (compareInputType2 === 'link' && !compareLink2.trim()) || (compareInputType2 === 'upload' && !compareSong2)
                      )) ||
                      (activeTab === 'lyrics' && (
                        !lyricsTheme.trim() ||
                        (lyricsInputType === 'link' && !lyricsLink.trim()) || (lyricsInputType === 'upload' && !lyricsSong)
                      ))
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {activeTab === 'lyrics' ? 'Generating Lyrics...' : 'Analyzing...'}
                      </>
                    ) : (
                      <>
                        {activeTab === 'lyrics' ? <FileText className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        {activeTab === 'compare' ? 'Compare Songs' : activeTab === 'lyrics' ? 'Generate Lyrics' : 'Analyze Song'}
                      </>
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
                  {generatedLyrics ? <FileText className="w-5 h-5 text-indigo-400" /> : <Music className="w-5 h-5 text-indigo-400" />}
                  {generatedLyrics ? 'Generated Lyrics' : 'Analysis Result'}
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
                      {activeTab === 'lyrics' ? (
                        <FileText className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400 animate-pulse" />
                      ) : (
                        <Music className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-sm animate-pulse">
                      {activeTab === 'compare' ? 'Comparing musical DNA...' : activeTab === 'lyrics' ? 'Writing lyrics...' : 'Extracting musical DNA...'}
                    </p>
                  </div>
                ) : generatedLyrics ? (
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
                      <button 
                        onClick={handleRegenerateTitle}
                        disabled={isGeneratingTitle}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-50"
                        title="Regenerate Title"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {generatedLyrics.map((segment, index) => (
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
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setRewritingSegmentIndex(null)}
                                      className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleRewriteSegment(index)}
                                      disabled={!rewriteInstruction.trim()}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <Wand2 className="w-3.5 h-3.5" /> Rewrite
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
                                {segment.text}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : result ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:text-zinc-200 prose-a:text-indigo-400"
                  >
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </motion.div>
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
        )}
      </main>
    </div>
  );
}
