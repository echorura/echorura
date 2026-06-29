'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, FileText } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050508] text-gray-300 py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Background Decorative Ambient Lights */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-echo-secondary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-echo-primary/10 blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-8">
        
        {/* Floating Back Controls */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-gray-300 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-echo-secondary/10 text-echo-secondary border border-echo-secondary/20 px-2.5 py-1 rounded-full font-black tracking-wider uppercase flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> 隐私保障
            </span>
          </div>
        </div>

        {/* Header Branding Panel */}
        <div className="text-center md:text-left space-y-3">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight italic">
            隐私政策声明
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
            ECHORURA PRIVACY POLICY STATEMENT · 最近更新：2026年6月6日
          </p>
        </div>

        {/* Content Body with Glassmorphism container */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          
          <div className="p-4 rounded-2xl bg-echo-secondary/10 border border-echo-secondary/20 space-y-2">
            <h3 className="text-sm font-black text-echo-secondary flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 animate-pulse" /> 隐私保护与特殊说明
            </h3>
            <p className="text-xs text-blue-300/80 leading-relaxed">
              本《隐私政策》完全服从并符合中华人民共和国（包括香港特别行政区）关于个人信息保护与隐私数据安全的相关法律法规。<br />
              极声音乐基于分布式存证技术，一旦您的数据写入公有链，该信息将永久公开且不可逆。请仔细阅读第三条关于区块链永久公开性的免责声明。
            </p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-gray-300">
            
            {/* 一、 我们收集的信息 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                一、 我们收集的信息
              </h2>
              <p className="pl-3 text-gray-400">
                为了向您提供核心的音乐播放、原创上传和挖矿收益计算服务，我们会收集以下信息：
              </p>
              <div className="pl-3 space-y-2 text-gray-400">
                <p>1. <strong>注册与账户信息</strong>：您的邮箱地址、展示名称（Artist Name）、头像、个人简介以及加密存储的密码。</p>
                <p>2. <strong>Web3 关联公钥地址信息</strong>：当您使用 Web3 技术关联或生成公钥地址时，我们会收集您的公钥地址以进行链上交易核对。<strong>我们绝不会要求您提供、也不会存储您的私钥或助记词。</strong></p>
                <p>3. <strong>播放与互动数据</strong>：您的听歌记录（用于计算挖矿收益）、点赞、投票、创建的歌单、评论以及您购买的歌曲版权份额（MusicIP 记录）。</p>
                <p>4. <strong>技术与设备信息</strong>：您的 IP 地址、浏览器类型、操作系统类型、唯一设备标识符（用于防作弊检测）。</p>
              </div>
            </section>

            {/* 二、 我们如何使用信息 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                二、 我们如何使用信息
              </h2>
              <p className="pl-3 text-gray-400">
                我们收集的信息主要用于以下目的：
              </p>
              <div className="pl-3 space-y-2 text-gray-400">
                <p>1. <strong>保障核心服务</strong>：为您提供音频播放、歌词同步显示、作品上传以及创建并管理歌单功能。</p>
                <p>2. <strong>收益与结算</strong>：通过防作弊算法核算您的听歌挖矿收益，并计入您的账户。</p>
                <p>3. <strong>个性化推荐</strong>：根据您的偏好，在页面上为您推荐符合口味的歌曲和艺人。</p>
                <p>4. <strong>安全合规</strong>：检测刷票、多开账户等恶意作弊行为，确保平台共享经济体系的公平与安全。</p>
              </div>
            </section>

            {/* 三、 区块链永久公开性与隐私特殊披露 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                三、 区块链永久公开性与隐私特殊披露
              </h2>
              <p className="pl-3 text-gray-400">
                极声音乐集成了区块链分布式存证技术。
              </p>
              <div className="pl-3 space-y-2 text-gray-400">
                <p>1. <strong>公开性</strong>：一旦您在链上执行了 MusicIP 存证、收益划转等交互，您的公钥地址、交易哈希、交易时间及 MusicIP 所有权等数据将记录在公开的分布式账本上。任何人均可通过区块链浏览器公开查询。</p>
                <p>2. <strong>永久不可篡改性</strong>：记录在区块链上的数据具有永久性，无法被物理删除、修改或隐藏。</p>
                <p>3. <strong>免责与知情声明</strong>：<strong>您在此确认并同意，对于已被写入公链的数据，平台无法提供“被遗忘权”（即彻底物理删除数据的权利）和“更正权”。如果您对此存有异议，请勿在平台中使用任何涉及区块链上链的功能。</strong> 您的平台本地数据库个人数据（如注册邮箱、展示名称等）仍可随时申请注销并删除。</p>
              </div>
            </section>

            {/* 四、 第三方服务与数据处理说明 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                四、 第三方服务与数据处理说明
              </h2>
              <p className="pl-3 text-gray-400 font-bold">
                为实现相关服务，我们可能与受信任的第三方服务商合作，由其代为处理以下必要的技术数据。我们已采取严格的安全审查，且以下数据处理活动均仅限于技术支撑目的，不包含商业营销分享：
              </p>
              <div className="pl-3 space-y-2 text-gray-400">
                <p>• <strong>数据库托管商</strong>：代为进行用户账户注册数据、歌曲元数据以及播放记录的安全云存储与备份托管。</p>
                <p>• <strong>分布式内容存储与分发服务商</strong>：用于以高性能的分布式加速方式托管和读取用户上传的头像、歌曲音频及封面文件。</p>
                <p>• <strong>第三方支付与结算服务商</strong>：在未来开通充值功能时，用于安全传输和结算您的信用卡或移动端线上收付款数据，平台不直接留存您的信用卡敏感信息。</p>
              </div>
            </section>

            {/* 五、 数据安全与存储期限 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                五、 数据安全与存储期限
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>1. <strong>安全防护</strong>：我们采用业界通用的加密技术（SSL/TLS）、数据安全策略和访问控制机制，保护您的个人数据免遭泄露或非法授权访问。</p>
                <p>2. <strong>存储期限</strong>：除非法律另有规定，我们仅在为您提供服务所需的必要期限内保留您的个人信息。当您注销账户后，我们将对您的本地数据进行删除或匿名化处理（已上链数据除外）。</p>
              </div>
            </section>

            {/* 六、 您的权利与联系我们 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-secondary pl-3">
                六、 您的权利与联系我们
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>您可以随时通过“个人中心”修改您的个人资料和密码。</p>
                <p>如果您需要注销账户或对本隐私政策有任何疑问，可通过以下官方电子邮箱联系我们：</p>
                <p>• <strong>联系邮箱</strong>：<a href="mailto:echorura@piscesoul.cn" className="text-echo-secondary hover:underline font-bold">echorura@piscesoul.cn</a></p>
                <p>• <strong>在线支持</strong>：您也可以在 App 内的“支持中心”提交反馈工单。</p>
              </div>
            </section>

          </div>
        </div>

        {/* Footer info link */}
        <div className="text-center text-xs text-gray-600">
          <p>© {new Date().getFullYear()} 极声音乐 ECHORURA. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
