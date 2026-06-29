'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050508] text-gray-300 py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Background Decorative Ambient Lights */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-echo-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-echo-secondary/10 blur-[120px] pointer-events-none" />

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
            <span className="text-[10px] bg-echo-primary/10 text-echo-primary border border-echo-primary/20 px-2.5 py-1 rounded-full font-black tracking-wider uppercase flex items-center gap-1">
              <Scale className="w-3 h-3" /> 合规公示
            </span>
          </div>
        </div>

        {/* Header Branding Panel */}
        <div className="text-center md:text-left space-y-3">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight italic">
            服务协议与服务条款
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
            ECHORURA SERVICE AGREEMENT & TERMS OF SERVICE · 最近更新：2026年6月6日
          </p>
        </div>

        {/* Content Body with Glassmorphism container */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> 特别提示与说明
            </h3>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              1. 本协议中关于版权归属、侵权处理（避风港声明）、平台免责、争议解决的条款已通过重点提示标出，请您在使用极声音乐服务前务必重点阅读并完全理解。<br />
              2. 极声音乐包含去中心化数据存证与基于共享协议的积分核算技术。一旦您将交易或原创作品信息写入区块链，该等链上数据将永久存在，平台及任何第三方均无法予以篡改、冻结或物理删除。
            </p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-gray-300">
            
            {/* 一、 法律管辖与服从声明 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-primary pl-3">
                一、 法律管辖与服从声明
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>1. <strong>法律适用</strong>：本协议的订立、生效、履行、解释及争议解决均适用中华人民共和国法律（包括中华人民共和国香港特别行政区现行有效的法律及法规）。</p>
                <p>2. <strong>管辖法院</strong>：因本协议或本服务引起的或与之相关的任何争议，双方应首先通过友好协商解决；协商不成的，任何一方均可将争议提交至中华人民共和国境内（包括香港特别行政区）有管辖权的人民法院或司法机关通过诉讼解决。</p>
              </div>
            </section>

            {/* 二、 账户注册与安全 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-primary pl-3">
                二、 账户注册与安全
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>1. <strong>用户资质</strong>：您应是具有完全民事行为能力的自然人。如您代表法人或其他组织注册，则您声明已获得该组织的完整授权。</p>
                <p>2. <strong>账户创建</strong>：您在注册时应提供真实、准确、完整的个人信息（如邮箱地址）。您承诺不使用虚假、冒用他人名义的信息进行注册。</p>
                <p>3. <strong>账户保管</strong>：您的账户安全由您本人负责。<strong>本平台为用户提供 Web3 技术，对于由用户自行关联或保管的私钥、助记词、外部凭证或账户密码，若因您泄露、遗失或保管不当导致的积分、资产或数据损失，平台概不承担任何法律与经济责任。</strong></p>
              </div>
            </section>

            {/* 三、 极声社区行为规范与内容管理细则 */}
            <section className="space-y-3">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-primary pl-3">
                三、 极声社区行为规范与内容管理细则
              </h2>
              <p className="pl-3 text-gray-400">
                本平台倡导建设绿色、健康、积极的音乐分发与交流社区，所有用户在使用极声音乐发布动态、评论、私信、制作歌单、上传作品/封面及进行投票、认购等操作时，必须严格遵守本细则。
              </p>
              
              <div className="pl-3 space-y-3">
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">1. 社区提倡：</h4>
                  <ul className="list-disc pl-5 space-y-1 text-gray-400">
                    <li>本着原创、分享、互助、开放、自由的原则发布动态、评论、私信、图文、声音，制作歌单，上传原创作品等；</li>
                    <li>理性、宽容地看待不同的看法、喜好、意见等，欢迎有独特审美、不同音乐品味的用户；</li>
                    <li>尊重他人著作权、隐私权、个人信息权益等。</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">2. 社区不欢迎及禁止发布的内容：</h4>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-1">【国家与意识形态安全】</p>
                  <ol className="list-decimal pl-5 space-y-1 text-gray-400">
                    <li>反对宪法确定的基本原则的；</li>
                    <li>危害国家安全，泄露国家秘密，颠覆国家政权，破坏国家统一的；</li>
                    <li>损害国家荣誉和利益的；</li>
                    <li>歪曲、丑化、亵渎、否定英雄烈士事迹和精神，以侮辱、诽谤或者其他方式侵害英雄烈士的姓名、肖像、名誉、荣誉的；</li>
                    <li>宣扬恐怖主义、极端主义或者煽动实施恐怖活动、极端主义活动的；</li>
                    <li>煽动非法集会、结社、游行、示威、聚众扰乱社会秩序；以非法民间组织名义活动的；</li>
                    <li>散布谣言，扰乱社会秩序，破坏社会稳定的；不当评述自然灾害、重大事故等灾难的。</li>
                  </ol>

                  <p className="text-xs text-gray-500 font-bold uppercase mt-2">【社会风尚与公序良俗】</p>
                  <ol className="list-decimal pl-5 space-y-1 text-gray-400" start={8}>
                    <li value={8}>针对种族、国家、民族、宗教、性别、年龄、地缘、性取向、生理特征、人群等的歧视和仇恨言论；</li>
                    <li>不雅词句、人身攻击、故意骚扰、恶意辱骂使用；</li>
                    <li>色情、激进时政、意识形态方面的主题；</li>
                    <li>带有性暗示、性挑逗等易使人产生性联想的内容；</li>
                    <li>展现血腥、惊悚、残忍等致人身心不适的内容；</li>
                    <li>宣扬低俗、庸俗、媚俗内容；</li>
                    <li>发布、传播贩卖焦虑、炫富拜金、好逸劳作、奢侈浪费等价值导向存在问题的内容；</li>
                    <li>抄袭他人原创内容，或冒充他人；</li>
                    <li>发布广告信息、垃圾信息，或含有网络病毒的网站链接、图片等内容；</li>
                    <li>通过“蹭热点”、制造话题等形式干扰舆论、影响传播秩序的行为；</li>
                    <li>发布、传播无语义、无实质信息、言之无物的内容；</li>
                    <li>使用夸张标题，内容与标题严重不符的；</li>
                    <li>炒作绯闻、丑闻、劣迹等的；</li>
                    <li>煽动人群歧视、地域歧视等的。</li>
                  </ol>

                  <p className="text-xs text-gray-500 font-bold uppercase mt-2">【未成年人保护与合规基线】</p>
                  <ol className="list-decimal pl-5 space-y-1 text-gray-400" start={22}>
                    <li value={22}>侵害未成年人合法权益或者损害未成年人身心健康的内容；</li>
                    <li>可能引发未成年人模仿不安全行为 and 违反社会公德行为、引导未成年人不良嗜好等的内容；</li>
                    <li>不符合遵守法律法规、社会主义制度、国家利益、公民合法利益、公共秩序、社会道德风尚和信息真实性等“七条底线”要求的；</li>
                    <li>其他对网络生态造成不良影响以及法律法规禁止的其他内容。</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white">3. 专项管理政策：</h4>
                  <div className="space-y-2 pl-3">
                    <p className="text-xs text-gray-400">
                      <strong>（一）图片与封面管理</strong>：请勿上传涉及他人隐私、违规披露个人信息、淫秽色情、暴力血腥、违反国家法律法规的照片或图片。用户需要对所上传的照片或图片版权负责，平台不承担因此带来的任何第三方责任及法律风险。
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong>（二）娱乐信息与打榜管理</strong>：用户参与歌曲打榜与份额交易时，不得发布、传播诱导或鼓动未成年人无底线追星、消费攀比、应援集资、投票打榜、奢靡享乐等价值导向不良的内容；不得组织、引导粉丝以消费、打投等方式非理性应援；不得通过号召粉丝、雇佣网络水军、“养号”等形式刷量控评或干扰平台的听歌挖矿收益核算。
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong>（三）宗教信息管理</strong>：用户不得违反《互联网宗教信息服务管理办法》及相关法律要求。不得破坏宗教和睦，不得利用网络进行违法的宗教宣传，不得在平台组织宗教教育培训、发布讲经讲道内容或转发、链接相关内容，不得以文字、图片、音视频等方式直播或者录播佛道宗教仪式，严禁以宗教名义开展募捐。
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong>（四）机构账号管理</strong>：机构账号（指由法人或社会组织授权代表注册并管理的账号）必须提交真实的社会信用代码及身份信息完成核验，严禁冒用或关联党政机关、社会知名人士的名义。平台对引发粉丝互撕、拉踩引战的账号保留限流、禁言、封禁等处罚权力。
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">4. 社区管理指导原则：</h4>
                  <p className="text-xs text-gray-400">所有用户均有权向平台官方反馈或举报违规内容。如发现违法违规信息，平台工作人员有权介入并依法依规采取限制流量、禁言、下架作品直至封禁账号的处罚措施，对于违规情节恶劣的机构，将依法将违规信息上报至国家监管部门。</p>
                </div>
              </div>
            </section>

            {/* 四、 用户生成内容 (UGC) 与知识产权保护 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-primary pl-3">
                四、 用户生成内容 (UGC) 与知识产权保护
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>1. <strong>版权承诺</strong>：您在极声音乐上传的任何用户内容，您必须拥有完整的合法版权。</p>
                <p>2. <strong>平台授权</strong>：当您上传用户内容时，即代表您授予极声音乐一项全球范围、免费、非独占、可分发、可进行技术优化编码及存储的使用许可。</p>
                <p>3. <strong>避风港声明</strong>：极声音乐作为去中心化音乐分发与存储的技术服务提供商，对用户自行上传的内容仅提供托管与传输服务。平台在收到权利人合格的侵权通知后，将在合理时间内删除或断开相关内容的链接。</p>
              </div>
            </section>

            {/* 五、 服务中止与免责说明 */}
            <section className="space-y-2.5">
              <h2 className="text-lg font-black text-white border-l-2 border-echo-primary pl-3">
                五、 服务中止与免责说明
              </h2>
              <div className="pl-3 space-y-1.5 text-gray-400">
                <p>1. <strong>技术免责</strong>：因黑客攻击、系统维护、网络中断、公链性能拥堵、不可抗力等原因导致的服务中断、积分异常或交易失败，平台免于承担赔偿责任。</p>
                <p>2. <strong>测试期说明</strong>：<strong>在平台内测（Beta testing）期间，所有法币充值、提现等功能均处于界面演示阶段。用户知悉内测期间可能存在数据清空、模拟数据丢失的情况，并同意不因此向平台追究法律责任。</strong></p>
              </div>
            </section>

          </div>
        </div>

        {/* Footer info link */}
        <div className="text-center text-xs text-gray-600">
          <p>© {new Date().getFullYear()} 极声音乐 ECHORURA. All rights reserved.</p>
          <p className="mt-1">如有任何条款疑问，请通过官方邮箱联系我们：<a href="mailto:echorura@piscesoul.cn" className="text-echo-primary hover:underline">echorura@piscesoul.cn</a></p>
        </div>

      </div>
    </div>
  );
}
