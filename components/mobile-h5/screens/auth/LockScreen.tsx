import { useState, useCallback, useRef, useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/mobile-h5/components/ui/button';
import * as authApi from '@/components/mobile-h5/services/authService';

interface LockScreenProps {
  onUnlock: () => void;
  onLogout: () => void;
  doctorName: string;
}

export default function LockScreen({ onUnlock, onLogout, doctorName }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newPin = pin.split('');
    newPin[index] = digit;
    const joined = newPin.join('');
    setPin(joined);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      setPin(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = useCallback(async () => {
    if (pin.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const ok = await authApi.verifyDoctorPin(pin);
      if (ok) {
        onUnlock();
      } else {
        setError('PIN 码错误');
        setPin('');
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('验证失败');
      setPin('');
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }, [pin, onUnlock]);

  useEffect(() => {
    if (pin.length === 6 && !verifying) {
      handleVerify();
    }
  }, [pin, verifying, handleVerify]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div
      data-component="lock-screen"
      className="fixed inset-0 z-50 bg-cream-100 flex flex-col items-center justify-center px-6 safe-top safe-bottom"
    >
      {/* Overlay background with blur */}
      <div className="absolute inset-0 bg-cream-100/95 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Lock icon */}
        <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mb-5">
          <Lock className="w-8 h-8 text-sage-500" />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-1">屏幕已锁定</h2>
        <p className="text-sm text-muted mb-8">
          {doctorName}，长时间未操作，请输入 PIN 码解锁
        </p>

        {/* PIN input */}
        <div className="flex gap-2.5 mb-4" data-component="lock-pin-input">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={pin[i] || ''}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              className="pin-input"
              autoComplete="off"
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 mb-4 float-up">{error}</p>
        )}

        {/* Verifying */}
        {verifying && (
          <div className="flex items-center gap-2 text-sm text-muted mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            验证中...
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={onLogout}
          className="text-sm text-muted mt-4"
        >
          退出登录
        </Button>
      </div>
    </div>
  );
}
