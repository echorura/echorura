"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Cpu, 
  Globe, 
  Coins, 
  X,
  Compass,
  Video,
  Square,
  Circle
} from 'lucide-react';
import Link from 'next/link';

// --- CHAPTERS & COPY DEFINITIONS ---
interface Chapter {
  id: number;
  labelEn: string;
  labelZh: string;
  titleEn: string;
  titleZh: string;
  subtitleEn: string;
  subtitleZh: string;
  descEn: string;
  descZh: string;
  color: string;
  accent: string;
  icon: any;
}

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    labelEn: "Chapter I: The Monolithic Wall",
    labelZh: "第一章：传统垄断的巨墙",
    titleEn: "Label Monopolies & Centralized Algorithmic Control",
    titleZh: "厂牌垄断与中心化算法钳制",
    subtitleEn: "Where does 95% of the music value go?",
    subtitleZh: "95% 的音乐版权价值流向了哪里？",
    descEn: "Traditional music platforms and labels siphon off the majority of artistic value. Listeners are trapped in algorithmic bubbles, while independent creators earn mere fractions of a cent per stream. Creative sovereignty has been lost to centralized intermediaries.",
    descZh: "在传统音乐产业链中，中心化巨头与垄断厂牌榨取了绝大部分收益。听众受困于算法信息茧房，而独立创作者每万次播放仅得微薄碎银。音乐的自主性与真正的价值被中心化中介彻底剥夺。",
    color: "from-red-950/40 via-purple-950/40 to-[#050508]",
    accent: "#ef4444",
    icon: X
  },
  {
    id: 2,
    labelEn: "Chapter II: Decentration & Web3 Paradigm",
    labelZh: "第二章：去中心化与 Web3 范式",
    titleEn: "Web3-Powered Autonomous Music Distribution Network",
    titleZh: "基于 Web3 技术的去中心化音乐版权共享平台",
    subtitleEn: "Breaking chains, empowering direct consensus.",
    subtitleZh: "打破垄断，重建创作者与听众的直接共识。",
    descEn: "ECHORURA is a Web3-powered decentralized music distribution and copyright value-sharing platform. Utilizing Web3 tech, we transform tracks into immutable creative assets, bypassing middlemen to channel value directly back to the ecosystem.",
    descZh: "ECHORURA 是基于 Web3 技术的去中心化音乐分发与版权价值共享平台。依托 Web3 技术，我们将每一首音乐资产化，彻底绕过寻租中介，让创作者与听众共享真正的版权溢价。",
    color: "from-blue-950/40 via-indigo-950/40 to-[#050508]",
    accent: "#3b82f6",
    icon: Globe
  },
  {
    id: 3,
    labelEn: "Chapter III: AI Co-Creation & Curation Arena",
    labelZh: "第三章：AI 时代的共创听审",
    titleEn: "DAO Curation & Sound Equity Investment Arena",
    titleZh: "AI 时代的“共创音乐，共享价值”闭环",
    subtitleEn: "Listeners are no longer consumers. They are curators & investors.",
    subtitleZh: "听众不再是被动的消费者，而是听审官与投资人。",
    descEn: "Connecting global creators and listeners in the AI era. In ECHORURA's Curation Arena, the community votes to launch songs into the market. Listeners invest in sound equities, share listen rewards, and build a powerful co-creation economy.",
    descZh: "依托 Web3 技术，在 AI 时代连接全球创作者与听众。在 ECHORURA 听审竞技场中，社区通过 DAO 投票决定歌曲的晋升。听众参与音乐版权份额投资，分享收听收益，打造共创价值闭环。",
    color: "from-emerald-950/40 via-teal-950/40 to-[#050508]",
    accent: "#10b981",
    icon: Cpu
  },
  {
    id: 4,
    labelEn: "Chapter IV: The Value Awakening",
    labelZh: "第四章：价值回归的纪元",
    titleEn: "Sound Unchained. Creative Sovereignty Restored.",
    titleZh: "让每一份音乐资产实现真正的价值回归",
    subtitleEn: "Decentralized Music Community Based on Web3 Technology.",
    subtitleZh: "ECHORURA 是基于 Web3 技术的去中心化音乐社区。",
    descEn: "In ECHORURA, both creating and listening are mining value. We return music to the people, and return earnings back to listeners and creators. By uniting AI creation, Web3 finance, and DAO governance, every music asset achieves its true value return.",
    descZh: "在 ECHORURA，创作与收听都是在挖掘价值。我们让音乐回归民众，让收益归于听众与创作者。通过融合 AI 创作、Web3 版权金融与去中心化治理，让每一份音乐资产在 Web3 时代实现真正的价值回归，开启听觉文艺复兴新纪元！",
    color: "from-amber-950/40 via-orange-950/40 to-[#050508]",
    accent: "#f59e0b",
    icon: Coins
  }
];

export default function PitchPage() {
  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showPrompt, setShowPrompt] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<any[]>([]);
  const requestRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  // Screen Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Time allocated for each chapter in seconds
  const chapterDurations = [12, 14, 15, 14]; 
  const totalDuration = chapterDurations.reduce((a, b) => a + b, 0);

  // Handle Recording Timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const startScreenRecording = async () => {
    try {
      recordedChunksRef.current = [];
      
      // Capture Screen Video
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true // Captures tab audio if shared
      });

      // Capture Synthesizer/Web Audio Output
      let finalStream = screenStream;
      if (audioContextRef.current) {
        try {
          const dest = audioContextRef.current.createMediaStreamDestination();
          // Find the master gain node and route it to the stream destination too
          const nodes = synthNodesRef.current;
          if (nodes && nodes[1]) {
            nodes[1].connect(dest);
          }
          
          // Combine both video tracks and audio tracks
          const tracks = [...screenStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
          // If the display stream already had tab audio, include it
          if (screenStream.getAudioTracks().length > 0) {
            tracks.push(...screenStream.getAudioTracks());
          }
          finalStream = new MediaStream(tracks);
        } catch (audioErr) {
          console.warn("Could not hook Web Audio node to recorder stream:", audioErr);
        }
      }

      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(finalStream, options);
      } catch (e) {
        // Fallback mimeType
        recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release screen sharing prompt
        finalStream.getTracks().forEach(track => track.stop());
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Auto trigger download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `ECHORURA_Roadshow_${new Date().toISOString().slice(0,10)}.webm`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start screen recording:", err);
      alert("启动录屏失败，请确保您授予了屏幕录制/共享权限。");
    }
  };

  const stopScreenRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- AUDIO SYNTHESIS ENGINE (WEB AUDIO API) ---
  const initAudio = () => {
    if (audioContextRef.current) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Master output gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.25, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Reverb / Delay Nodes
      const delay = ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.4, ctx.currentTime);
      const delayGain = ctx.createGain();
      delayGain.gain.setValueAtTime(0.3, ctx.currentTime);

      delay.connect(delayGain);
      delayGain.connect(delay);
      delayGain.connect(masterGain);

      // Lowpass Filter for cinematic warmth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(1.0, ctx.currentTime);
      filter.connect(delay);
      filter.connect(masterGain);

      synthNodesRef.current = [ctx, masterGain, filter];
      playChordsForScene(0); // Start initial drone chord
    } catch (e) {
      console.error("Failed to initialize synth audio context:", e);
    }
  };

  const playChordsForScene = (sceneIndex: number) => {
    const nodes = synthNodesRef.current;
    if (!nodes || nodes.length === 0) return;

    const [ctx, , filter] = nodes;
    const now = ctx.currentTime;

    // Gently sweep filter frequency based on scene energy
    const filterFreqs = [450, 950, 1400, 2200];
    filter.frequency.exponentialRampToValueAtTime(filterFreqs[sceneIndex] || 800, now + 3.0);

    // Stop previous oscillators if they exist
    nodes.filter(n => n.osc).forEach(n => {
      try {
        n.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        n.osc.stop(now + 1.6);
      } catch (err) {}
    });

    // Clear previous oscillators from our tracking references
    synthNodesRef.current = nodes.filter(n => !n.osc);

    // Construct beautiful chord progressions using Web Audio API
    // Scene 0: C2, C3, G3, D#3 (Dark, Monolith Drone)
    // Scene 1: F2, C3, F3, A3, C4 (Expanding, Web3 Paradigm)
    // Scene 2: G2, D3, G3, B3, D4, F#4 (AI co-creation visual rhythms)
    // Scene 3: C3, G3, C4, E4, G4, B4, D5 (Glorious Gold Ascension)
    const chordFrequencies = [
      [65.41, 130.81, 196.00, 155.56], // C2, C3, G3, D#3
      [87.31, 130.81, 174.61, 220.00, 261.63], // F2, C3, F3, A3, C4
      [98.00, 146.83, 196.00, 246.94, 293.66, 369.99], // G2, D3, G3, B3, D4, F#4
      [130.81, 196.00, 261.63, 329.63, 392.00, 493.88, 587.33] // C3, G3, C4, E4, G4, B4, D5
    ];

    const currentChord = chordFrequencies[sceneIndex] || chordFrequencies[0];

    currentChord.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      // Waveform design: Sawtooth for rich harmonics, filtered to be velvety
      osc.type = index % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Add extremely subtle detuning for gorgeous thick analog chorus effect
      osc.detune.setValueAtTime((Math.random() - 0.5) * 15, now);

      // Volume envelope: long, organic slow attack and gentle fade-in
      oscGain.gain.setValueAtTime(0.0001, now);
      const targetGain = 0.08 / currentChord.length;
      oscGain.gain.exponentialRampToValueAtTime(targetGain, now + 2.5 + index * 0.3);

      osc.connect(oscGain);
      oscGain.connect(filter);

      osc.start(now);

      // Save references so we can transition them on next scene
      synthNodesRef.current.push({
        osc,
        gainNode: oscGain
      });
    });
  };

  const handleMuteToggle = () => {
    const nodes = synthNodesRef.current;
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    if (showPrompt) {
      setShowPrompt(false);
    }

    if (!audioContextRef.current) {
      initAudio();
    } else {
      const [ctx, masterGain] = nodes;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      masterGain.gain.exponentialRampToValueAtTime(newMuteState ? 0 : 0.25, ctx.currentTime + 0.5);
    }
  };

  const triggerAwakening = () => {
    setShowPrompt(false);
    setIsMuted(false);
    initAudio();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // --- GLORIOUS 3D CANVAS PARTICLE RENDER ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Array<{
      x: number;
      y: number;
      z: number;
      ox: number;
      oy: number;
      oz: number;
      color: string;
      size: number;
      vx: number;
      vy: number;
      vz: number;
      angle: number;
      speed: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize 250 stunning three-dimensional floating starburst nodes
    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 280; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const radius = 100 + Math.random() * 300;

        particles.push({
          x: Math.sin(phi) * Math.cos(theta) * radius,
          y: Math.sin(phi) * Math.sin(theta) * radius,
          z: Math.cos(phi) * radius,
          ox: Math.sin(phi) * Math.cos(theta) * radius,
          oy: Math.sin(phi) * Math.sin(theta) * radius,
          oz: Math.cos(phi) * radius,
          color: `hsla(${200 + Math.random() * 60}, 90%, 70%, 0.8)`,
          size: 1.5 + Math.random() * 2.5,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          vz: (Math.random() - 0.5) * 0.5,
          angle: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.8
        });
      }
    };
    initParticles();

    // Glitch coordinates for Scene 1 (Monolith)
    let glitchLines: Array<{ y: number; h: number; speed: number; opacity: number }> = [];
    const spawnGlitch = () => {
      if (glitchLines.length > 5) return;
      glitchLines.push({
        y: Math.random() * canvas.height,
        h: 2 + Math.random() * 40,
        speed: (Math.random() - 0.5) * 30,
        opacity: 0.1 + Math.random() * 0.5
      });
    };

    let frame = 0;
    const render = () => {
      frame++;
      
      // Dynamic trail fading effect to simulate WebGL visual bleed
      ctx.fillStyle = "rgba(5, 5, 8, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Adjust particle behaviors based on the active scene context
      if (activeChapter === 0) {
        // --- SCENE 1: GLITCHED MONOLITH ENVIRONMENT ---
        if (Math.random() < 0.05) spawnGlitch();
        
        ctx.strokeStyle = "rgba(239, 68, 68, 0.04)";
        ctx.lineWidth = 1;
        for (let idx = 0; idx < canvas.width; idx += 80) {
          ctx.beginPath();
          ctx.moveTo(idx, 0);
          ctx.lineTo(idx, canvas.height);
          ctx.stroke();
        }

        glitchLines.forEach((line, index) => {
          ctx.fillStyle = `rgba(239, 68, 68, ${line.opacity})`;
          ctx.fillRect(0, line.y, canvas.width, line.h);
          line.y += Math.sin(frame * 0.1) * 2;
          line.opacity -= 0.01;
          if (line.opacity <= 0) glitchLines.splice(index, 1);
        });

        ctx.shadowBlur = 40;
        ctx.shadowColor = "rgba(239, 68, 68, 0.15)";
        ctx.fillStyle = "rgba(15, 10, 15, 0.9)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(centerX - 120 + Math.sin(frame * 0.05) * 1.5, centerY - 200, 240, 400);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        particles.slice(0, 150).forEach(p => {
          p.x += (Math.random() - 0.5) * 4;
          p.y += p.vy * 2 - 1.5; 
          
          if (p.y < -centerY) p.y = centerY;

          const screenX = centerX + p.x;
          const screenY = centerY + p.y;

          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(239, 68, 68, 0.55)";
          ctx.fill();
        });

      } else if (activeChapter === 1) {
        // --- SCENE 2: LEDGER NETWORKS ORBITS ---
        const rotX = frame * 0.003;
        const rotY = frame * 0.005;

        ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
        ctx.lineWidth = 1;

        const renderedPoints: Array<{ sx: number; sy: number }> = [];

        particles.slice(0, 180).forEach((p, idx) => {
          let x1 = p.ox;
          let y1 = p.oy * Math.cos(rotX) - p.oz * Math.sin(rotX);
          let z1 = p.oy * Math.sin(rotX) + p.oz * Math.cos(rotX);

          let x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
          let y2 = y1;
          let z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);

          const fov = 350;
          const scale = fov / (fov + z2);
          const screenX = centerX + x2 * scale;
          const screenY = centerY + y2 * scale;

          renderedPoints.push({ sx: screenX, sy: screenY });

          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * scale * 1.3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${210 + (idx % 20)}, 95%, 70%, ${Math.max(0.2, scale - 0.4)})`;
          ctx.fill();

          if (idx > 0 && idx % 7 === 0) {
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            for (let c = 1; c <= 3; c++) {
              const target = renderedPoints[idx - c];
              if (target) {
                ctx.lineTo(target.sx, target.sy);
              }
            }
            ctx.stroke();
          }
        });

      } else if (activeChapter === 2) {
        // --- SCENE 3: AUDIO-REACTIVE WAVES AND VIBRANT GREEN ORBS ---
        ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
        ctx.lineWidth = 2;

        const pulseAmp = 20 + Math.sin(frame * 0.15) * 15;
        
        for (let r = 1; r <= 3; r++) {
          const radius = (frame * r * 2.5) % 350;
          const opacity = Math.max(0, 1 - radius / 350) * 0.3;
          ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 10) {
          const waveY = centerY + Math.sin(x * 0.01 + frame * 0.08) * pulseAmp * Math.cos(x * 0.002 - 1.5);
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();

        particles.slice(0, 200).forEach((p, idx) => {
          p.angle += 0.02 * p.speed;
          const orbitRadius = 120 + 80 * Math.sin(idx * 0.2) + Math.cos(frame * 0.01) * 30;
          
          p.x = Math.cos(p.angle) * orbitRadius;
          p.y = Math.sin(p.angle) * orbitRadius + Math.sin(frame * 0.05 + idx) * 8;

          const screenX = centerX + p.x;
          const screenY = centerY + p.y;

          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * (1.1 + Math.sin(frame * 0.1 + idx) * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + Math.sin(frame * 0.05 + idx) * 0.3})`;
          ctx.fill();
        });

      } else if (activeChapter === 3) {
        // --- SCENE 4: HYPER-DRIVE GOLDEN EXPLOSION ---
        particles.forEach((p, idx) => {
          p.speed += 0.08;
          p.ox += Math.cos(p.angle) * p.speed;
          p.oy += Math.sin(p.angle) * p.speed;

          const screenX = centerX + p.ox;
          const screenY = centerY + p.oy;

          if (screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height) {
            p.speed = 0.5 + Math.random() * 1.5;
            p.ox = (Math.random() - 0.5) * 30;
            p.oy = (Math.random() - 0.5) * 30;
            p.angle = Math.random() * Math.PI * 2;
          }

          ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.8, p.speed * 0.08)})`;
          ctx.lineWidth = p.size * 0.6;
          ctx.beginPath();
          ctx.moveTo(screenX - Math.cos(p.angle) * p.speed * 1.2, screenY - Math.sin(p.angle) * p.speed * 1.2);
          ctx.lineTo(screenX, screenY);
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });

        const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 150 + Math.sin(frame * 0.1) * 15);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        grad.addColorStop(0.3, "rgba(245, 158, 11, 0.45)");
        grad.addColorStop(0.7, "rgba(251, 191, 36, 0.08)");
        grad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 160 + Math.sin(frame * 0.1) * 15, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [activeChapter]);

  // --- AUTOMATIC TIMELINE PLAYBACK ENGINE ---
  useEffect(() => {
    if (!isPlaying) return;

    const interval = 100; 
    const stepIncrement = (interval / 1000) / chapterDurations[activeChapter];

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + stepIncrement;
        if (next >= 1.0) {
          if (activeChapter < CHAPTERS.length - 1) {
            const nextIdx = activeChapter + 1;
            setActiveChapter(nextIdx);
            playChordsForScene(nextIdx);
            return 0;
          } else {
            setActiveChapter(0);
            playChordsForScene(0);
            return 0;
          }
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, activeChapter]);

  const handleNext = () => {
    if (activeChapter < CHAPTERS.length - 1) {
      const next = activeChapter + 1;
      setActiveChapter(next);
      playChordsForScene(next);
      setProgress(0);
    } else {
      setActiveChapter(0);
      playChordsForScene(0);
      setProgress(0);
    }
  };

  const handlePrev = () => {
    if (activeChapter > 0) {
      const prev = activeChapter - 1;
      setActiveChapter(prev);
      playChordsForScene(prev);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#050508] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      
      {/* 1. IMMERSIVE GLOWING BACKGROUND CANVAS */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

      {/* Dynamic Colored Radial Ambient Blur Overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-b opacity-80 pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(5,5,8,0.2) 0%, #050508 100%)`
        }}
      />
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-color-dodge transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${CHAPTERS[activeChapter].accent}20 0%, transparent 60%)`
        }}
      />

      {/* 2. TOP BRANDING & PROGRESSION PANEL */}
      <header className="relative z-10 w-full px-6 md:px-12 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
        
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Compass className="w-4 h-4 text-black animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-[0.25em] text-white flex items-center gap-1.5 uppercase italic">
              ECHORURA <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-black font-black uppercase not-italic font-sans">WEB3</span>
            </h1>
            <p className="text-[8px] text-gray-500 tracking-wider uppercase font-mono mt-0.5">Decentralized Sound Ecosystem</p>
          </div>
        </div>

        {/* Global Auto-Advance Progress Indicators */}
        <div className="flex-1 max-w-xl md:mx-12 flex items-center gap-2">
          {CHAPTERS.map((ch, idx) => (
            <div 
              key={ch.id} 
              onClick={() => {
                setActiveChapter(idx);
                playChordsForScene(idx);
                setProgress(0);
              }}
              className="flex-1 h-1.5 rounded-full bg-white/10 relative overflow-hidden cursor-pointer group transition-all"
            >
              {idx === activeChapter && (
                <motion.div 
                  layoutId="activeBar"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: ch.accent }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              )}
              {idx < activeChapter && (
                <div 
                  className="absolute inset-0 rounded-full" 
                  style={{ backgroundColor: ch.accent, opacity: 0.6 }} 
                />
              )}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            </div>
          ))}
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleMuteToggle}
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer"
            title="音效开关"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />}
          </button>

          <Link href="/">
            <button className="px-4 py-2 rounded-full border border-amber-500/30 hover:border-amber-500/80 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black text-xs font-black tracking-widest uppercase transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              进入平台 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </header>

      {/* 3. CENTRAL CINEMATIC CONTENT CANVAS SLIDES */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-6 md:px-12 flex flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChapter}
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col gap-6 md:gap-8"
          >
            <div>
              <span 
                className="px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black tracking-[0.3em] uppercase bg-white/5 border border-white/10 transition-colors"
                style={{ borderColor: `${CHAPTERS[activeChapter].accent}30`, color: CHAPTERS[activeChapter].accent }}
              >
                {CHAPTERS[activeChapter].labelZh}
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight md:leading-none text-white italic">
                {CHAPTERS[activeChapter].titleZh}
              </h2>
              <h3 className="text-lg md:text-2xl font-light text-gray-400 font-mono tracking-wide">
                {CHAPTERS[activeChapter].titleEn}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div 
                className="w-1.5 h-6 rounded-full" 
                style={{ backgroundColor: CHAPTERS[activeChapter].accent }}
              />
              <p className="text-sm md:text-lg font-bold text-amber-400 italic">
                “ {CHAPTERS[activeChapter].subtitleZh} ” &nbsp;
                <span className="font-light text-gray-500 not-italic text-xs md:text-sm font-mono">{CHAPTERS[activeChapter].subtitleEn}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
              <div className="md:col-span-8 space-y-4">
                <p className="text-sm md:text-base leading-relaxed text-gray-300 font-medium font-sans">
                  {CHAPTERS[activeChapter].descZh}
                </p>
                <p className="text-xs md:text-sm leading-relaxed text-gray-500 font-mono font-light">
                  {CHAPTERS[activeChapter].descEn}
                </p>
              </div>
              
              <div className="md:col-span-4 flex items-center md:justify-end">
                <div className="w-full md:w-auto p-5 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-md flex flex-col gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                    style={{ backgroundColor: `${CHAPTERS[activeChapter].accent}20` }}
                  >
                    {React.createElement(CHAPTERS[activeChapter].icon, { className: "w-5 h-5", style: { color: CHAPTERS[activeChapter].accent } })}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white tracking-widest">Platform Core Ethos</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">Web3 Auditory Revolution</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. BOTTOM INTERACTION BAR */}
      <footer className="relative z-10 w-full px-6 md:px-12 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-white/5 bg-black/10 backdrop-blur-sm">
        
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrev}
            disabled={activeChapter === 0}
            className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:border-white/30 text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
          </button>

          <button
            onClick={handleNext}
            className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:border-white/30 text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Premium Screen Recorder Trigger */}
          <div className="h-8 w-[1px] bg-white/10 mx-2" />

          {isRecording ? (
            <button
              onClick={stopScreenRecording}
              className="px-4 h-12 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 flex items-center gap-2.5 text-red-400 hover:text-red-300 transition-all cursor-pointer animate-pulse font-mono text-xs font-bold"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
              <span>录制中 {formatRecordingTime(recordingTime)}</span>
              <Square className="w-4 h-4 fill-red-400" />
            </button>
          ) : (
            <button
              onClick={startScreenRecording}
              className="px-4 h-12 rounded-full border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-2.5 text-gray-400 hover:text-amber-400 transition-all cursor-pointer font-mono text-xs"
              title="一键录制当前路演页（含系统/标签页声音）"
            >
              <Circle className="w-3.5 h-3.5 fill-gray-500" />
              <span>一键录屏</span>
              <Video className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col md:items-end">
          <p className="text-xs font-black text-white/40 tracking-[0.4em] uppercase">
            共创音乐 · 共享价值
          </p>
          <p className="text-[9px] text-gray-600 font-mono tracking-widest mt-1 uppercase">
            Co-Create Music, Share Copyright Value
          </p>
        </div>
      </footer>

      {/* 5. GORGEOUS INTRUSIVE INITIAL INTERACTION GATE */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(30px)', scale: 1.05 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 z-[250] bg-[#050508] flex flex-col items-center justify-center px-6 text-center select-none"
          >
            <div className="relative w-64 h-64 mb-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/20 animate-spin-slow" />
              <div className="absolute w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-amber-500/20 to-purple-600/20 blur-3xl animate-pulse" />
              <motion.div 
                animate={{ scale: [1, 1.08, 1], rotate: [0, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-32 h-32 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl"
              >
                <Compass className="w-14 h-14 text-amber-400 animate-pulse" />
              </motion.div>
            </div>

            <h2 className="text-3xl md:text-5xl font-black tracking-[0.2em] italic text-white leading-tight uppercase font-sans">
              ECHORURA ROADSHOW
            </h2>
            <p className="text-xs md:text-sm font-mono tracking-[0.4em] text-gray-400 mt-3 uppercase">
              极声去中心化路演 DEMO · 听觉文艺复兴
            </p>

            <div className="w-12 h-[1px] bg-white/10 my-8" />

            <button
              onClick={triggerAwakening}
              className="px-12 py-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-full text-xs font-black tracking-[0.4em] uppercase transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl shadow-amber-500/20 cursor-pointer"
            >
              开启视听路演 / Enter Cinematic Demo
            </button>
            
            <p className="text-[10px] text-gray-500 mt-4 tracking-widest font-mono">
              * Recommended to turn on sound for full high-fidelity analog synth experience
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
