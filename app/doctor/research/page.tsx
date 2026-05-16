'use client';

import PageHeader from '@/components/layout/PageHeader';

export default function DoctorResearchPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="科研导出中心" description="当前版本默认从患者详情页按成员导出；这里将承接后续的批量科研导出与筛选工作流。" />

      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        V1 先支持在患者详情页导出单个成员的去标识科研数据；这里保留为后续批量导出入口。
      </div>
    </div>
  );
}
