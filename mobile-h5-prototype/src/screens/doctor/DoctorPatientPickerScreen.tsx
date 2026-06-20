import React from 'react';
import { ChevronLeft, Search, UserPlus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DoctorPatient } from '@/types';

export interface DoctorPatientPickerScreenProps {
  patients: DoctorPatient[];
  onSelectPatient: (patient: DoctorPatient) => void;
  onCreateTemp: () => void;
  onBack: () => void;
}

const genderLabels = {
  male: '男',
  female: '女',
  unknown: '未填写',
} satisfies Record<DoctorPatient['gender'], string>;

const DoctorPatientPickerScreen: React.FC<DoctorPatientPickerScreenProps> = ({
  patients,
  onSelectPatient,
  onCreateTemp,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.trim().toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ageLabel.includes(q) ||
        (p.latestAssessment?.scaleName ?? '').toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  return (
    <section data-component="doctor-patient-picker" className="px-5 py-4">
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
        <h1 className="text-xl font-semibold text-foreground">选择患者</h1>
      </div>

      {/* Search bar */}
      <div className="mt-4 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="搜索患者姓名、年龄..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full bg-cream-100 rounded-button pl-10 pr-4 py-3 text-base',
            'placeholder:text-muted outline-none',
            'focus:ring-2 focus:ring-sage-400/30 transition-smooth'
          )}
        />
      </div>

      {/* Create temp patient */}
      <Button
        variant="outline"
        onClick={onCreateTemp}
        className={cn(
          'mt-3 w-full border-2 border-dashed border-sage-300 rounded-card p-3',
          'flex items-center justify-center gap-2',
          'active:bg-sage-50 transition-smooth'
        )}
      >
        <UserPlus className="w-5 h-5 text-sage-400" />
        <span className="text-sage-600 text-sm font-medium">创建临时患者档案</span>
      </Button>

      {/* Patient list */}
      <div className="mt-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="w-10 h-10 text-muted/40" />
            <p className="mt-3 text-sm text-muted">未找到匹配的患者</p>
          </div>
        ) : (
          filtered.map((patient) => (
            <Button
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              className={cn(
                'bg-white rounded-card p-4 flex items-center gap-4 shadow-sm',
                'active:opacity-90 transition-smooth text-left w-full'
              )}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
                {patient.avatar ? (
                  <span className="text-lg">{patient.avatar}</span>
                ) : (
                  <User className="w-6 h-6 text-sage-300" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{patient.name}</span>
                  {patient.isTemporary && (
                    <span className="bg-warm-50 text-warm-600 text-xs px-2 py-0.5 rounded-pill">
                      临时
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-muted">
                  {patient.ageLabel} · {genderLabels[patient.gender]}
                </div>
                {patient.latestAssessment && (
                  <div className="mt-1 text-sm text-muted truncate">
                    最近: {patient.latestAssessment.scaleName} ({patient.latestAssessment.date})
                  </div>
                )}
              </div>
            </Button>
          ))
        )}
      </div>
    </section>
  );
};

export default DoctorPatientPickerScreen;
