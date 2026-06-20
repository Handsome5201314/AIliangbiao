import { useState, useCallback, useRef, useEffect } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as authApi from '@/services/authService';

interface DoctorPinLoginScreenProps {
  onUnlock: () => void;
  onLogout: () => void;
  doctorName: string;
}

export default function DoctorPinLoginScreen({
  onUnlock,
  onLogout,
  doctorName,
}: DoctorPinLoginScreenProps) {
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

    // Auto-advance to next input
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

  // Auto-verify when 6 digits entered
  const handleVerify = useCallback(async () => {
    if (pin.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const ok = await authApi.verifyDoctorPin(pin);
      if (ok) {
        onUnlock();
      } else {
        setError('PIN 码错误，请重试');
        setPin('');
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('验证失败，请重试');
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

  return (
    <div className="flex flex-col min-h-full px-6 py-10 safe-top safe-bottom items-center justify-center">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-sage-500" />
        </div>
        <h2 className="text-lg font-bold text-foreground">医生身份验证</h2>
        <p className="text-sm text-muted mt-1">{doctorName}，请输入 6 位 PIN 码</p>
      </div>

      {/* PIN input */}
      <div className="flex gap-2.5 mb-4" data-component="pin-input">
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

      {/* Verifying indicator */}
      {verifying && (
        <div className="flex items-center gap-2 text-sm text-muted mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          验证中...
        </div>
      )}

      {/* Logout option */}
      <Button
        variant="ghost"
        onClick={onLogout}
        className="text-sm text-muted"
      >
        切换账号
      </Button>
    </div>
  );
}
