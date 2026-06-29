'use client';

import { useEffect, useState } from 'react';
import { X, Smartphone, ArrowDown, Share2, PlusSquare, Sparkles } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. 检查是否已经是 PWA 独立运行状态 (standalone)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      console.log('📱 App is running in standalone mode (already installed)');
      return;
    }

    // 2. 识别操作系统平台
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      setPlatform('ios');
      // 检查 iOS 用户是否点击过关闭
      const dismissed = localStorage.getItem('pwa_prompt_dismissed_ios');
      if (!dismissed) {
        // 5秒后弹出，避免影响刚加载的视觉体验
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else if (isAndroid) {
      setPlatform('android');

      // 监听安卓浏览器的一键安装触发事件
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        
        const dismissed = localStorage.getItem('pwa_prompt_dismissed_android');
        if (!dismissed) {
          // 3秒后弹出安卓安装条幅
          const timer = setTimeout(() => {
            setShowPrompt(true);
          }, 3000);
          return () => clearTimeout(timer);
        }
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    if (platform === 'ios') {
      localStorage.setItem('pwa_prompt_dismissed_ios', 'true');
    } else if (platform === 'android') {
      localStorage.setItem('pwa_prompt_dismissed_android', 'true');
    }
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    
    // 触发安卓原生的安装对话框
    deferredPrompt.prompt();
    
    // 等待用户选择结果
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    
    // 无论结果如何，清理变量并隐藏
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || !platform) return null;

  return (
    <>
      {/* ==================== 安卓一键安装条幅 (Android) ==================== */}
      {platform === 'android' && (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[200] animate-in slide-in-from-bottom-5 duration-300">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-echo-primary/10 via-black/95 to-echo-secondary/10 border border-white/10 p-5 shadow-2xl backdrop-blur-xl">
            {/* 特效发光背景 */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-echo-primary/10 blur-2xl rounded-full"></div>
            
            <button 
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              aria-label="关闭提示"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-4 items-start pr-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-echo-primary to-echo-secondary p-[1px] shrink-0 shadow-lg shadow-echo-primary/20">
                <div className="w-full h-full bg-black rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-echo-primary" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                  安装极声App
                  <Sparkles className="w-3.5 h-3.5 text-echo-secondary animate-pulse" />
                </h4>
                <p className="text-[11px] text-gray-400 leading-normal">
                  一键添加到手机桌面，享受更顺畅的后台听歌体验与极速启动速度。
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button 
                onClick={handleDismiss}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition-all"
              >
                稍后再说
              </button>
              <button 
                onClick={handleAndroidInstall}
                className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)]"
              >
                立即安装
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 苹果手势引导气泡 (iOS Safari) ==================== */}
      {platform === 'ios' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="relative rounded-2xl bg-black/90 border border-white/10 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {/* 渐变装饰条 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-echo-primary to-echo-secondary rounded-t-2xl"></div>

            <button 
              onClick={handleDismiss}
              className="absolute top-3.5 right-3.5 p-1 rounded-full text-gray-400 hover:text-white transition-all"
              aria-label="关闭提示"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h4 className="text-sm font-black text-white mb-3 flex items-center gap-1.5">
              <span>添加「极声音乐」到主屏幕</span>
            </h4>

            <div className="space-y-3.5 text-xs text-gray-300">
              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-echo-primary shrink-0 mt-0.5">
                  1
                </div>
                <p className="leading-relaxed">
                  点击 Safari 浏览器底部的<strong>【分享】</strong>按钮 (iPad 在顶部)。
                  <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[10px] ml-1.5">
                    <Share2 className="w-3 h-3 text-echo-primary inline" /> 分享
                  </span>
                </p>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-echo-secondary shrink-0 mt-0.5">
                  2
                </div>
                <p className="leading-relaxed">
                  向上滑动菜单，选择 <strong>【添加到主屏幕】</strong> 即可。
                  <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[10px] ml-1.5">
                    <PlusSquare className="w-3 h-3 text-echo-secondary inline" /> 添加到主屏幕
                  </span>
                </p>
              </div>
            </div>

            {/* 指向 Safari 底部中间分享图标的闪烁小箭头 */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce duration-1000">
              {/* 倒三角小尾巴 */}
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-black/90"></div>
              <ArrowDown className="w-6 h-6 text-echo-primary mt-1 drop-shadow-[0_2px_5px_rgba(0,240,255,0.4)]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
