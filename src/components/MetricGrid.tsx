import React from 'react';
import { Activity, Minimize2, Check } from 'lucide-react';

interface MetricGridProps {
  lyricsText: string;
}

export default function MetricGrid({ lyricsText }: MetricGridProps) {
  // Syllable counting rules
  const countSyllables = (word: string) => {
    word = word.toLowerCase().trim().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const match = word.match(/[aeiouy]{1,2}/g);
    return match ? match.length : 1;
  };

  const countLineSyllables = (line: string) => {
    // Exclude chord labels or bracket markers (e.g. [Chorus])
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      return 0;
    }
    return line.split(/\s+/).reduce((acc, word) => acc + countSyllables(word), 0);
  };

  const lines = lyricsText.split('\n').map((line, i) => {
    const isSectionLabel = line.trim().startsWith('[') && line.trim().endsWith(']');
    const count = countLineSyllables(line);
    return {
      index: i + 1,
      text: line,
      isSectionLabel,
      syllableCount: count
    };
  });

  const activeLines = lines.filter(l => l.text.trim() && !l.isSectionLabel);
  const totalSyllables = activeLines.reduce((acc, l) => acc + l.syllableCount, 0);
  const averageSyllables = activeLines.length ? Math.round(totalSyllables / activeLines.length) : 0;

  // Evaluate rhythm consistency (Standard deviation / flatness of variation)
  const isConsistent = activeLines.length > 1 && (() => {
    const variance = activeLines.reduce((acc, l) => acc + Math.pow(l.syllableCount - averageSyllables, 2), 0) / activeLines.length;
    return variance < 9; // very flat meter / balanced structure
  })();

  return (
    <div className="bg-zinc-950/60 border border-zinc-900 rounded-[32px] p-6 space-y-6 shadow-inner select-text">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Rhythmic Syllable Matrix Grid</h4>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Real-Time Syllable Densities & Metric Balance Metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Average syllables</span>
            <span className="text-sm font-black text-white font-mono">{averageSyllables || '--'}</span>
          </div>
          <div className="text-right">
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Meter status</span>
            <span className={`text-[9px] font-black uppercase tracking-wider ${isConsistent ? 'text-green-400' : 'text-amber-400'}`}>
              {activeLines.length < 2 ? 'Calibrating...' : isConsistent ? 'Symmetric (Symphonic)' : 'Fluid / Dynamic'}
            </span>
          </div>
        </div>
      </div>

      {/* The Lines List Grid */}
      <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-zinc-900/60 custom-scrollbar pr-1 divide-y divide-zinc-950">
        {lines.map((line, i) => {
          if (!line.text.trim()) {
            return (
              <div key={i} className="py-1 px-4 text-[10px] text-zinc-800 italic" id={`empty-line-${i}`}>
                (Blank paragraph spacer)
              </div>
            );
          }

          if (line.isSectionLabel) {
            return (
              <div key={i} className="py-2.5 px-4 bg-zinc-950/40 text-[9px] font-black text-indigo-400 uppercase tracking-widest" id={`section-label-${i}`}>
                {line.text}
              </div>
            );
          }

          const relativeDiff = averageSyllables ? line.syllableCount - averageSyllables : 0;
          const isOutlier = Math.abs(relativeDiff) > 4;

          return (
            <div key={i} className="py-2.5 px-4 hover:bg-zinc-900/30 flex items-center justify-between gap-4 transition-all" id={`metric-line-${line.index}`}>
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <span className="text-[8.5px] font-mono text-zinc-600 font-bold">{line.index}</span>
                <p className="text-xs text-zinc-300 font-medium truncate leading-relaxed">{line.text}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Visual meter bar */}
                <div className="w-16 h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOutlier ? 'bg-amber-500' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                    }`}
                    style={{ width: `${Math.min(100, (line.syllableCount / 20) * 100)}%` }}
                  />
                </div>
                
                {/* Badge count */}
                <span className={`w-8 text-center text-[10px] font-black font-mono rounded px-1.5 py-0.5 ${
                  isOutlier 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' 
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}>
                  {line.syllableCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-zinc-950/20 border border-white/[0.01] rounded-2xl text-[9px] text-zinc-500 leading-relaxed font-sans flex items-start gap-2 select-text">
        <Check className="w-4 h-4 text-green-500/80 shrink-0 mt-0.5" />
        <span>
          A perfectly balanced strophic verse pattern maintains flat line metric deviations (average deviation of less than 3 syllables). Keeping line counts symmetric balances live cadence rendering in audio production!
        </span>
      </div>
    </div>
  );
}
