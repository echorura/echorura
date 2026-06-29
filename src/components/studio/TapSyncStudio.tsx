import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, X, RotateCcw, Check, MousePointerClick, Undo2 } from 'lucide-react';

interface TapSyncStudioProps {
  audioUrl: string;
  initialLyrics: string;
  onComplete: (lrc: string) => void;
  onCancel: () => void;
}

function secondsToLrcTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export default function TapSyncStudio({ audioUrl, initialLyrics, onComplete, onCancel }: TapSyncStudioProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Parse initial lyrics
    const cleanLines = initialLyrics
      .split('\n')
      .map(l => l.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim()) // remove old tags if any
      .filter(l => l.length > 0);
    setLines(cleanLines);
    setTimestamps(new Array(cleanLines.length).fill(-1));
    setCurrentIdx(0);
  }, [initialLyrics]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore space if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          handleTap();
        } else {
          togglePlay();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, isPlaying, lines.length]);

  useEffect(() => {
    // Auto-scroll to active line
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentIdx]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTap = useCallback(() => {
    if (!isPlaying) return;
    if (currentIdx >= lines.length) return;
    if (!audioRef.current) return;

    const time = audioRef.current.currentTime;
    setTimestamps(prev => {
      const next = [...prev];
      next[currentIdx] = time;
      return next;
    });
    setCurrentIdx(prev => prev + 1);
  }, [currentIdx, lines.length, isPlaying]);

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
    setTimestamps(new Array(lines.length).fill(-1));
    setCurrentIdx(0);
  };

  const handleUndo = () => {
    if (currentIdx === 0) return;
    
    const prevIdx = currentIdx - 1;
    const timeToSeek = prevIdx === 0 ? 0 : Math.max(0, timestamps[prevIdx - 1] - 1); 
    
    if (audioRef.current) {
      audioRef.current.currentTime = timeToSeek;
      // Option: We could pause it, or let it keep playing from the slightly earlier point
    }
    
    setTimestamps(prev => {
      const next = [...prev];
      next[prevIdx] = -1;
      return next;
    });
    setCurrentIdx(prevIdx);
  };

  const handleFinish = () => {
    let result = '';
    for (let i = 0; i < lines.length; i++) {
      const timeStr = timestamps[i] >= 0 ? secondsToLrcTime(timestamps[i]) : '00:00.00';
      result += `[${timeStr}] ${lines[i]}\n`;
    }
    onComplete(result.trim());
  };

  const handleClose = () => {
    const hasProgress = timestamps.some(t => t >= 0);
    if (hasProgress) {
      if (window.confirm('您已经打了一部分时间轴，点击确定将保存目前的进度导出，取消则丢弃。')) {
        handleFinish();
        return;
      }
    }
    onCancel();
  };

  const formatDisplayTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full z-[9999] bg-[#0a0a0a] flex flex-col font-mono animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-black/50 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 md:gap-3">
            <MousePointerClick className="w-5 h-5 md:w-6 md:h-6 text-echo-primary" />
            录音棚打轴模式
          </h2>
          <p className="text-sm text-gray-400 mt-1">跟着音乐节奏，按下 <kbd className="bg-white/10 px-2 py-0.5 rounded text-white border border-white/20 shadow-sm mx-1">空格键 (Space)</kbd> 记录当前歌词的时间点。</p>
        </div>
        <button onClick={handleClose} className="p-3 hover:bg-white/10 rounded-full transition-colors active:scale-95">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Lyrics List */}
        <div ref={listRef} className="h-[40vh] shrink-0 md:h-auto md:flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 relative pb-[25vh] custom-scrollbar">
          {lines.length === 0 && (
            <div className="text-center text-gray-500 mt-10 flex flex-col items-center">
              <span className="text-4xl mb-4">📝</span>
              <p>您还没有输入任何文本歌词！</p>
              <p className="text-sm mt-2 opacity-50">请先在上一页粘贴歌词后再进入打轴模式。</p>
            </div>
          )}
          {lines.map((line, idx) => {
            const isDone = timestamps[idx] >= 0;
            const isActive = idx === currentIdx;
            return (
              <div 
                key={idx} 
                data-active={isActive}
                className={`flex gap-4 md:gap-6 transition-all duration-300 ${isActive ? 'scale-105 ml-2 md:ml-4' : 'opacity-60'} ${isDone ? 'text-echo-secondary' : isActive ? 'text-white font-black' : 'text-gray-500'}`}
              >
                <div className="w-16 md:w-24 text-right shrink-0 opacity-50 text-[10px] md:text-base mt-1 md:mt-2">
                  {isDone ? `[${secondsToLrcTime(timestamps[idx])}]` : '[--:--.--]'}
                </div>
                <div className={`text-base md:text-2xl lg:text-3xl ${isActive ? 'filter drop-shadow-[0_0_15px_rgba(0,240,255,0.45)]' : ''}`}>
                  {line}
                </div>
              </div>
            );
          })}
          {/* Spacer at bottom so last line can be scrolled to center */}
          <div className="h-64"></div>
        </div>

        {/* Right: Controls & Big Button */}
        <div className="flex-1 md:w-96 lg:w-[400px] md:flex-none border-t md:border-t-0 md:border-l border-white/5 bg-black/30 p-4 md:p-8 flex flex-col justify-center items-center shadow-2xl relative">
          
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Progress Circle & Play Control */}
          <div className="relative flex items-center justify-center mb-8 md:mb-12 group hidden md:flex">
            <svg className="w-48 h-48 md:w-56 md:h-56 transform -rotate-90">
              <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
              <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent" 
                strokeDasharray="283" 
                strokeDashoffset={283 - (currentTime / (duration || 1)) * 283}
                className="text-echo-primary transition-all duration-100 ease-linear" 
                pathLength="283"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl md:text-4xl font-black text-white">{formatDisplayTime(currentTime)}</span>
              <span className="text-sm md:text-base text-gray-500 mt-1">/ {formatDisplayTime(duration)}</span>
            </div>
            {/* Click circle to play/pause */}
            <div className="absolute inset-0 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center backdrop-blur-sm" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-12 h-12 text-white" fill="currentColor" /> : <Play className="w-12 h-12 text-white ml-2" fill="currentColor" />}
            </div>
          </div>

          <div className="flex gap-4 md:gap-6 mb-4 md:mb-16">
            <button onClick={handleReset} className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95" title="重头开始 (Reset)">
              <RotateCcw className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </button>
            <button onClick={handleUndo} disabled={currentIdx === 0} className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed" title="撤销上一句 (Undo)">
              <Undo2 className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </button>
            <button onClick={togglePlay} className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-echo-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_rgba(0,240,255,0.2)]" title="播放/暂停 (Play/Pause)">
              {isPlaying ? <Pause className="w-6 h-6 md:w-8 md:h-8 text-black" fill="currentColor" /> : <Play className="w-6 h-6 md:w-8 md:h-8 ml-1 md:ml-2 text-black" fill="currentColor" />}
            </button>
          </div>

          {/* Big Tap Button */}
          {currentIdx < lines.length ? (
            <button 
              onClick={handleTap}
              disabled={!isPlaying}
              className={`w-full py-8 md:py-16 rounded-3xl border-4 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 md:gap-4
                ${isPlaying 
                  ? 'border-echo-primary bg-echo-primary/10 text-echo-primary hover:bg-echo-primary/20 shadow-[0_0_50px_rgba(0,240,255,0.2)] cursor-pointer' 
                  : 'border-white/5 bg-white/5 text-gray-500 cursor-not-allowed'}`}
            >
              <MousePointerClick className={`w-8 h-8 md:w-16 md:h-16 ${isPlaying ? 'animate-bounce' : ''}`} />
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest">{isPlaying ? '敲击这里 (Tap)' : '等待播放...'}</span>
            </button>
          ) : (
            <button 
              onClick={handleFinish}
              className="w-full py-8 md:py-16 rounded-3xl border-4 border-echo-secondary bg-echo-secondary/20 text-echo-secondary transition-all hover:bg-echo-secondary/30 active:scale-95 shadow-[0_0_50px_rgba(255,200,0,0.3)] flex flex-col items-center justify-center gap-2 md:gap-4"
            >
              <Check className="w-8 h-8 md:w-16 md:h-16" />
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest">完成打轴 (导出)</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
