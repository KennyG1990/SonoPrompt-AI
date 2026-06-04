import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Upload, Youtube, Plus, Music, FileText, Trash2, Loader2, CheckCircle2, Wand2, Link as LinkIcon, Sparkles, Download, Languages, ChevronDown } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { analyzeAndGenerateStudioTrack, SongInput, AIConfig, translateLyrics } from '../services/geminiService';

export type Track = {
  id: string;
  title: string;
  description: string;
  lyrics: string;
  styleTags: string;
  audioFile?: File;
  audioUrl?: string;
  createdAt: Date;
  youtubeId?: string;
  isGenerating?: boolean;
  analysis?: string;
  meaning?: string;
};

const SUPPORTED_LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese', 
  'Japanese', 'Korean', 'Chinese', 'Russian', 'Arabic', 
  'Hindi', 'Turkish', 'Dutch', 'Swedish', 'Polish'
];

export default function Studio({ aiConfig }: { aiConfig?: AIConfig }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasSelectedTrackSelection, setHasSelectedTrackSelection] = useState(false);
  
  // Translation State
  const [targetLang, setTargetLang] = useState('Spanish');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async (text: string, isForDraft: boolean, trackId?: string) => {
    let textToTranslate = text;
    let isSelection = false;
    let selectionStart = 0;
    let selectionEnd = 0;

    // Check for selection
    const activeRef = isForDraft ? lyricsTextAreaRef : selectedTrackLyricsRef;
    if (activeRef.current) {
      const start = activeRef.current.selectionStart;
      const end = activeRef.current.selectionEnd;
      if (start !== end) {
        textToTranslate = text.substring(start, end);
        isSelection = true;
        selectionStart = start;
        selectionEnd = end;
      }
    }

    if (!textToTranslate.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await translateLyrics(textToTranslate, targetLang, aiConfig);
      if (isForDraft) {
        if (isSelection) {
          const newLyrics = lyrics.substring(0, selectionStart) + translated + lyrics.substring(selectionEnd);
          setLyrics(newLyrics);
        } else {
          setLyrics(translated);
        }
      } else if (trackId) {
        if (isSelection) {
          setTracks(prev => prev.map(t => {
            if (t.id === trackId) {
              const newLyrics = t.lyrics.substring(0, selectionStart) + translated + t.lyrics.substring(selectionEnd);
              return { ...t, lyrics: newLyrics };
            }
            return t;
          }));
        } else {
          setTracks(prev => prev.map(t => t.id === trackId ? { ...t, lyrics: translated } : t));
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Translation failed: ' + err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const lyricsTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const selectedTrackLyricsRef = useRef<HTMLTextAreaElement>(null);
  const [styleTags, setStyleTags] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-Generate State
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [autoGenInputType, setAutoGenInputType] = useState<'upload' | 'link'>('link');
  const [autoGenFile, setAutoGenFile] = useState<File | null>(null);
  const [autoGenLink, setAutoGenLink] = useState('');
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const onDropAutoGen = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setAutoGenFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps: getRootPropsAutoGen, getInputProps: getInputPropsAutoGen, isDragActive: isDragActiveAutoGen } = useDropzone({
    onDrop: onDropAutoGen,
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
      'video/mp4': ['.mp4']
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024, // 15MB limit
  });

  const handleAutoGenerate = async () => {
    let songInput: SongInput | null = null;
    if (autoGenInputType === 'link' && autoGenLink.trim()) {
      songInput = { type: 'link', link: autoGenLink.trim() };
    } else if (autoGenInputType === 'upload' && autoGenFile) {
      songInput = { type: 'file', file: autoGenFile };
    }

    if (!songInput) return;

    setIsAutoGenerating(true);
    try {
      const result = await analyzeAndGenerateStudioTrack(songInput, aiConfig);
      setTitle(result.title);
      setDescription(result.prompt);
      setStyleTags(result.styleTags);
      setLyrics(result.lyrics);
      setShowAutoGenerate(false); // Close the panel after success
      
      // Automatically trigger Sonauto generation
      await triggerSonautoGeneration(result.title, result.prompt, result.lyrics, result.styleTags, result.analysis, result.meaning);

    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('503') || msg.includes('high demand') || msg.includes('internal error')) {
        alert('The AI Creative Engine is currently experiencing a temporary surge in traffic. We have attempted to generate a fallback for you, but please try the specific action again in a few moments.');
      } else {
        alert(msg || 'Failed to auto-generate track details.');
      }
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const triggerSonautoGeneration = async (t: string, d: string, l: string, s: string, analysis?: string, meaning?: string) => {
    setIsGenerating(true);
    const trackId = Math.random().toString(36).substring(2, 9);
    const newTrack: Track = {
      id: trackId,
      title: t,
      description: d,
      lyrics: l,
      styleTags: s,
      analysis: analysis,
      meaning: meaning,
      createdAt: new Date(),
      isGenerating: true
    };
    
    setTracks(prev => [newTrack, ...prev]);
    setSelectedTrackId(trackId);
    
    try {
      const res = await fetch('/api/sonauto/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: d,
          lyrics: l,
          tags: s
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const taskId = data.task_id || data.taskId || (Array.isArray(data) && data[0]?.id) || data.id;
      
      if (!taskId) {
        throw new Error('No task ID returned from Sonauto API');
      }
      
      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/sonauto/status/${taskId}`);
          const statusData = await statusRes.json();
          
          if (statusData.status === 'completed' && statusData.audio_url) {
            clearInterval(pollInterval);
            setTracks(prev => prev.map(tr => 
              tr.id === trackId ? { ...tr, isGenerating: false, audioUrl: statusData.audio_url } : tr
            ));
            setIsGenerating(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            throw new Error('Sonauto generation failed');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to generate track');
      setTracks(prev => prev.map(tr => 
        tr.id === trackId ? { ...tr, isGenerating: false } : tr
      ));
      setIsGenerating(false);
    }
  };

  const handleGenerateTrack = () => {
    if (!title.trim()) return;
    triggerSonautoGeneration(title, description, lyrics, styleTags);
  };

  // YouTube Auth State
  const [ytTokens, setYtTokens] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<string | null>(null); // trackId

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        setYtTokens(JSON.stringify(event.data.tokens));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectYoutube = async () => {
    try {
      const redirectUri = `${window.location.origin}/api/auth/youtube/callback`;
      const res = await fetch(`/api/auth/youtube/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      console.error('Failed to get YouTube auth URL', err);
    }
  };

  const handleCreateTrack = () => {
    if (!title.trim()) return;
    const newTrack: Track = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      description,
      lyrics,
      styleTags,
      createdAt: new Date(),
    };
    setTracks([newTrack, ...tracks]);
    setSelectedTrackId(newTrack.id);
    setTitle('');
    setDescription('');
    setLyrics('');
    setStyleTags('');
  };

  const handleFileUpload = (trackId: string, file: File) => {
    const url = URL.createObjectURL(file);
    setTracks(tracks.map(t => t.id === trackId ? { ...t, audioFile: file, audioUrl: url } : t));
  };

  const handlePushToYoutube = async (track: Track) => {
    if (!track.audioFile || !ytTokens) return;
    setIsUploading(track.id);

    const formData = new FormData();
    formData.append('video', track.audioFile);
    formData.append('title', track.title);
    formData.append('description', `Generated with SonoPrompt AI\n\nPrompt: ${track.description}\n\nLyrics:\n${track.lyrics}`);
    formData.append('tokens', ytTokens);

    try {
      const res = await fetch('/api/youtube/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setTracks(tracks.map(t => t.id === track.id ? { ...t, youtubeId: data.videoId } : t));
        alert('Successfully uploaded to YouTube (Private)!');
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setIsUploading(null);
    }
  };

  const togglePlay = (trackId: string) => {
    if (selectedTrackId === trackId && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setSelectedTrackId(trackId);
      setTimeout(() => {
        audioRef.current?.play();
        setIsPlaying(true);
      }, 50);
    }
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-zinc-950 text-zinc-200">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Create */}
        <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Track
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Draft your prompt and lyrics to use in Suno.</p>
            
            <button
              onClick={() => setShowAutoGenerate(!showAutoGenerate)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {showAutoGenerate ? 'Hide Auto-Generate' : 'Auto-Generate from Reference'}
            </button>

            {showAutoGenerate && (
              <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex bg-zinc-900 rounded-lg p-1">
                  <button
                    onClick={() => setAutoGenInputType('link')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      autoGenInputType === 'link' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Link
                  </button>
                  <button
                    onClick={() => setAutoGenInputType('upload')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      autoGenInputType === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                </div>

                {autoGenInputType === 'link' ? (
                  <input
                    type="text"
                    value={autoGenLink}
                    onChange={(e) => setAutoGenLink(e.target.value)}
                    placeholder="YouTube or Spotify link..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                ) : (
                  <div 
                    {...getRootPropsAutoGen()} 
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      isDragActiveAutoGen ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                    }`}
                  >
                    <input {...getInputPropsAutoGen()} />
                    <Upload className="w-5 h-5 mx-auto mb-2 text-zinc-500" />
                    <p className="text-xs text-zinc-400">
                      {autoGenFile ? autoGenFile.name : 'Drop audio file here'}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleAutoGenerate}
                  disabled={isAutoGenerating || (autoGenInputType === 'link' ? !autoGenLink.trim() : !autoGenFile)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAutoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Analyze & Generate
                </button>
              </div>
            )}
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Song Title"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Song Description (Prompt)</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g., A dark, enigmatic chillstep track..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-indigo-500 custom-scrollbar"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Style of Music</label>
              <input 
                type="text" 
                value={styleTags}
                onChange={e => setStyleTags(e.target.value)}
                placeholder="e.g., 80s retro, synthwave"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-400">Lyrics</label>
                <div className="flex items-center gap-1">
                  <select 
                    value={targetLang}
                    onChange={e => setTargetLang(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleTranslate(lyrics, true)}
                    disabled={isTranslating || !lyrics.trim()}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-30 flex items-center gap-1"
                    title={lyricsTextAreaRef.current?.selectionStart !== lyricsTextAreaRef.current?.selectionEnd ? "Translate Selection" : "Translate All"}
                  >
                    {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                    <span className="text-[9px] uppercase font-bold">
                      {hasSelection ? 'Sel' : 'All'}
                    </span>
                  </button>
                </div>
              </div>
              <textarea 
                ref={lyricsTextAreaRef}
                value={lyrics}
                onSelect={() => {
                  if (lyricsTextAreaRef.current) {
                    setHasSelection(lyricsTextAreaRef.current.selectionStart !== lyricsTextAreaRef.current.selectionEnd);
                  }
                }}
                onChange={e => setLyrics(e.target.value)}
                placeholder="[Verse 1]&#10;Enter lyrics here..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm h-48 resize-none focus:outline-none focus:border-indigo-500 custom-scrollbar"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleCreateTrack}
                disabled={!title.trim()}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Save Draft
              </button>
              <button 
                onClick={handleGenerateTrack}
                disabled={!title.trim() || isGenerating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Middle Panel: Workspace */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold">My Workspace</h2>
            {!ytTokens ? (
              <button 
                onClick={handleConnectYoutube}
                className="flex items-center gap-2 text-xs bg-red-600/10 text-red-500 hover:bg-red-600/20 px-3 py-1.5 rounded-md transition-colors font-medium border border-red-500/20"
              >
                <Youtube className="w-4 h-4" /> Connect YouTube
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> YouTube Connected
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {tracks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <Music className="w-12 h-12 mb-4 opacity-20" />
                <p>Your workspace is empty.</p>
                <p className="text-sm mt-1">Create a track on the left to get started.</p>
              </div>
            ) : (
              tracks.map(track => (
                <div 
                  key={track.id} 
                  onClick={() => setSelectedTrackId(track.id)}
                  className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors border ${
                    selectedTrackId === track.id ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-transparent hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 relative group overflow-hidden">
                    {track.audioUrl ? (
                      <>
                        <div className="absolute inset-0 bg-indigo-500/20"></div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); togglePlay(track.id); }}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isPlaying && selectedTrackId === track.id ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-1" />}
                        </button>
                      </>
                    ) : (
                      <Music className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate text-zinc-100">{track.title}</h3>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {track.styleTags || 'No style tags'} • {track.description || 'No description'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {track.isGenerating ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-md border border-indigo-500/20">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                      </div>
                    ) : !track.audioUrl ? (
                      <label className="cursor-pointer flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-md transition-colors" onClick={e => e.stopPropagation()}>
                        <Upload className="w-3.5 h-3.5" /> Attach MP4
                        <input 
                          type="file" 
                          accept="video/mp4,audio/*" 
                          className="hidden" 
                          onChange={e => {
                            if (e.target.files?.[0]) handleFileUpload(track.id, e.target.files[0]);
                          }}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2">
                        <a 
                          href={track.audioUrl} 
                          download={`${track.title}.mp3`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-md transition-colors"
                          title="Download Audio"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePushToYoutube(track); }}
                          disabled={!ytTokens || isUploading === track.id || !!track.youtubeId}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors border ${
                            track.youtubeId 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default'
                              : ytTokens 
                                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500' 
                                : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                          }`}
                          title={!ytTokens ? 'Connect YouTube first' : track.youtubeId ? 'Already uploaded' : 'Push to YouTube'}
                        >
                          {isUploading === track.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                          ) : track.youtubeId ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</>
                          ) : (
                            <><Youtube className="w-3.5 h-3.5" /> Push to YT</>
                          )}
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks(tracks.filter(t => t.id !== track.id));
                        if (selectedTrackId === track.id) setSelectedTrackId(null);
                      }}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Lyrics & Analysis */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Details
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {selectedTrack ? (
              <div className="space-y-6">
                {selectedTrack.meaning && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Narrative Meaning
                    </h3>
                    <div className="text-sm text-zinc-300 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 italic leading-relaxed">
                      "{selectedTrack.meaning}"
                    </div>
                  </div>
                )}
                {selectedTrack.analysis && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Sonar Analysis
                    </h3>
                    <div className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800/50 leading-relaxed">
                      {selectedTrack.analysis}
                    </div>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5" /> Lyrics
                    </h3>
                    <div className="flex items-center gap-1">
                      <select 
                        value={targetLang}
                        onChange={e => setTargetLang(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none"
                      >
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleTranslate(selectedTrack.lyrics, false, selectedTrack.id)}
                        disabled={isTranslating || !selectedTrack.lyrics.trim()}
                        className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-indigo-400 transition-colors disabled:opacity-30 border border-zinc-700"
                        title={hasSelectedTrackSelection ? 'Translate Selection' : 'Translate All'}
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                        {hasSelectedTrackSelection ? 'Translate Selection' : 'Translate All'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={selectedTrackLyricsRef}
                    value={selectedTrack.lyrics}
                    onSelect={() => {
                      if (selectedTrackLyricsRef.current) {
                        setHasSelectedTrackSelection(selectedTrackLyricsRef.current.selectionStart !== selectedTrackLyricsRef.current.selectionEnd);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTracks(prev => prev.map(t => t.id === selectedTrack.id ? { ...t, lyrics: val } : t));
                    }}
                    className="w-full whitespace-pre-wrap text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800/20 leading-relaxed font-mono min-h-[300px] resize-none focus:outline-none focus:border-indigo-500/50"
                    placeholder="No lyrics provided."
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                Select a track to view details.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Player */}
      <div className="h-20 border-t border-zinc-800 bg-zinc-950 flex items-center px-6 gap-6">
        {selectedTrack ? (
          <>
            <div className="flex items-center gap-4 w-64 shrink-0">
              <div className="w-12 h-12 rounded-md bg-zinc-800 flex items-center justify-center">
                <Music className="w-6 h-6 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-zinc-100 truncate">{selectedTrack.title}</p>
                <p className="text-xs text-zinc-500 truncate">{selectedTrack.styleTags}</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => togglePlay(selectedTrack.id)}
                  disabled={!selectedTrack.audioUrl}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </button>
              </div>
              {selectedTrack.audioUrl && (
                <audio 
                  ref={audioRef as any}
                  src={selectedTrack.audioUrl} 
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}
            </div>
            
            <div className="w-64 shrink-0 flex justify-end">
              {/* Volume or other controls could go here */}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full text-zinc-600 text-sm">
            Select a track to play
          </div>
        )}
      </div>
    </div>
  );
}
