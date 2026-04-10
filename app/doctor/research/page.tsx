'use client';

export default function DoctorResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">科研导出中心</h1>
        <p className="mt-2 text-sm text-slate-500">当前版本默认从患者详情页按成员导出；这里将承接后续的批量科研导出与筛选工作流。</p>
      </div>

      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        V1 先支持在患者详情页导出单个成员的去标识科研数据；这里保留为后续批量导出入口。
      </div>
    </div>
  );
}
