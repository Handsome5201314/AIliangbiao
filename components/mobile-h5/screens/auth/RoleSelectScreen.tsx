import { UserRound, Stethoscope } from 'lucide-react';
import { Button } from '@/components/mobile-h5/components/ui/button';

interface RoleSelectScreenProps {
  userName: string;
  onSelectRole: (role: 'patient' | 'doctor') => void;
}

export default function RoleSelectScreen({ userName, onSelectRole }: RoleSelectScreenProps) {
  return (
    <div className="flex flex-col min-h-full px-6 py-10 safe-top safe-bottom">
      {/* Header */}
      <div className="flex flex-col items-center mt-8 mb-10">
        <h1 className="text-xl font-bold text-foreground">选择使用身份</h1>
        <p className="text-sm text-muted mt-1">
          欢迎你，{userName}，请选择本次使用身份
        </p>
      </div>

      {/* Role cards */}
      <div className="flex flex-col gap-4" data-component="role-selector">
        {/* Patient role */}
        <Button
          variant="outline"
          onClick={() => onSelectRole('patient')}
          className="h-auto p-5 flex items-start gap-4 text-left hover:border-sage-400 hover:bg-sage-50/50"
        >
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center flex-shrink-0">
            <UserRound className="w-6 h-6 text-sage-500" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">家长端</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              为孩子进行发育评估，查看测评报告和历史记录，随时了解孩子的成长状况。
            </p>
          </div>
        </Button>

        {/* Doctor role */}
        <Button
          variant="outline"
          onClick={() => onSelectRole('doctor')}
          className="h-auto p-5 flex items-start gap-4 text-left hover:border-sky-400 hover:bg-sky-50/50"
        >
          <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-6 h-6 text-sky-500" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">医生端</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              在门诊环境中发起和管理测评，支持辅助填写和交接模式，查看临床数据。
            </p>
          </div>
        </Button>
      </div>

      {/* Tip */}
      <p className="text-[10px] text-muted/60 text-center mt-6">
        切换身份后可在页面顶部切换回来
      </p>
    </div>
  );
}
