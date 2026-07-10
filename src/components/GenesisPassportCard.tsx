'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseAbi } from 'viem';
import { createClient } from '@/utils/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { CONTRACT_ADDRESSES, GenesisPassportABI } from '@/contracts/config';
import { BUILDER_CODE_SUFFIX } from '@/utils/erc8021';
import { GenerativeAudioEngine } from '@/utils/GenerativeAudioEngine';
import { 
  Sparkles, 
  Music, 
  Loader2, 
  HelpCircle, 
  ShieldAlert,
  X,
  Wifi,
  Battery,
  Globe2,
  Play,
  Share2,
  Camera,
  Download,
  QrCode
} from 'lucide-react';

const audioEngine = new GenerativeAudioEngine();

export default function GenesisPassportCard() {
  const { language } = useLanguageStore();
  const { address: connectedAddress, isConnected } = useAccount();
  const supabase = createClient();

  // App & User state
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // AR sharing modal states
  const [showARModal, setShowARModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Parallax Tilt state
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rotateX, setRotateX] = useState(8);
  const [rotateY, setRotateY] = useState(-10);

  // Translations dictionary
  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      title: { zh: '创世会员通行证', en: 'Genesis Member Passport' },
      subtitle: { zh: '极声音乐 Genesis 勋章', en: 'ECHORURA Genesis SBT' },
      connectWallet: { zh: '请先连接 Base 智能钱包', en: 'Connect Base Smart Wallet first' },
      claim: { zh: '免费申领创世勋章', en: 'Claim Genesis Passport' },
      claiming: { zh: '正在生成智能凭证并铸造...', en: 'Generating signature & minting...' },
      claimed: { zh: '您已拥有该创世通行证 🛡️', en: 'Genesis Passport Owned 🛡️' },
      reserved: { zh: '编号 #00001-00010 已预留为创始人钱包', en: 'Serials #00001-00010 reserved for founders' },
      nonTransferable: { zh: '灵魂绑定安全协议 (SBT) · 终身不可转让', en: 'Soulbound Token (SBT) · Non-Transferable' },
      musicTip: { zh: '🎵 点击卡片播放此编号的唯一生成式音乐', en: '🎵 Click card to play unique generative music' },
      shareAR: { zh: 'AR 虚实共鸣空间', en: 'AR Spatial Sharing' },
      errorSig: { zh: '获取签名失败，请联系客服', en: 'Failed to retrieve signature, contact support' },
      successClaim: { zh: '🎉 创世勋章铸造成功！', en: '🎉 Passport Minted Successfully!' },
      number: { zh: '席位编号', en: 'MEMBER NO.' },
      ar_guide: { zh: '扫描二维码在移动端查看您的创世勋章，或开启摄像头进行 AR 空间投影拍照分享', en: 'Scan QR code on mobile, or enable camera to project in AR and share' },
      camera_btn: { zh: '开启 AR 摄像头', en: 'Open AR Camera' },
      camera_close: { zh: '关闭摄像头', en: 'Close Camera' },
      download_poster: { zh: '保存分享海报', en: 'Save Share Poster' },
      playing: { zh: '音乐共振中...', en: 'Resonating...' },
      paused: { zh: '点击启动共鸣', en: 'Click to Resonate' },
    };
    const lang = language === 'zh' || language === 'en' ? language : 'zh';
    return dict[key]?.[lang] || key;
  };

  // Fetch current user member number from Supabase profiles
  useEffect(() => {
    const fetchMemberNumber = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('member_number')
            .eq('id', user.id)
            .single();
          if (!error && data) {
            setMemberNumber(data.member_number);
          }
        }
      } catch (err) {
        console.error('Error fetching member number:', err);
      } finally {
        setLoadingMember(false);
      }
    };
    fetchMemberNumber();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read contract to check if this member number has been minted
  const { data: isAlreadyMintedOnChain, refetch: refetchMintStatus } = useReadContract({
    address: CONTRACT_ADDRESSES.GenesisPassport as `0x${string}`,
    abi: parseAbi(GenesisPassportABI as any),
    functionName: 'numberMinted',
    args: memberNumber ? [BigInt(memberNumber)] : undefined,
    query: {
      enabled: !!memberNumber && CONTRACT_ADDRESSES.GenesisPassport !== '0x0000000000000000000000000000000000000000',
    }
  });

  const hasMinted = !!isAlreadyMintedOnChain;

  // Signer write function
  const { writeContractAsync } = useWriteContract();

  // Handle claiming Passport
  const handleClaim = async () => {
    if (!isConnected || !connectedAddress) {
      alert(t('connectWallet'));
      return;
    }
    if (memberNumber === null) {
      alert('无法读取您的会员编号');
      return;
    }
    if (memberNumber <= 10) {
      alert(t('reserved'));
      return;
    }

    setIsMinting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('登录状态已失效，请重新登录');
        setIsMinting(false);
        return;
      }

      const response = await fetch('/api/genesis/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ walletAddress: connectedAddress })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || t('errorSig'));
      }

      const { memberNumber: signedNumber, signature, contractAddress } = resData;

      const txHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(GenesisPassportABI as any),
        functionName: 'claimPassport',
        args: [BigInt(signedNumber), signature],
        dataSuffix: BUILDER_CODE_SUFFIX,
      });

      console.log('[Genesis Claim] Transaction sent, hash:', txHash);
      alert('交易已提交至 Base 链上！请等待区块打包确认（约需几秒钟）...');
      
      setTimeout(async () => {
        await refetchMintStatus();
        setIsMinting(false);
        alert(t('successClaim'));
      }, 5000);

    } catch (err: any) {
      console.error('[Genesis Claim Error]', err);
      alert('申领失败: ' + (err.message || err));
      setIsMinting(false);
    }
  };

  // Toggle Generative Audio Loop
  const toggleAudio = () => {
    if (!memberNumber) return;
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
    } else {
      audioEngine.start(memberNumber);
      setIsPlaying(true);
    }
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);

  // Visualizer Canvas Loop - 3D Wireframe Audio Core Sphere (Figure 1 style)
  useEffect(() => {
    let animId: number;

    let rotationY = 0;
    let rotationX = 0.35; // base tilt
    let pulsePhase = 0;

    const draw = () => {
      animId = requestAnimationFrame(draw);

      const canvases = [canvasRef.current, arCanvasRef.current].filter(Boolean) as HTMLCanvasElement[];
      
      // Update rotation angles once per frame
      rotationY += isPlaying ? 0.012 : 0.003;
      rotationX += isPlaying ? 0.005 : 0.001;
      pulsePhase += 0.03;

      const baseRadius = 72;
      const frequencies = isPlaying ? audioEngine.getFrequencyData() : new Uint8Array(64);
      const avgFreq = frequencies.length > 0 
        ? Array.from(frequencies).reduce((a, b) => a + b, 0) / frequencies.length 
        : 0;

      // Segment interface for Painter's Algorithm sorting
      interface Segment {
        x1: number; y1: number; z1: number;
        x2: number; y2: number; z2: number;
        colorType: 'cyan' | 'magenta';
        isVertical: boolean;
      }
      const segments: Segment[] = [];

      // 1. Gather Latitudinal Rings
      const ringCount = 9;
      const ringPoints = 72; // high resolution rings
      for (let r = 0; r < ringCount; r++) {
        const lat = -Math.PI / 2 + (Math.PI * (r + 1)) / (ringCount + 1);
        const points: {x: number, y: number, z: number}[] = [];

        for (let p = 0; p <= ringPoints; p++) {
          const lon = (p * 2 * Math.PI) / ringPoints;
          let R = baseRadius;
          
          if (isPlaying) {
            const freqIndex = Math.floor(((lon + lat) / (Math.PI * 2)) * frequencies.length) % frequencies.length;
            const freqVal = frequencies[freqIndex] || 0;
            R += Math.sin(lon * 8 + pulsePhase) * (freqVal * 0.18 + 2.5);
          } else {
            R += Math.sin(lon * 6 + pulsePhase) * 2.5;
          }

          const x = R * Math.cos(lat) * Math.cos(lon);
          const y = R * Math.sin(lat);
          const z = R * Math.cos(lat) * Math.sin(lon);

          // Rotate Y
          const x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY);
          const z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY);
          // Rotate X
          const y2 = y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
          const z2 = y * Math.sin(rotationX) + z1 * Math.cos(rotationX);

          points.push({ x: x1, y: y2, z: z2 });
        }

        for (let p = 0; p < ringPoints; p++) {
          segments.push({
            x1: points[p].x, y1: points[p].y, z1: points[p].z,
            x2: points[p + 1].x, y2: points[p + 1].y, z2: points[p + 1].z,
            colorType: r % 2 === 0 ? 'cyan' : 'magenta',
            isVertical: false
          });
        }
      }

      // 2. Gather Longitudinal Rings
      const longiCount = 4;
      for (let lg = 0; lg < longiCount; lg++) {
        const lon = (lg * Math.PI) / longiCount;
        const points: {x: number, y: number, z: number}[] = [];

        for (let p = 0; p <= ringPoints; p++) {
          const lat = -Math.PI / 2 + (p * Math.PI) / ringPoints;
          let R = baseRadius;
          
          if (isPlaying) {
            const freqIndex = Math.floor(((lon + lat) / (Math.PI * 2)) * frequencies.length) % frequencies.length;
            const freqVal = frequencies[freqIndex] || 0;
            R += Math.sin(lat * 8 + pulsePhase) * (freqVal * 0.18 + 2.5);
          } else {
            R += Math.sin(lat * 6 + pulsePhase) * 2.5;
          }

          const x = R * Math.cos(lat) * Math.cos(lon);
          const y = R * Math.sin(lat);
          const z = R * Math.cos(lat) * Math.sin(lon);

          // Rotate Y
          const x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY);
          const z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY);
          // Rotate X
          const y2 = y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
          const z2 = y * Math.sin(rotationX) + z1 * Math.cos(rotationX);

          points.push({ x: x1, y: y2, z: z2 });
        }

        for (let p = 0; p < ringPoints; p++) {
          segments.push({
            x1: points[p].x, y1: points[p].y, z1: points[p].z,
            x2: points[p + 1].x, y2: points[p + 1].y, z2: points[p + 1].z,
            colorType: lg % 2 === 0 ? 'cyan' : 'magenta',
            isVertical: true
          });
        }
      }

      const backSegments = segments.filter(s => (s.z1 + s.z2) / 2 < 0);
      const frontSegments = segments.filter(s => (s.z1 + s.z2) / 2 >= 0);

      canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (canvas.width !== 320) canvas.width = 320;
        if (canvas.height !== 450) canvas.height = 450;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cX = canvas.width / 2;
        const cY = canvas.height / 2 + 10;

        const renderSegment = (s: Segment) => {
          const avgZ = (s.z1 + s.z2) / 2;
          const maxRadiusWithRipple = baseRadius + 15;
          const depthScale = (avgZ + maxRadiusWithRipple) / (2 * maxRadiusWithRipple);
          
          const alpha = s.isVertical ? (0.06 + depthScale * 0.58) : (0.12 + depthScale * 0.83);
          const width = s.isVertical ? (0.2 + depthScale * 0.9) : (0.4 + depthScale * 1.6);

          ctx.beginPath();
          ctx.moveTo(cX + s.x1, cY + s.y1);
          ctx.lineTo(cX + s.x2, cY + s.y2);
          
          ctx.strokeStyle = s.colorType === 'cyan' 
            ? `rgba(0, 240, 255, ${alpha})` 
            : `rgba(217, 70, 239, ${alpha})`;
          ctx.lineWidth = width;
          
          ctx.shadowBlur = isPlaying ? (6 + depthScale * 12) : (2 + depthScale * 4);
          ctx.shadowColor = s.colorType === 'cyan' ? '#00f0ff' : '#d946ef';
          ctx.stroke();
        };

        // Draw back segments
        backSegments.forEach(renderSegment);

        // Center Glow Core
        const coreSize = 12 + avgFreq * 0.15;
        const coreGrad = ctx.createRadialGradient(cX, cY, 1, cX, cY, coreSize * 2.5);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        coreGrad.addColorStop(0.2, 'rgba(0, 240, 255, 0.95)');
        coreGrad.addColorStop(0.5, 'rgba(217, 70, 239, 0.65)');
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cX, cY, coreSize * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Soundwave horizontal line
        const laserGrad = ctx.createLinearGradient(cX - 120, cY, cX + 120, cY);
        laserGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        laserGrad.addColorStop(0.2, 'rgba(0, 240, 255, 0.85)');
        laserGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        laserGrad.addColorStop(0.8, 'rgba(217, 70, 239, 0.85)');
        laserGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');

        ctx.strokeStyle = laserGrad;
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = isPlaying ? 16 : 8;
        ctx.shadowColor = '#00f0ff';
        ctx.beginPath();
        
        for (let x = cX - 110; x <= cX + 110; x += 4) {
          const offsetPct = (x - (cX - 110)) / 220;
          const freqIndex = Math.floor(offsetPct * frequencies.length) % frequencies.length;
          const amplitude = isPlaying ? (frequencies[freqIndex] || 0) * 0.16 : 0;
          const yOffset = Math.sin(offsetPct * Math.PI * 10 + pulsePhase * 2.5) * amplitude;
          
          if (x === cX - 110) ctx.moveTo(x, cY + yOffset);
          else ctx.lineTo(x, cY + yOffset);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;
        // Draw front segments
        frontSegments.forEach(renderSegment);
        ctx.shadowBlur = 0;
      });
    };

    draw();
    return () => cancelAnimationFrame(animId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, loadingMember, showARModal]);

  // Parallax Tilt effect calculation
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cX = rect.width / 2;
    const cY = rect.height / 2;
    // Interactive tilt relative to the default 3D posture (8 deg X, -10 deg Y)
    const rx = 8 + ((cY - y) / cY) * 6;
    const ry = -10 + ((x - cX) / cX) * 8;
    setRotateX(rx);
    setRotateY(ry);
  };

  const handleMouseLeave = () => {
    setRotateX(8);
    setRotateY(-10);
  };

  // AR Camera control
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Camera fail:', e);
      alert('摄像头开启失败，请确保授予权限或切换到 HTTPS 环境');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (!showARModal) {
      stopCamera();
    }
  }, [showARModal]);

  // Generate share code URL
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wallet` : 'https://echorura.com';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=00f0ff&bgcolor=09090c&data=${encodeURIComponent(shareUrl)}`;

  // Download high-fidelity share poster using HTML5 Canvas
  const downloadPoster = async () => {
    setIsGeneratingPoster(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas 2d context');

      // 1. Fill Space background
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, 800, 1200);

      // Stars
      ctx.fillStyle = '#ffffff';
      const stars = [
        { x: 120, y: 150, r: 1.5 },
        { x: 680, y: 180, r: 1 },
        { x: 150, y: 850, r: 2 },
        { x: 640, y: 920, r: 1.5 },
        { x: 300, y: 80, r: 1 },
        { x: 520, y: 1120, r: 2 }
      ];
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Space nebulas (glowing layers)
      const pGlow = ctx.createRadialGradient(250, 400, 50, 250, 400, 400);
      pGlow.addColorStop(0, 'rgba(88, 28, 135, 0.22)');
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGlow;
      ctx.beginPath();
      ctx.arc(250, 400, 400, 0, Math.PI * 2);
      ctx.fill();

      const cGlow = ctx.createRadialGradient(550, 800, 50, 550, 800, 450);
      cGlow.addColorStop(0, 'rgba(6, 182, 212, 0.18)');
      cGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cGlow;
      ctx.beginPath();
      ctx.arc(550, 800, 450, 0, Math.PI * 2);
      ctx.fill();

      // Tech Grid background lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 800; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1200);
        ctx.stroke();
      }
      for (let y = 0; y < 1200; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // 2. Draw card frame in the center
      const w = 420;
      const h = 600;
      const x0 = 400 - w / 2; // 190
      const y0 = 480 - h / 2; // 180
      const d = 40; // bevel size

      ctx.save();

      // Card boundary path
      ctx.beginPath();
      ctx.moveTo(x0 + d, y0);
      ctx.lineTo(x0 + w - d, y0);
      ctx.lineTo(x0 + w, y0 + d);
      ctx.lineTo(x0 + w, y0 + h - d);
      ctx.lineTo(x0 + w - d, y0 + h);
      ctx.lineTo(x0 + d, y0 + h);
      ctx.lineTo(x0, y0 + h - d);
      ctx.lineTo(x0, y0 + d);
      ctx.closePath();

      // Dark glass card fill
      const glassFill = ctx.createLinearGradient(x0, y0, x0 + w * 0.1, y0 + h);
      glassFill.addColorStop(0, 'rgba(12, 12, 22, 0.90)');
      glassFill.addColorStop(0.5, 'rgba(8, 8, 16, 0.94)');
      glassFill.addColorStop(1, 'rgba(6, 6, 12, 0.98)');
      ctx.fillStyle = glassFill;
      ctx.fill();

      // Inner card grid (clipped)
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = x0; x < x0 + w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + h);
        ctx.stroke();
      }
      for (let y = y0; y < y0 + h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + w, y);
        ctx.stroke();
      }

      // Internal glows
      const cardCyanGlow = ctx.createRadialGradient(x0 + 40, y0 + h/2, 20, x0 + 40, y0 + h/2, 220);
      cardCyanGlow.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
      cardCyanGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cardCyanGlow;
      ctx.fillRect(x0, y0, w, h);

      const cardPurpleGlow = ctx.createRadialGradient(x0 + w - 40, y0 + h/2, 20, x0 + w - 40, y0 + h/2, 220);
      cardPurpleGlow.addColorStop(0, 'rgba(217, 70, 239, 0.08)');
      cardPurpleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cardPurpleGlow;
      ctx.fillRect(x0, y0, w, h);
      ctx.restore();

      // Holographic laser border
      const borderGrad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
      borderGrad.addColorStop(0, '#00f0ff');
      borderGrad.addColorStop(0.3, '#8b5cf6');
      borderGrad.addColorStop(0.7, '#d946ef');
      borderGrad.addColorStop(1, '#00f0ff');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Corner accent marks
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0 + d, y0); ctx.lineTo(x0 + d, y0 + 18);
      ctx.moveTo(x0 + d, y0 + h); ctx.lineTo(x0 + d, y0 + h - 18);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(217, 70, 239, 0.8)';
      ctx.beginPath();
      ctx.moveTo(x0 + w - d, y0); ctx.lineTo(x0 + w - d, y0 + 18);
      ctx.moveTo(x0 + w - d, y0 + h); ctx.lineTo(x0 + w - d, y0 + h - 18);
      ctx.stroke();

      // 3. ECHORURA Header inside Card
      ctx.textAlign = 'center';
      
      // ECHORURA Title (Gold Gradient)
      const goldGrad = ctx.createLinearGradient(0, y0 + 50, 0, y0 + 95);
      goldGrad.addColorStop(0, '#FFE082');
      goldGrad.addColorStop(0.5, '#FFB300');
      goldGrad.addColorStop(1, '#FF8F00');
      ctx.fillStyle = goldGrad;
      ctx.font = 'italic 900 38px sans-serif';
      ctx.shadowColor = 'rgba(255, 143, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.fillText('ECHORURA', 400, y0 + 80);
      ctx.shadowBlur = 0; // reset

      // Subtitle
      ctx.fillStyle = 'rgba(255, 143, 0, 0.85)';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('GENESIS PASSPORT', 400, y0 + 105);

      // HUD active tags
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('SYS ACTIVE', x0 + 35, y0 + 40);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('WEB3 // SBT', x0 + w - 35, y0 + 40);

      // 4. Draw 3D wireframe audio sphere in the center of the card
      const cX = 400;
      const cY = y0 + h / 2 + 10;
      const sphereRadius = 90;
      const rotationY = 0.5; // fixed beautiful angle for the static poster
      const rotationX = 0.4;

      const segments = [];

      // Generate rings
      const ringCount = 8;
      const ringPoints = 60;
      for (let r = 0; r < ringCount; r++) {
        const lat = -Math.PI / 2 + (Math.PI * (r + 1)) / (ringCount + 1);
        const points = [];

        for (let p = 0; p <= ringPoints; p++) {
          const lon = (p * 2 * Math.PI) / ringPoints;
          const R = sphereRadius + Math.sin(lon * 6) * 2; // subtle waves

          const x = R * Math.cos(lat) * Math.cos(lon);
          const y = R * Math.sin(lat);
          const z = R * Math.cos(lat) * Math.sin(lon);

          // Rotate Y
          const x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY);
          const z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY);
          // Rotate X
          const y2 = y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
          const z2 = y * Math.sin(rotationX) + z1 * Math.cos(rotationX);

          points.push({ x: cX + x1, y: cY + y2, z: z2 });
        }

        for (let p = 0; p < ringPoints; p++) {
          segments.push({
            x1: points[p].x, y1: points[p].y, z1: points[p].z,
            x2: points[p + 1].x, y2: points[p + 1].y, z2: points[p + 1].z,
            color: r % 2 === 0 ? 'rgba(0, 240, 255, ' : 'rgba(217, 70, 239, '
          });
        }
      }

      // Draw segments back-to-front
      segments.sort((a, b) => ((a.z1 + a.z2) / 2) - ((b.z1 + b.z2) / 2));
      segments.forEach(s => {
        const avgZ = (s.z1 + s.z2) / 2;
        const depthScale = (avgZ + sphereRadius) / (2 * sphereRadius);
        const alpha = 0.1 + depthScale * 0.7;
        const width = 0.4 + depthScale * 1.4;

        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.strokeStyle = s.color + alpha + ')';
        ctx.lineWidth = width;
        ctx.stroke();
      });

      // Central glow core
      const coreGrad = ctx.createRadialGradient(cX, cY, 1, cX, cY, 40);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.7)');
      coreGrad.addColorStop(0.7, 'rgba(217, 70, 239, 0.3)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cX, cY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Draw waves and play icon inside card
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 + 35, cY);
      ctx.lineTo(x0 + 45, cY); ctx.lineTo(x0 + 48, cY - 8); ctx.lineTo(x0 + 52, cY + 12);
      ctx.lineTo(x0 + 56, cY - 6); ctx.lineTo(x0 + 60, cY); ctx.lineTo(x0 + 80, cY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(217, 70, 239, 0.5)';
      ctx.beginPath();
      ctx.moveTo(x0 + w - 35, cY);
      ctx.lineTo(x0 + w - 45, cY); ctx.lineTo(x0 + w - 48, cY - 10); ctx.lineTo(x0 + w - 52, cY + 8);
      ctx.lineTo(x0 + w - 56, cY - 4); ctx.lineTo(x0 + w - 60, cY); ctx.lineTo(x0 + w - 80, cY);
      ctx.stroke();

      // 5. Draw Footer of Card
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('IDENTITY PROTOCOL', x0 + 35, y0 + h - 55);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('WEB3 // MEMBERSHIP', x0 + 35, y0 + h - 42);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('MEMBER NO.', x0 + w - 35, y0 + h - 55);
      
      // Serial No with gold grad
      ctx.fillStyle = goldGrad;
      ctx.font = 'italic 900 24px monospace';
      ctx.fillText(`NO.${formattedNumber}`, x0 + w - 35, y0 + h - 35);

      ctx.restore(); // restore card clipping context

      // 6. Draw QR Code section at the bottom of the poster
      const qrW = 460;
      const qrH = 170;
      const qrx0 = 400 - qrW / 2;
      const qry0 = 1200 - qrH - 80;

      // Draw Glass container for QR Code
      ctx.beginPath();
      ctx.roundRect(qrx0, qry0, qrW, qrH, 24);
      ctx.fillStyle = 'rgba(12, 12, 22, 0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Load and Draw QR Code Image
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.onload = () => {
        ctx.drawImage(qrImage, qrx0 + 25, qry0 + 25, 120, 120);

        // QR Code Info Text
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('AR 虚实共鸣空间', qrx0 + 170, qry0 + 55);

        ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.font = '12px sans-serif';
        ctx.fillText('扫描二维码查看您的创世勋章', qrx0 + 170, qry0 + 85);
        ctx.fillText('并开启摄像头进行 AR 空间投影分享', qrx0 + 170, qry0 + 105);

        ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('ECHORURA DIGITAL PROTOCOL', qrx0 + 170, qry0 + 135);

        // Trigger Download
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `Echorura_Genesis_Poster_${formattedNumber}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (downloadErr) {
          console.error('Failed to trigger poster download:', downloadErr);
          alert('下载失败，请长按保存图片或重试');
        } finally {
          setIsGeneratingPoster(false);
        }
      };

      qrImage.onerror = () => {
        console.error('Failed to load QR image for poster');
        // If image fails, draw a cool tech pattern instead of QR
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(qrx0 + 25, qry0 + 25, 120, 120);
        ctx.fillStyle = '#09090c';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR CODE', qrx0 + 85, qry0 + 90);
        
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('AR 虚实共鸣空间', qrx0 + 170, qry0 + 55);
        ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.font = '12px sans-serif';
        ctx.fillText('扫描二维码查看您的创世勋章', qrx0 + 170, qry0 + 85);
        
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `Echorura_Genesis_Poster_${formattedNumber}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          alert('下载失败，请长按保存图片');
        } finally {
          setIsGeneratingPoster(false);
        }
      };

      qrImage.src = qrCodeUrl;

    } catch (err) {
      console.error('Error generating poster:', err);
      alert('海报生成失败，请重试');
      setIsGeneratingPoster(false);
    }
  };

  if (loadingMember) {
    return (
      <div className="glass-panel p-12 rounded-[2.5rem] border border-white/10 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-echo-primary animate-spin" />
      </div>
    );
  }

  // Format member number, e.g. 88 -> 00088
  const formattedNumber = memberNumber !== null 
    ? memberNumber.toString().padStart(5, '0') 
    : '00000';

  return (
    <section className="relative w-full min-h-[860px] flex flex-col items-center justify-center overflow-hidden bg-[#04040a] py-16 px-4">

      {/* Space background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(88,28,135,0.18)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_60%,rgba(6,182,212,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_30%,rgba(217,70,239,0.10)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.022)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-[8%] left-[12%] w-0.5 h-0.5 rounded-full bg-white opacity-70 animate-pulse" />
        <div className="absolute top-[15%] left-[78%] w-px h-px rounded-full bg-cyan-300 opacity-60 animate-pulse" style={{animationDelay:'1.2s'}}/>
        <div className="absolute top-[65%] left-[88%] w-0.5 h-0.5 rounded-full bg-white opacity-50 animate-pulse" style={{animationDelay:'0.7s'}}/>
        <div className="absolute top-[80%] left-[5%] w-px h-px rounded-full bg-purple-300 opacity-60 animate-pulse" style={{animationDelay:'2s'}}/>
      </div>

      {/* 3D Floating Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={hasMinted ? toggleAudio : undefined}
        style={{
          transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: 'transform 0.12s ease-out',
          animation: 'genesis-float 5s ease-in-out infinite',
          filter: isPlaying
            ? 'drop-shadow(0 0 60px rgba(0,240,255,0.5)) drop-shadow(0 0 30px rgba(217,70,239,0.3))'
            : 'drop-shadow(0 30px 70px rgba(0,0,0,0.9)) drop-shadow(0 0 30px rgba(139,92,246,0.25))',
        }}
        className="relative w-[320px] h-[450px] cursor-pointer select-none z-10"
      >
        {/* SVG Frame: glass fill + holographic bevel */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 320 450" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff"/>
              <stop offset="30%" stopColor="#8b5cf6"/>
              <stop offset="65%" stopColor="#d946ef"/>
              <stop offset="100%" stopColor="#00f0ff"/>
            </linearGradient>
            <linearGradient id="glassFill" x1="0%" y1="0%" x2="10%" y2="100%">
              <stop offset="0%" stopColor="rgba(12,12,22,0.80)"/>
              <stop offset="50%" stopColor="rgba(8,8,16,0.87)"/>
              <stop offset="100%" stopColor="rgba(6,6,12,0.92)"/>
            </linearGradient>
            <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="innerHL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)"/>
              <stop offset="50%" stopColor="rgba(255,255,255,0.04)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0.14)"/>
            </linearGradient>
          </defs>
          {/* Dark glass body */}
          <path d="M 18,48 L 48,18 L 118,18 L 128,28 L 192,28 L 202,18 L 272,18 L 302,48 L 302,402 L 272,432 L 202,432 L 192,422 L 128,422 L 118,432 L 48,432 L 18,402 Z" fill="url(#glassFill)"/>
          {/* Outer refraction highlight */}
          <path d="M 16,46 L 46,16 L 118,16 L 129,27 L 191,27 L 202,16 L 274,16 L 304,46 L 304,404 L 274,434 L 202,434 L 191,423 L 129,423 L 118,434 L 46,434 L 16,404 Z" stroke="url(#innerHL)" strokeWidth="1.2"/>
          {/* Holographic breathing border */}
          <path
            d="M 18,48 L 48,18 L 118,18 L 128,28 L 192,28 L 202,18 L 272,18 L 302,48 L 302,402 L 272,432 L 202,432 L 192,422 L 128,422 L 118,432 L 48,432 L 18,402 Z"
            stroke="url(#laserGrad)" strokeWidth="2.8" filter="url(#neonGlow)"
            style={{animation: isPlaying ? 'genesis-pulse 1.8s ease-in-out infinite alternate' : 'genesis-pulse 3.5s ease-in-out infinite alternate'}}
          />
          {/* Chromatic inner refraction */}
          <path d="M 22,52 L 52,22 L 116,22 L 126,32 L 194,32 L 204,22 L 268,22 L 298,52 L 298,398 L 268,428 L 204,428 L 194,418 L 126,418 L 116,428 L 52,428 L 22,398 Z" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
          {/* Corner accents */}
          <line x1="48" y1="18" x2="48" y2="32" stroke="rgba(0,240,255,0.7)" strokeWidth="1.8"/>
          <line x1="272" y1="18" x2="272" y2="32" stroke="rgba(217,70,239,0.7)" strokeWidth="1.8"/>
          <line x1="48" y1="432" x2="48" y2="418" stroke="rgba(0,240,255,0.7)" strokeWidth="1.8"/>
          <line x1="272" y1="432" x2="272" y2="418" stroke="rgba(217,70,239,0.7)" strokeWidth="1.8"/>
        </svg>

        {/* Glass reflection sheen */}
        <div className="absolute inset-0 pointer-events-none z-30 rounded-[2rem]"
          style={{background:'linear-gradient(135deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.02) 35%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.04) 100%)'}}
        />

        {/* Card interior: nebula glows + tech grid */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[2rem]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:16px_16px] opacity-70"/>
          {/* Cyan ambient glow left 鈥?blur 45px */}
          <div className="absolute w-44 h-44 rounded-full bg-cyan-500/14 top-1/3 -left-14" style={{filter:'blur(45px)',animation:'genesis-pulse 6s ease-in-out infinite alternate'}}/>
          {/* Purple ambient glow right 鈥?blur 45px */}
          <div className="absolute w-44 h-44 rounded-full bg-purple-500/14 bottom-1/3 -right-14" style={{filter:'blur(45px)',animation:'genesis-pulse 6s ease-in-out infinite alternate 2s'}}/>
          <svg className="w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <circle cx="48" cy="185" r="1.5" fill="#00f0ff"/>
            <circle cx="64" cy="220" r="1.5" fill="#00f0ff"/>
            <line x1="48" y1="185" x2="64" y2="220" stroke="rgba(0,240,255,0.25)" strokeWidth="1"/>
            <circle cx="268" cy="270" r="1.5" fill="#d946ef"/>
            <circle cx="280" cy="240" r="1.5" fill="#d946ef"/>
            <line x1="268" y1="270" x2="280" y2="240" stroke="rgba(217,70,239,0.25)" strokeWidth="1"/>
          </svg>
        </div>

        {/* 3D Audio Core Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none rounded-[2rem]"/>

        {/* HUD overlay */}
        <div className="absolute inset-0 z-[35] p-6 flex flex-col justify-between rounded-[2rem]">
          {/* Header */}
          <div className="flex justify-between items-center text-[7px] font-mono text-gray-500 tracking-wider">
            <div className="flex items-center gap-1.5">
              <Globe2 className="w-3 h-3 text-cyan-400/80 animate-pulse"/>
              <span className="text-cyan-400/80 font-bold uppercase">SYS ACTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-cyan-400/60"/>
              <Battery className="w-4 h-4 text-cyan-400/60"/>
            </div>
          </div>

          {/* Brand */}
          <div className="text-center mt-1">
            <h1 className="text-[26px] font-black italic tracking-widest bg-gradient-to-b from-[#FFE082] via-[#FFB300] to-[#FF8F00] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,143,0,0.7)]">
              ECHORURA
            </h1>
            <p className="text-[9px] font-bold text-amber-500/80 tracking-[0.22em] uppercase font-mono">
              GENESIS PASSPORT
            </p>
          </div>

          {/* Centre HUD */}
          <div className="flex-1 flex items-center justify-center relative">
            {/* FREQ_A_09 left */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-start opacity-60 pointer-events-none">
              <svg className="w-10 h-7 text-cyan-400" viewBox="0 0 40 28" fill="none">
                <path d="M 0,14 L 5,14 L 7,5 L 10,22 L 13,11 L 16,17 L 19,14 L 40,14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="text-[5.5px] font-mono text-cyan-400/70">FREQ_A_09</span>
            </div>
            {/* SIGNAL_04 right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-end opacity-60 pointer-events-none">
              <svg className="w-10 h-7 text-purple-400" viewBox="0 0 40 28" fill="none">
                <path d="M 0,14 L 20,14 L 22,11 L 25,17 L 28,4 L 31,24 L 34,14 L 40,14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="text-[5.5px] font-mono text-purple-400/70">SIGNAL_04</span>
            </div>
            {/* Bottom-left play indicator */}
            <div className="absolute left-1 bottom-3 flex items-center gap-1 opacity-55 text-[5px] font-mono text-cyan-400 pointer-events-none">
              <div className="w-4 h-4 rounded-full border border-cyan-400/80 flex items-center justify-center">
                <Play className="w-1.5 h-1.5 fill-current ml-0.5"/>
              </div>
              <span>RES_PLAY_ON</span>
            </div>
            {/* Bottom-right node indicator */}
            <div className="absolute right-1 bottom-3 flex items-center gap-1 opacity-55 text-[5px] font-mono text-purple-400 pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="5" cy="11" r="1.5"/><circle cx="11" cy="5" r="1.5"/><circle cx="11" cy="11" r="1.5"/>
                <line x1="5" y1="11" x2="11" y2="5"/><line x1="11" y1="5" x2="11" y2="11"/>
              </svg>
              <span>CONN_NODE</span>
            </div>
            {/* Play button */}
            {!isPlaying && hasMinted && (
              <div className="w-12 h-12 rounded-full border border-cyan-400/40 bg-black/50 backdrop-blur-md flex items-center justify-center text-cyan-400/80 hover:text-white hover:scale-110 transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-pulse z-10">
                <Play className="w-5 h-5 fill-current ml-0.5"/>
              </div>
            )}
          </div>

          {/* Footer: identity + serial number */}
          <div className="pt-3 border-t border-white/[0.08] flex items-end justify-between">
            <div className="font-mono">
              <p className="text-[6.5px] text-gray-600 uppercase tracking-widest font-bold">IDENTITY PROTOCOL</p>
              <p className="text-[8px] font-bold text-cyan-400/80 uppercase tracking-wider mt-0.5">WEB3 // MEMBERSHIP // 2026</p>
            </div>
            <div className="text-right">
              <p className="text-[6.5px] text-gray-600 font-mono font-bold tracking-wider uppercase">{t('number')}</p>
              <p className="text-[22px] font-black italic font-mono tracking-tighter bg-gradient-to-b from-[#FFE082] via-[#FFB300] to-[#FF8F00] bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,143,0,0.6)]">
                NO.{formattedNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audio label */}
      {hasMinted && (
        <p className="relative z-10 text-[10px] text-gray-500 font-bold mt-6 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer hover:text-cyan-400 transition-colors" onClick={toggleAudio}>
          <Music className={`w-3.5 h-3.5 ${isPlaying ? 'animate-bounce text-cyan-400' : ''}`}/>
          {isPlaying ? t('playing') : t('paused')}
        </p>
      )}

      {/* Claim actions */}
      <div className="relative z-10 w-full max-w-lg mt-8 space-y-4 px-4">
        <div className="bg-white/[0.04] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('number')}</p>
            <p className="text-xl font-mono font-black text-white">NO. {formattedNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Gas Fee</p>
            <p className="text-xs font-bold text-cyan-400 flex items-center justify-end gap-1">
              <Sparkles className="w-3.5 h-3.5 animate-pulse"/>Paymaster Sponsored
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {!hasMinted ? (
            <button
              onClick={handleClaim}
              disabled={isMinting || memberNumber === null || memberNumber <= 10 || CONTRACT_ADDRESSES.GenesisPassport === '0x0000000000000000000000000000000000000000'}
              className={`flex-1 py-4 rounded-xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                isMinting ? 'bg-white/10 text-gray-500 border border-white/10 cursor-not-allowed'
                : memberNumber !== null && memberNumber <= 10 ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                : CONTRACT_ADDRESSES.GenesisPassport === '0x0000000000000000000000000000000000000000' ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(0,240,255,0.3)]'
              }`}
            >
              {isMinting ? <><Loader2 className="w-4 h-4 animate-spin"/>{t('claiming')}</>
               : CONTRACT_ADDRESSES.GenesisPassport === '0x0000000000000000000000000000000000000000' ? <><ShieldAlert className="w-4 h-4"/>等待官方部署合约</>
               : memberNumber !== null && memberNumber <= 10 ? t('reserved')
               : <><Sparkles className="w-4 h-4"/>{t('claim')}</>}
            </button>
          ) : (
            <>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-xs font-bold text-green-400">
                <ShieldAlert className="w-4 h-4"/>{t('claimed')}
              </div>
              <button onClick={() => setShowARModal(true)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-6 py-3.5 rounded-xl font-bold text-xs hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                <Share2 className="w-4 h-4"/>{t('shareAR')}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 bg-white/[0.04] border border-white/[0.06] rounded-2xl text-[10px] text-gray-500">
          <HelpCircle className="w-4 h-4 shrink-0"/><span>{t('nonTransferable')}</span>
        </div>
      </div>

      {/* AR Modal */}
      {showARModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
          <div className="relative w-full max-w-4xl h-[85vh] bg-[#09090c] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col lg:flex-row shadow-2xl">
            <button onClick={() => { setShowARModal(false); stopCamera(); }} className="absolute top-6 right-6 z-[210] w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer">
              <X className="w-5 h-5"/>
            </button>
            
            <div className="flex-1 relative bg-black flex items-center justify-center border-r border-white/5 overflow-hidden">
              {/* Camera Feed */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className={`absolute inset-0 w-full h-full object-cover opacity-70 transition-opacity duration-300 ${cameraStream ? 'opacity-70' : 'opacity-0 pointer-events-none'}`} 
              />
              
              {/* Camera State Info (Initial / Error) */}
              {!cameraStream && (
                <div className="absolute inset-0 bg-gradient-to-b from-[#111116] to-[#09090c] flex flex-col items-center justify-center p-6 text-center gap-3">
                  <Camera className="w-12 h-12 text-gray-600"/>
                  {cameraError ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-red-400">启动失败</p>
                      <p className="text-xs text-gray-500 max-w-xs">{cameraError}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">开启摄像头体验 AR 投影</span>
                  )}
                </div>
              )}

              {/* The Floating Card Overlay inside AR Camera space */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-75 sm:scale-[0.80] z-20">
                <div 
                  className="relative w-[340px] h-[480px] rounded-[2.5rem] p-[1.5px] animate-[genesis-float_6s_easeInOut_infinite] pointer-events-none"
                  style={{
                    transform: 'perspective(1200px) rotateX(8deg) rotateY(-10deg)',
                  }}
                >
                  {/* Holographic Border SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible" viewBox="0 0 340 480">
                    <defs>
                      <linearGradient id="ar-holographic-laser" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f0ff" />
                        <stop offset="35%" stopColor="#8b5cf6" />
                        <stop offset="70%" stopColor="#d946ef" />
                        <stop offset="100%" stopColor="#00f0ff" />
                      </linearGradient>
                      <filter id="ar-neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
                        <feComponentTransfer in="blur" result="glow">
                          <feFuncA type="linear" slope="0.65"/>
                        </feComponentTransfer>
                        <feMerge>
                          <feMergeNode in="glow"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <path
                      d="M 36,0 L 304,0 L 340,36 L 340,444 L 304,480 L 36,480 L 0,444 L 0,36 Z"
                      fill="rgba(12, 12, 22, 0.85)"
                      stroke="url(#ar-holographic-laser)"
                      strokeWidth="2"
                      style={{ filter: 'url(#ar-neonGlow)', animation: 'genesis-pulse 4s ease-in-out infinite' }}
                    />
                    <path
                      d="M 38,3 L 302,3 L 337,38 L 337,442 L 302,477 L 38,477 L 3,442 L 3,38 Z"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Card Content Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] rounded-[2.5rem] overflow-hidden" />
                  
                  {/* Ambient Glows */}
                  <div className="absolute top-1/4 left-0 w-32 h-32 rounded-full bg-cyan-500/10 blur-[45px] pointer-events-none" />
                  <div className="absolute bottom-1/4 right-0 w-32 h-32 rounded-full bg-purple-500/10 blur-[45px] pointer-events-none" />

                  {/* Card Info Overlay */}
                  <div className="relative w-full h-full flex flex-col justify-between p-8 z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[9px] font-mono font-bold text-cyan-400 tracking-wider">SYS ACTIVE</p>
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFE082] via-[#FFB300] to-[#FF8F00] drop-shadow-[0_0_10px_rgba(255,143,0,0.4)] italic mt-1">
                          ECHORURA
                        </h2>
                        <p className="text-[8px] font-mono text-gray-400 tracking-widest uppercase">GENESIS PASSPORT</p>
                      </div>
                      <div className="flex gap-2">
                        <Wifi className="w-3.5 h-3.5 text-cyan-400/60" />
                        <Battery className="w-3.5 h-3.5 text-cyan-400/60" />
                      </div>
                    </div>

                    {/* Sphere Canvas */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <canvas ref={arCanvasRef} className="w-[320px] h-[450px] object-contain opacity-90" />
                    </div>

                    {/* HUD Diagnostics */}
                    <div className="w-full flex justify-between items-center text-[8px] font-mono text-cyan-400/60 my-auto">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                          <span>FREQ_A_09</span>
                        </div>
                        <svg className="w-16 h-4 opacity-50" viewBox="0 0 60 15">
                          <path d="M0,7 Q15,0 30,12 T60,7" fill="none" stroke="#00f0ff" strokeWidth="1" />
                        </svg>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <div>SIGNAL_04 // OK</div>
                        <svg className="w-16 h-4 opacity-50 ml-auto" viewBox="0 0 60 15">
                          <path d="M0,7 Q15,15 30,3 T60,7" fill="none" stroke="#d946ef" strokeWidth="1" />
                        </svg>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-end">
                      <div className="text-[7px] font-mono text-gray-500 leading-tight">
                        <p>IDENTITY PROTOCOL</p>
                        <p className="text-cyan-400/80 font-bold mt-0.5">WEB3 // MEMBERSHIP // 2026</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-mono text-gray-500">MEMBER NO.</p>
                        <p className="text-lg font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFE082] via-[#FFB300] to-[#FF8F00] drop-shadow-[0_0_8px_rgba(255,143,0,0.6)]">
                          NO.{formattedNumber}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* HUD Frame Overlay */}
              <div className="absolute inset-8 border border-cyan-400/20 pointer-events-none z-30 flex flex-col justify-between p-4">
                <div className="flex justify-between text-[8px] font-mono text-cyan-400/60"><span>SYS_AR_RESONANCE_V1.0</span><span>REC ●</span></div>
                <div className="flex justify-between text-[8px] font-mono text-cyan-400/60"><span>SCALE: 1.0</span><span>ISO 400</span></div>
              </div>
            </div>
            
            <div className="w-full lg:w-[360px] p-8 flex flex-col justify-between bg-[#09090c]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t('shareAR')}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t('ar_guide')}</p>
                </div>
                <div className="flex flex-col items-center bg-white/5 border border-white/5 p-6 rounded-2xl gap-3">
                  <div className="p-2 bg-white rounded-xl"><img src={qrCodeUrl} alt="QR" className="w-36 h-36"/></div>
                  <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-cyan-400"/>MOBILE AR PORTAL
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 pt-6 border-t border-white/5">
                {cameraStream ? (
                  <button onClick={stopCamera} className="w-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/40 text-red-400 py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-4 h-4"/>{t('camera_close')}
                  </button>
                ) : (
                  <button onClick={startCamera} className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-4 h-4"/>{t('camera_btn')}
                  </button>
                )}
                
                <button 
                  onClick={downloadPoster} 
                  disabled={isGeneratingPoster}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPoster ? (
                    <><Loader2 className="w-4 h-4 animate-spin"/>正在生成...</>
                  ) : (
                    <><Download className="w-4 h-4"/>{t('download_poster')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global keyframes */}
      <style>{`
        @keyframes genesis-float {
          0%   { transform: perspective(1200px) rotateX(8deg) rotateY(-10deg) translateY(0px);   }
          50%  { transform: perspective(1200px) rotateX(9deg) rotateY(-10.5deg) translateY(-14px); }
          100% { transform: perspective(1200px) rotateX(8deg) rotateY(-10deg) translateY(0px);   }
        }
        @keyframes genesis-pulse {
          0%   { opacity: 0.70; filter: drop-shadow(0 0 4px #00f0ff)  drop-shadow(0 0 8px  #d946ef); }
          100% { opacity: 1.00; filter: drop-shadow(0 0 12px #00f0ff) drop-shadow(0 0 22px #d946ef); }
        }
      `}</style>
    </section>
  );
}

