'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Mail, Lock, Loader2, Phone, KeyRound, UserPlus } from 'lucide-react';
import { useTranslation } from '@/store/languageStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIsLogin?: boolean;
}

const getFriendlyErrorMessage = (err: any, defaultMsg: string) => {
  if (!err) return defaultMsg;
  const message = err.message || '';
  if (message.includes('SignatureDoesNotMatch') || message.includes('sendPhoneConfirmation')) {
    return '短信发送失败：短信服务配置有误（签名或凭证不匹配），请联系系统管理员检查后台配置。';
  }
  if (message.includes('User already registered') || message.includes('already exists')) {
    return '该手机号已注册，请直接登录或使用找回密码功能。';
  }
  return message || defaultMsg;
};

export default function AuthModal({ isOpen, onClose, initialIsLogin = true }: AuthModalProps) {
  const { t, language } = useTranslation();
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [referrerPhone, setReferrerPhone] = useState('');

  // Phone auth mode: login (登录) / register (注册) / forgot (忘记密码)
  const [phoneMode, setPhoneMode] = useState<'login' | 'register' | 'forgot'>(initialIsLogin ? 'login' : 'register');

  // Email states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone states
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [newPassword, setNewPassword] = useState(''); // for forgot password

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSuccessRedirect = () => {
    onClose();
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/register') {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        setReferrerPhone(ref);
        setPhoneMode('register');
        setIsLogin(false);
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.echorura.com'}/`,
            data: {
              referrer_phone: referrerPhone
            }
          }
        });
        if (error) throw error;
        alert('注册成功！请查收邮件确认，或直接尝试登录。');
      }
      handleSuccessRedirect();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '操作失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  // 1. 发送注册验证码 (调用 signUp 发送验证码)
  const handleSendRegisterOtp = async () => {
    if (!phone || !password) {
      setError('请输入手机号和自设密码');
      return;
    }
    if (password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      const { error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password: password,
        options: {
          data: {
            referrer_phone: referrerPhone
          }
        }
      });
      if (error) throw error;

      setIsOtpSent(true);
      setCountdown(60);
      alert('注册验证码已发送，请查收短信。');
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '发送验证码失败，可能该手机号已注册'));
    } finally {
      setLoading(false);
    }
  };

  // 2. 发送忘记密码验证码 (调用 signInWithOtp 发送验证码)
  const handleSendForgotOtp = async () => {
    if (!phone) {
      setError('请输入手机号');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;

      setIsOtpSent(true);
      setCountdown(60);
      alert('验证码已发送，请查收短信。');
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '发送验证码失败'));
    } finally {
      setLoading(false);
    }
  };

  // 3. 手机号 + 密码 登录
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('请输入手机号和密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      const { error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password,
      });
      if (error) throw error;

      handleSuccessRedirect();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '登录失败，请检查手机号和密码'));
    } finally {
      setLoading(false);
    }
  };

  // 4. 手机号注册 (提交验证码)
  const handlePhoneRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOtpSent) {
      return handleSendRegisterOtp();
    }
    if (!otpCode) {
      setError('请输入短信验证码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });
      if (error) throw error;

      alert('注册成功！已为您自动登录。');
      handleSuccessRedirect();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '验证码错误，请重试'));
    } finally {
      setLoading(false);
    }
  };

  // 5. 忘记密码重置 (提交验证码和新密码)
  const handlePhoneResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOtpSent) {
      return handleSendForgotOtp();
    }
    if (!otpCode || !newPassword) {
      setError('请输入验证码和新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度不能少于 6 位');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      // 验证 OTP 登录
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      // 验证成功后用户已登录，直接修改密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      alert('密码重置成功，已自动登录！');
      handleSuccessRedirect();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '重置密码失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  // 6. 第三方 OAuth 登录 (Google & Apple)
  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: referrerPhone ? { referrer_phone: referrerPhone } : undefined
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '三方登录失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
            {authMethod === 'phone' ? (
              phoneMode === 'login' ? t('auth.phone_login') :
                phoneMode === 'register' ? t('auth.phone_register') :
                  t('auth.recover_pwd')
            ) : (
              isLogin ? t('auth.welcome_back') : t('auth.join_echorura')
            )}
          </h2>
          <p className="text-gray-400 text-sm">
            {authMethod === 'phone' ? (
              phoneMode === 'login' ? t('auth.phone_login_desc') :
                phoneMode === 'register' ? t('auth.phone_register_desc') :
                  t('auth.phone_recover_desc')
            ) : (
              t('auth.join_community')
            )}
          </p>
        </div>

        {/* Auth Method Tabs */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          <button
            onClick={() => { setAuthMethod('phone'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMethod === 'phone' ? 'bg-echo-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
          >
            {t('auth.phone_tab')}
          </button>
          <button
            onClick={() => { setAuthMethod('email'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMethod === 'email' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
          >
            {t('auth.email_tab')}
          </button>
        </div>

        {authMethod === 'phone' ? (
          phoneMode === 'login' ? (
            /* 1. 手机号 + 密码 登录表单 */
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.phone_number')}</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="13800138000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">{t('auth.password')}</label>
                  <button
                    type="button"
                    onClick={() => { setPhoneMode('forgot'); setError(null); setIsOtpSent(false); }}
                    className="text-xs text-echo-primary hover:underline transition-all"
                  >
                    {t('auth.forgot_pwd')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.login_now')}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setPhoneMode('register'); setError(null); setIsOtpSent(false); }}
                  className="text-sm text-gray-400 hover:text-echo-primary transition-colors"
                >
                  {t('auth.no_account')}
                </button>
              </div>
            </form>
          ) : phoneMode === 'register' ? (
            /* 2. 手机号 + 密码 注册表单（带验证码） */
            <form onSubmit={handlePhoneRegisterSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t('auth.phone_number')}</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-xs text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="13800138000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t('auth.set_password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-xs text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 flex items-center justify-between">
                  <span>{t('auth.invite_code')}</span>
                  <span className="text-[9px] bg-echo-primary/10 text-echo-primary px-1 py-0.5 rounded font-mono">{t('auth.invite_bonus')}</span>
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={referrerPhone}
                    onChange={(e) => setReferrerPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-xs text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder={t('auth.invite_placeholder')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t('auth.sms_code')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required={isOtpSent}
                      disabled={!isOtpSent}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-xs text-white focus:border-echo-primary/50 focus:outline-none transition-all disabled:opacity-50"
                      placeholder={isOtpSent ? t('auth.enter_otp') : t('auth.get_otp_first')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendRegisterOtp}
                    disabled={loading || countdown > 0 || !phone || !password}
                    className="px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-echo-primary hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}${t('auth.resend_countdown')}` : t('auth.get_otp')}
                  </button>
                </div>
              </div>

              {error && <div className="text-red-400 text-xs bg-red-400/10 p-2.5 rounded-xl border border-red-400/20">{error}</div>}

              <button
                type="submit"
                disabled={loading || !isOtpSent}
                className="w-full bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-3 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.register_now')}
              </button>

              <div className="text-[10px] text-gray-500 text-center mt-1 px-2 leading-normal">
                {t('auth.terms_agree')} 
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline mx-0.5 font-bold">《服务条款》</a> 
                与 
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline mx-0.5 font-bold">《隐私政策》</a>
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setPhoneMode('login'); setError(null); setIsOtpSent(false); }}
                  className="text-sm text-gray-400 hover:text-echo-primary transition-colors"
                >
                  {t('auth.has_account')}
                </button>
              </div>
            </form>
          ) : (
            /* 3. 手机号 忘记密码/找回密码表单 */
            <form onSubmit={handlePhoneResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.phone_number')}</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="13800138000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.new_password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.sms_code')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required={isOtpSent}
                      disabled={!isOtpSent}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all disabled:opacity-50"
                      placeholder={isOtpSent ? t('auth.enter_otp') : t('auth.get_otp_first')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendForgotOtp}
                    disabled={loading || countdown > 0 || !phone}
                    className="px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-echo-primary hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}${t('auth.resend_countdown')}` : t('auth.get_otp')}
                  </button>
                </div>
              </div>

              {error && <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}

              <button
                type="submit"
                disabled={loading || !isOtpSent}
                className="w-full bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.reset_login')}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setPhoneMode('login'); setError(null); setIsOtpSent(false); }}
                  className="text-sm text-gray-400 hover:text-echo-primary transition-colors"
                >
                  {t('auth.back_to_login')}
                </button>
              </div>
            </form>
          )
        ) : (
          /* 4. 邮箱密码 登录/注册表单 */
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('auth.access_password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center justify-between">
                  <span>{t('auth.invite_code')}</span>
                  <span className="text-[10px] bg-echo-primary/10 text-echo-primary px-1.5 py-0.5 rounded font-mono">{t('auth.invite_bonus')}</span>
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={referrerPhone}
                    onChange={(e) => setReferrerPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-echo-primary/50 focus:outline-none transition-all"
                    placeholder={t('auth.invite_placeholder')}
                  />
                </div>
              </div>
            )}

            {error && <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-echo-primary to-echo-secondary text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? t('auth.login_or_register') : t('auth.create_account'))}
            </button>

            {!isLogin && (
              <div className="text-[10px] text-gray-500 text-center mt-2 px-2 leading-normal">
                {t('auth.terms_agree')} 
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline mx-0.5 font-bold">{language === 'zh' ? '《服务条款》' : 'Terms of Service'}</a> 
                {t('auth.and')} 
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-echo-primary hover:underline mx-0.5 font-bold">{language === 'zh' ? '《隐私政策》' : 'Privacy Policy'}</a>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-gray-400 hover:text-echo-primary transition-colors"
              >
                {isLogin ? t('auth.no_account') : t('auth.has_account')}
              </button>
            </div>
          </form>
        )}

        {/* Third-Party OAuth Social Logins */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <span className="relative px-3 bg-[#0d0d12] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {t('auth.or_continue_with')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google
          </button>
          <button
            onClick={() => handleOAuthLogin('apple')}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.49-.62.71-1.16 1.85-1.01 2.96 1.12.09 2.27-.57 2.94-1.39z"/>
            </svg>
            Apple
          </button>
        </div>
      </div>
    </div>
  );
}
