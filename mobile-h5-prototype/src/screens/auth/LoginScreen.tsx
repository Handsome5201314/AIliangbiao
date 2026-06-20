import { useState, useCallback, useRef, useEffect } from 'react';
import { Phone, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as authApi from '@/services/authService';
import type { AuthUser } from '@/types';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: AuthUser) => void;
  onGuestLogin: () => void;
}

export default function LoginScreen({ onLoginSuccess, onGuestLogin }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState(() => authApi.getStoredPhone());
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState<'sms' | 'password'>('sms');
  const [password, setPassword] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phone validation
  const isPhoneValid = /^1\d{10}$/.test(identifier);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isPasswordIdentifierValid = isPhoneValid || isEmailValid;

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send SMS code
  const handleSendCode = useCallback(async () => {
    if (!isPhoneValid) {
      setError('请输入正确的11位手机号');
      return;
    }
    setError('');
    try {
      await authApi.sendSmsCode(identifier);
      setCodeSent(true);
      setCountdown(60);
      // Auto-focus code input
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch (e: any) {
      setError(e.message || '发送验证码失败');
    }
  }, [identifier, isPhoneValid]);

  // Login with SMS code
  const handleSmsLogin = useCallback(async () => {
    if (code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.loginWithSms(identifier, code);
      onLoginSuccess(token, user);
    } catch (e: any) {
      if (e.code === 'PHONE_NOT_REGISTERED') {
        setError('该手机号尚未注册，请先注册账号');
      } else {
        setError(e.message || '登录失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }, [identifier, code, onLoginSuccess]);

  // Login with password
  const handlePasswordLogin = useCallback(async () => {
    if (!isPasswordIdentifierValid) {
      setError('请输入手机号或医生邮箱');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.loginWithPassword(identifier, password);
      onLoginSuccess(token, user);
    } catch (e: any) {
      setError(e.message || '登录失败，请检查手机号和密码');
    } finally {
      setLoading(false);
    }
  }, [identifier, password, isPasswordIdentifierValid, onLoginSuccess]);

  // Auto-login when code is 6 digits
  useEffect(() => {
    if (code.length === 6 && codeSent && !loading) {
      handleSmsLogin();
    }
  }, [code, codeSent, loading, handleSmsLogin]);

  const handleSubmit = () => {
    if (loginMode === 'sms') {
      if (!codeSent) {
        handleSendCode();
      } else {
        handleSmsLogin();
      }
    } else {
      handlePasswordLogin();
    }
  };

  const handleGuestClick = () => {
    setError('游客体验需后端签发真实会话，当前暂未开放');
    void onGuestLogin;
  };

  // Code input handler — only allow digits
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
  };

  return (
    <div className="flex flex-col min-h-full px-6 py-10 safe-top safe-bottom">
      {/* Logo & Title */}
      <div className="flex flex-col items-center mt-8 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-sage-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">智伴童行</h1>
        <p className="text-sm text-muted mt-1">儿童发育评估智能助手</p>
      </div>

      {/* Login form card */}
      <div
        data-component="login-form"
        className="bg-white rounded-card p-6 shadow-sm"
      >
        {/* Mode tabs */}
        <div className="flex mb-6 bg-cream-100 rounded-pill p-0.5">
          <Button
            variant="ghost"
            onClick={() => { setLoginMode('sms'); setError(''); }}
            className={`flex-1 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
              loginMode === 'sms' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
            }`}
          >
            验证码登录
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setLoginMode('password'); setError(''); }}
            className={`flex-1 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
              loginMode === 'password' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
            }`}
          >
            密码登录
          </Button>
        </div>

        {/* Phone input */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted mb-1.5 block">
            {loginMode === 'sms' ? '手机号' : '手机号 / 医生邮箱'}
          </label>
          <div className="flex items-center h-12 border-2 border-cream-200 rounded-button px-3 focus-within:border-sage-400 transition-smooth">
            <Phone className="w-4 h-4 text-muted mr-2 flex-shrink-0" />
            <input
              type={loginMode === 'sms' ? 'tel' : 'text'}
              inputMode={loginMode === 'sms' ? 'numeric' : 'email'}
              maxLength={loginMode === 'sms' ? 11 : 80}
              value={identifier}
              onChange={(e) => {
                const nextValue =
                  loginMode === 'sms'
                    ? e.target.value.replace(/\D/g, '').slice(0, 11)
                    : e.target.value.trim();
                setIdentifier(nextValue);
                setError('');
              }}
              placeholder={loginMode === 'sms' ? '请输入手机号' : '请输入手机号或医生邮箱'}
              className="flex-1 bg-transparent text-base outline-none min-w-0"
              autoComplete={loginMode === 'sms' ? 'tel' : 'username'}
            />
          </div>
        </div>

        {/* SMS code input */}
        {loginMode === 'sms' && (
          <div className="mb-4">
            <label className="text-xs font-medium text-muted mb-1.5 block">验证码</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center h-12 border-2 border-cream-200 rounded-button px-3 focus-within:border-sage-400 transition-smooth">
                <input
                  ref={codeInputRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="6位验证码"
                  className="flex-1 bg-transparent text-base outline-none"
                  autoComplete="one-time-code"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSendCode}
                disabled={!isPhoneValid || countdown > 0}
                className="h-12 px-4 text-xs whitespace-nowrap flex-shrink-0"
              >
                {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
              </Button>
            </div>
            {codeSent && (
              <p className="text-xs text-muted mt-1.5">
                验证码已发送至 {identifier.slice(0, 3)}****{identifier.slice(7)}
              </p>
            )}
          </div>
        )}

        {/* Password input */}
        {loginMode === 'password' && (
          <div className="mb-4">
            <label className="text-xs font-medium text-muted mb-1.5 block">密码</label>
            <div className="flex items-center h-12 border-2 border-cream-200 rounded-button px-3 focus-within:border-sage-400 transition-smooth">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="请输入密码"
                className="flex-1 bg-transparent text-base outline-none"
                autoComplete="current-password"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 mb-3 float-up">{error}</p>
        )}

        {/* Login button */}
        <Button
          onClick={handleSubmit}
          disabled={loading || (loginMode === 'sms' ? !isPhoneValid : (!isPasswordIdentifierValid || password.length < 6))}
          className="w-full h-12 text-base"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 登录中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              登录 <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>

      {/* Guest entry */}
      <div className="mt-6 flex flex-col items-center">
        <Button
          variant="ghost"
          onClick={handleGuestClick}
          className="text-sm text-muted"
        >
          游客体验暂未开放
        </Button>
        <p className="text-[10px] text-muted/60 mt-1">
          接入真实游客会话后开放
        </p>
      </div>
    </div>
  );
}
