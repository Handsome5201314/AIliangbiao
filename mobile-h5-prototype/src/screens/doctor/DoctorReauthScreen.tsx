import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { verifyDoctorPin } from '@/services/assessmentService';

export interface DoctorReauthScreenProps {
  onVerifySuccess: () => void;
  sessionId?: string | null;
  authHeaders?: HeadersInit;
}

const PIN_LENGTH = 6;

const DoctorReauthScreen: React.FC<DoctorReauthScreenProps> = ({
  onVerifySuccess,
  sessionId,
  authHeaders,
}) => {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = pin.split('');
    newPin[index] = value;
    const pinStr = newPin.join('').replace(/\s/g, '');
    setPin(pinStr);
    setError(null);

    // Auto-focus next
    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (pin.length !== PIN_LENGTH) return;
    setVerifying(true);
    setError(null);

    try {
      const result = await verifyDoctorPin(pin, sessionId, authHeaders);
      if (result.success) {
        onVerifySuccess();
      } else {
        setError('PIN码错误，请重试');
        setPin('');
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('PIN码错误，请重试');
      setPin('');
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify when all digits entered
  React.useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.length]);

  return (
    <section
      data-component="doctor-reauth"
      className="px-5 py-8 flex flex-col items-center justify-center min-h-full"
    >
      {/* Icon */}
      <div className="w-16 h-16 bg-sage-50 rounded-full flex items-center justify-center p-4">
        <Lock className="w-8 h-8 text-sage-300" />
      </div>

      <h1 className="text-xl font-semibold text-foreground mt-5">身份验证</h1>
      <p className="text-sm text-muted mt-2 text-center max-w-[280px]">
        为保护患者隐私，请医生重新确认身份。
      </p>

      {/* PIN input */}
      <div className="mt-8 flex gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            className="pin-input"
            maxLength={1}
            type="tel"
            inputMode="numeric"
            value={pin[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={`PIN第${i + 1}位`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 mt-3">{error}</p>
      )}

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={pin.length !== PIN_LENGTH || verifying}
        className={cn(
          'mt-8 w-full max-w-[280px] h-button bg-sage-400 text-white rounded-button font-medium text-base',
          'active:opacity-90 transition-smooth',
          (pin.length !== PIN_LENGTH || verifying) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {verifying ? '验证中...' : '确认身份'}
      </button>

      {/* Hint */}
      <p className="mt-6 text-xs text-muted">
        提示：请输入医生端已配置的 6 位 PIN 码
      </p>
    </section>
  );
};

export default DoctorReauthScreen;
