import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/mobile-h5/components/ui/button';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { TemporaryPatient } from '@/components/mobile-h5/types';

export interface TemporaryPatientFormScreenProps {
  onSubmit: (data: TemporaryPatient) => void;
  onBack: () => void;
}

const TemporaryPatientFormScreen: React.FC<TemporaryPatientFormScreenProps> = ({
  onSubmit,
  onBack,
}) => {
  const [name, setName] = React.useState('');
  const [gender, setGender] = React.useState<'male' | 'female' | ''>('');
  const [ageMonths, setAgeMonths] = React.useState<number | ''>('');
  const [contact, setContact] = React.useState('');
  const [note, setNote] = React.useState('');

  const canSubmit = name.trim().length > 0 && gender !== '';

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      gender: gender as 'male' | 'female',
      ageMonths: typeof ageMonths === 'number' ? ageMonths : 0,
      contact: contact.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <section data-component="temp-patient-form" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="w-11 h-11 -ml-2 rounded-full active:bg-cream-200 transition-smooth"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">创建临时患者</h1>
      </div>

      {/* Form */}
      <div className="mt-5 flex flex-col gap-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            姓名或昵称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入"
            className={cn(
              'bg-cream-100 rounded-button px-4 py-3 w-full text-base',
              'placeholder:text-muted outline-none',
              'focus:ring-2 focus:ring-sage-400/30 transition-smooth'
            )}
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            性别
          </label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGender('male')}
              className={cn(
                'flex-1 h-12 rounded-button text-sm font-medium transition-smooth',
                gender === 'male'
                  ? 'bg-sage-400 text-white'
                  : 'bg-cream-100 text-foreground'
              )}
            >
              男孩
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGender('female')}
              className={cn(
                'flex-1 h-12 rounded-button text-sm font-medium transition-smooth',
                gender === 'female'
                  ? 'bg-sage-400 text-white'
                  : 'bg-cream-100 text-foreground'
              )}
            >
              女孩
            </Button>
          </div>
        </div>

        {/* Age */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            年龄
          </label>
          <div className="relative">
            <input
              type="number"
              value={ageMonths}
              onChange={(e) => {
                const val = e.target.value;
                setAgeMonths(val === '' ? '' : Number(val));
              }}
              placeholder="请输入月龄"
              min={0}
              max={240}
              className={cn(
                'bg-cream-100 rounded-button px-4 py-3 w-full text-base pr-12',
                'placeholder:text-muted outline-none',
                'focus:ring-2 focus:ring-sage-400/30 transition-smooth',
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              月
            </span>
          </div>
        </div>

        {/* Contact (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            联系方式（选填）
          </label>
          <input
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="请输入"
            className={cn(
              'bg-cream-100 rounded-button px-4 py-3 w-full text-base',
              'placeholder:text-muted outline-none',
              'focus:ring-2 focus:ring-sage-400/30 transition-smooth'
            )}
          />
        </div>

        {/* Note (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            备注（选填）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="请输入"
            rows={3}
            className={cn(
              'bg-cream-100 rounded-button px-4 py-3 w-full text-base resize-none',
              'placeholder:text-muted outline-none',
              'focus:ring-2 focus:ring-sage-400/30 transition-smooth'
            )}
          />
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'mt-8 w-full h-button rounded-button font-medium text-base transition-smooth',
          canSubmit
            ? 'bg-sage-400 text-white active:opacity-90'
            : 'bg-cream-200 text-muted cursor-not-allowed'
        )}
      >
        创建并开始
      </Button>
    </section>
  );
};

export default TemporaryPatientFormScreen;
