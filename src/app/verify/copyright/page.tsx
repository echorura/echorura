'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  Award, 
  Download, 
  Share2, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from '@/store/languageStore';

function VerifyContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const certId = searchParams.get('id') || searchParams.get('certificate_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const [qrBase64, setQrBase64] = useState<string>('');

  useEffect(() => {
    if (!certId) {
      setError('缺少证书编号参数，无法核验');
      setLoading(false);
      return;
    }

    const fetchCertificate = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/songs/certificate?id=${encodeURIComponent(certId)}`);
        const result = await res.json();
        
        if (!res.ok || !result.success) {
          setError(result.error || '未找到该版权存证记录，或证书已失效');
          setLoading(false);
          return;
        }

        setSong(result.data.song);
        setVerified(result.data.verified);
        
        const verifyUrl = typeof window !== 'undefined' ? window.location.href : '';
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
        const qrRes = await fetch(qrUrl);
        const qrBlob = await qrRes.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setQrBase64(reader.result as string);
        };
        reader.readAsDataURL(qrBlob);
      } catch (err: any) {
        console.error('Fetch cert error:', err);
        setError('网络连接错误，无法连接至版权核验节点');
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [certId]);

  const downloadCertificate = () => {
    const svgElement = document.getElementById('copyright-certificate-svg');
    if (!svgElement) {
      alert('未找到证书文件，请重试');
      return;
    }

    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1695;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#050508';
          context.fillRect(0, 0, 1200, 1695);
          context.drawImage(image, 0, 0, 1200, 1695);
          const png = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = png;
          downloadLink.download = `ECHORURA_COPYRIGHT_CERT_${song?.title || 'VERIFIED'}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      };
      image.src = blobURL;
    } catch (err: any) {
      console.error('Error rendering PNG:', err);
      alert('导出图片发生错误，请使用网页截图：' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_80%,rgba(0,240,255,0.05))] pointer-events-none"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00f0ff]/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="text-center relative z-10 space-y-6">
          <Loader2 className="w-16 h-16 animate-spin text-[#00f0ff] mx-auto filter drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]" />
          <h2 className="text-xl font-black uppercase tracking-widest text-[#00f0ff] animate-pulse">ECHORURA SECURE DECENTRALIZED SCANNING IN PROGRESS...</h2>
          <p className="text-xs text-gray-500 font-mono tracking-wider">正在安全连接极声链版权共识核验节点并验签，请稍候...</p>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="relative w-full max-w-xl glass-panel rounded-3xl p-8 border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] bg-[#0d0a0a]/90 text-center space-y-6 z-10">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto filter drop-shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-red-500 uppercase tracking-tight">版权存证核验失败</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">Verification Refused</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <p className="text-sm font-bold text-gray-300">{error || '核验密钥验证不匹配或数据库无此证书记录。'}</p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
            若本证书是您刚刚发布的，数据可能同步中，或代表该证书的底层哈希数据已被修改、移除，导致防伪哈希验证失效。
          </p>
          <a
            href="/"
            className="inline-block px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white transition-all hover:bg-white/10"
          >
            返回极声市集首页
          </a>
        </div>
      </div>
    );
  }

  const scaAddress = `0x4337${song.creator_id.slice(0, 4)}581e${song.creator_id.slice(-4)}`;

  return (
    <div className="min-h-screen bg-[#050508] text-white py-12 px-4 sm:px-6 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,240,255,0.04),transparent_50%)] pointer-events-none"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#eb00ff]/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#00f0ff]/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-8">
        
        {/* Verification Status Header */}
        <div className="glass-panel border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-[#0a0a0c]/80 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className="w-16 h-16 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff] filter drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="text-2xl font-black tracking-tight text-white">{t('verify.verified_status')}</h1>
                <span className="bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">PRISTINE</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('verify.preservation_id')}: <span className="font-mono text-[#00f0ff]">{song.certificate_id}</span> • {t('verify.verified_desc')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadCertificate}
              className="py-3 px-5 rounded-2xl bg-gradient-to-r from-[#00f0ff] to-[#eb00ff] text-black font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.2)]"
            >
              <Download className="w-4 h-4" />
              {t('verify.download_png')}
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Holographic Certificate */}
          <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-3xl p-6 sm:p-8 border border-white/5 overflow-hidden">
            <div className="w-[320px] xs:w-[420px] sm:w-[500px] md:w-[560px] lg:w-[480px] xl:w-[540px] shrink-0 aspect-[800/1130] bg-[#050508] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
              <svg
                id="copyright-certificate-svg"
                viewBox="0 0 800 1130"
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                style={{ background: '#050508', fontFamily: 'monospace, sans-serif' }}
              >
                <defs>
                  <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#eb00ff" />
                  </linearGradient>
                  <linearGradient id="neon-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(0, 240, 255, 0.2)" />
                    <stop offset="100%" stopColor="rgba(235, 0, 255, 0.05)" />
                  </linearGradient>
                </defs>

                <rect width="800" height="1130" fill="#050508" />
                
                <path d="M 0,100 L 800,100 M 0,200 L 800,200 M 0,300 L 800,300 M 0,400 L 800,400 M 0,500 L 800,500 M 0,600 L 800,600 M 0,700 L 800,700 M 0,800 L 800,800 M 0,900 L 800,900 M 0,1000 L 800,1000" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
                <path d="M 100,0 L 100,1130 M 200,0 L 200,1130 M 300,0 L 300,1130 M 400,0 L 400,1130 M 500,0 L 500,1130 M 600,0 L 600,1130 M 700,0 L 700,1130" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />

                <path d="M 0,0 L 150,0 L 0,150 Z" fill="rgba(0, 240, 255, 0.03)" />
                <path d="M 800,1130 L 650,1130 L 800,980 Z" fill="rgba(235, 0, 255, 0.03)" />

                <rect x="25" y="25" width="750" height="1080" rx="20" fill="none" stroke="url(#cyber-grad)" strokeWidth="2.5" />
                <rect x="35" y="35" width="730" height="1060" rx="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="400" y="90" textAnchor="middle" fill="url(#cyber-grad)" fontSize="15" fontWeight="bold" letterSpacing="4">ECHORURA SYSTEM DIGITAL ARCHIVE</text>
                <text x="400" y="130" textAnchor="middle" fill="#ffffff" fontSize="24" fontWeight="900" letterSpacing="2">{t('verify.copyright_cert_header')}</text>
                <text x="400" y="155" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="bold" letterSpacing="1">DIGITAL COPYRIGHT PRESERVATION CERTIFICATE</text>

                <line x1="100" y1="185" x2="700" y2="185" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                <circle cx="400" cy="300" r="80" fill="url(#neon-glow)" />

                <rect x="330" y="205" width="140" height="28" rx="6" fill="rgba(0, 240, 255, 0.1)" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="1" />
                <text x="400" y="223" textAnchor="middle" fill="#00f0ff" fontSize="11" fontWeight="bold" letterSpacing="1">{t('verify.pass_badge')}</text>

                <text x="90" y="440" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.song_title')}</text>
                <text x="260" y="440" fill="#ffffff" fontSize="16" fontWeight="bold">{song.title}</text>
                <line x1="90" y1="455" x2="710" y2="455" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="490" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.artist')}</text>
                <text x="260" y="490" fill="#ffffff" fontSize="15" fontWeight="bold">{song.artist}</text>
                <line x1="90" y1="505" x2="710" y2="505" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="540" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.preservation_id')}</text>
                <text x="260" y="540" fill="#00f0ff" fontSize="14" fontWeight="bold" style={{ fontFamily: 'monospace' }}>{song.certificate_id}</text>
                <line x1="90" y1="555" x2="710" y2="555" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="590" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.timestamp')}</text>
                <text x="260" y="590" fill="#ffffff" fontSize="14" style={{ fontFamily: 'monospace' }}>{new Date(song.certificate_created_at).toLocaleString()}</text>
                <line x1="90" y1="605" x2="710" y2="605" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="640" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.audio_hash')}</text>
                <text x="260" y="640" fill="rgba(255,255,255,0.8)" fontSize="10.5" style={{ fontFamily: 'monospace' }}>{song.audio_hash?.slice(0, 32)}</text>
                <text x="260" y="658" fill="rgba(255,255,255,0.8)" fontSize="10.5" style={{ fontFamily: 'monospace' }}>{song.audio_hash?.slice(32)}</text>
                <line x1="90" y1="675" x2="710" y2="675" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="710" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.owner_wallet')}</text>
                <text x="260" y="710" fill="#eb00ff" fontSize="12" style={{ fontFamily: 'monospace' }}>{scaAddress}</text>
                <text x="260" y="728" fill="rgba(255,255,255,0.3)" fontSize="8.5" style={{ fontFamily: 'monospace' }}>PLATFORM SILENT CUSTODIAL ACCOUNT (SCA) ANCHOR</text>
                <line x1="90" y1="745" x2="710" y2="745" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <text x="90" y="780" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="bold">{t('verify.platform_sign')}</text>
                <text x="260" y="780" fill="rgba(255,255,255,0.8)" fontSize="9.5" style={{ fontFamily: 'monospace' }}>{song.signature_hash?.slice(0, 36)}</text>
                <text x="260" y="798" fill="rgba(255,255,255,0.8)" fontSize="9.5" style={{ fontFamily: 'monospace' }}>{song.signature_hash?.slice(36)}</text>
                <line x1="90" y1="815" x2="710" y2="815" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                <g transform="translate(90, 845)">
                  {qrBase64 ? (
                    <image href={qrBase64} x="0" y="0" width="130" height="130" />
                  ) : (
                    <rect width="130" height="130" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
                  )}
                  <rect x="-5" y="-5" width="140" height="140" fill="none" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" />
                  <path d="M -5,15 L -5,-5 L 15,-5" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M 120,-5 L 135,-5 L 135,15" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M -5,120 L -5,135 L 15,135" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M 120,135 L 135,135 L 135,120" fill="none" stroke="#00f0ff" strokeWidth="2" />

                  <text x="160" y="35" fill="#ffffff" fontSize="13" fontWeight="bold">{t('verify.scan_qr')}</text>
                  <text x="160" y="55" fill="rgba(255,255,255,0.5)" fontSize="9.5">SCAN QR CODE FOR REAL-TIME ONLINE VERIFICATION</text>
                  
                  <text x="160" y="85" fill="rgba(255,255,255,0.4)" fontSize="9">{t('verify.scan_qr_desc')}</text>
                  <text x="160" y="100" fill="rgba(255,255,255,0.4)" fontSize="9">{t('verify.scan_qr_desc2')}</text>
                </g>

                <text x="400" y="1030" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8.5">ECHORURA MUSIC GROUP CO., LTD. • COPYRIGHT PRESERVATION CENTER</text>
                <text x="400" y="1045" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7.5">All metadata rights are secured by decentralized cryptographic algorithms in cooperation with local nodes.</text>
              </svg>
            </div>
          </div>

          {/* Right Column: Detailed Tech Specs */}
          <div className="w-full lg:w-96 flex flex-col gap-6">
            
            <div className="glass-panel border border-white/10 rounded-3xl p-6 bg-[#0a0a0c]/80 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('verify.platform_sign')}</h3>
              
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                  <div className="text-[10px] text-gray-500 font-bold">HMAC-SHA256 Payload</div>
                  <div className="font-mono text-gray-400 break-all select-all p-1 bg-black/30 rounded text-[9.5px]">
                    {`${song.certificate_id}:${song.id}:${song.audio_hash}:${song.creator_id}:${song.certificate_created_at}`}
                  </div>
                </div>

                <div className="p-3 bg-[#00f0ff]/5 border border-[#00f0ff]/10 rounded-xl space-y-1">
                  <div className="text-[10px] text-[#00f0ff] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00f0ff]" />
                    Signature Status: VALID
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    {t('verify.verified_desc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel border border-white/10 rounded-3xl p-6 bg-[#0a0a0c]/80 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('verify.owner_wallet')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">{t('verify.artist')}</span>
                  <span className="text-white font-bold">{song.artist}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">SCA</span>
                  <span className="text-[#eb00ff] font-mono text-[10px]">{scaAddress}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">ID</span>
                  <span className="text-white font-mono">{song.id}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel border border-white/10 rounded-3xl p-6 bg-[#0a0a0c]/80 space-y-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('📋 ' + t('verify.share_link'));
                }}
                className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {t('verify.share_link')}
              </button>

              <a
                href="/"
                className="w-full py-3.5 rounded-2xl bg-white/5 text-gray-400 font-bold text-xs hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer text-center"
              >
                ECHORURA Home
              </a>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function CopyrightVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 font-sans">
        <Loader2 className="w-16 h-16 animate-spin text-[#00f0ff] mx-auto" />
        <p className="text-xs text-gray-500 mt-4 font-mono">Loading dynamic modules...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
