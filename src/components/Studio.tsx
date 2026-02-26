import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, Youtube, Plus, Music, FileText, Trash2, Loader2, CheckCircle2 } from 'lucide-react';

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
};

export default function Studio() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [styleTags, setStyleTags] = useState('');

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
      const res = await fetch('/api/auth/youtube/url');
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">Lyrics</label>
              <textarea 
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="[Verse 1]&#10;Enter lyrics here..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm h-48 resize-none focus:outline-none focus:border-indigo-500 custom-scrollbar"
              />
            </div>
            <button 
              onClick={handleCreateTrack}
              disabled={!title.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save to Workspace
            </button>
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
                    {!track.audioUrl ? (
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

        {/* Right Panel: Lyrics */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Lyrics
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {selectedTrack ? (
              <div className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">
                {selectedTrack.lyrics || <span className="text-zinc-600 italic">No lyrics provided.</span>}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                Select a track to view lyrics.
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
