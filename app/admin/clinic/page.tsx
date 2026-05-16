'use client';

import { useEffect, useMemo, useState } from 'react';

import ClinicQrListCard from '@/components/ClinicQrListCard';
import InviteQrCard from '@/components/InviteQrCard';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

export default function AdminClinicPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [qrs, setQrs] = useState<any[]>([]);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [scales, setScales] = useState<any[]>([]);
  const [pointForm, setPointForm] = useState({
    name: '',
    ownerDoctorProfileId: '',
    locationLabel: '',
    departmentLabel: '',
  });
  const [showAdvancedPoint, setShowAdvancedPoint] = useState(false);
  const [qrForm, setQrForm] = useState({
    pointId: '',
    scaleId: '',
  });
  const [status, setStatus] = useState('');

  const loadAll = async () => {
    const [pointsRes, qrsRes, screeningsRes, scalesRes] = await Promise.all([
      fetch('/api/admin/clinic-points'),
      fetch('/api/admin/clinic-qrs'),
      fetch('/api/admin/clinic-screenings'),
      fetch('/api/scales'),
    ]);

    const [pointsData, qrsData, screeningsData, scalesData] = await Promise.all([
      pointsRes.json().catch(() => ({})),
      qrsRes.json().catch(() => ({})),
      screeningsRes.json().catch(() => ({})),
      scalesRes.json().catch(() => ({})),
    ]);

    setDoctors(pointsData.doctors || []);
    setPoints(pointsData.points || []);
    setQrs(qrsData.qrs || []);
    setScreenings(screeningsData.screenings || []);
    setScales(scalesData.scales || []);

    if (!pointForm.ownerDoctorProfileId && pointsData.doctors?.length) {
      setPointForm((prev) => ({ ...prev, ownerDoctorProfileId: pointsData.doctors[0].id }));
    }
    if (!qrForm.pointId && pointsData.points?.length) {
      setQrForm((prev) => ({ ...prev, pointId: pointsData.points[0].id }));
    }
    if (!qrForm.scaleId && scalesData.scales?.length) {
      setQrForm((prev) => ({ ...prev, scaleId: scalesData.scales[0].id }));
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const qrItems = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return qrs.map((qr) => ({
      ...qr,
      publicUrl: `${window.location.origin}/clinic/qr/${qr.slug}`,
    }));
  }, [qrs]);

  const latestQrUrl = qrItems[0]?.publicUrl || '';

  const createPoint = async () => {
    const response = await fetch('/api/admin/clinic-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pointForm),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || '创建点位失败');
      return;
    }
    setStatus('点位已创建，并已自动选中，可直接继续生成长期二维码');
    setPointForm((prev) => ({
      ...prev,
      name: '',
      locationLabel: '',
      departmentLabel: '',
    }));
    setQrForm((prev) => ({ ...prev, pointId: data.point.id }));
    await loadAll();
  };

  const createQr = async () => {
    const response = await fetch('/api/admin/clinic-qrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qrForm),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? '长期二维码已生成' : data.error || '生成二维码失败');
    await loadAll();
  };

  const toggleQr = async (id: string, isActive: boolean) => {
    const response = await fetch(`/api/admin/clinic-qrs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? '二维码状态已更新' : data.error || '更新失败');
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="门诊长期二维码"
        description="管理门诊点位、长期量表二维码和门诊记录池。"
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">创建点位</h2>
        <p className="mt-2 text-sm text-slate-500">
          先填写点位名称并选择归属医生。已有二维码不会被覆盖，旧二维码会在下方列表中保留入口。
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            value={pointForm.name}
            onChange={(e) => setPointForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="例如：儿科 2 号诊室"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
          />
          <select
            value={pointForm.ownerDoctorProfileId}
            onChange={(e) => setPointForm((prev) => ({ ...prev, ownerDoctorProfileId: e.target.value }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
          >
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.realName} · {doctor.hospitalName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedPoint((value) => !value)}
          className="mt-4 text-sm font-medium text-cyan-700 hover:text-cyan-800"
        >
          {showAdvancedPoint ? '收起高级设置' : '高级设置'}
        </button>
        {showAdvancedPoint ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              value={pointForm.locationLabel}
              onChange={(e) => setPointForm((prev) => ({ ...prev, locationLabel: e.target.value }))}
              placeholder="位置标签，可选"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
            />
            <Input
              value={pointForm.departmentLabel}
              onChange={(e) => setPointForm((prev) => ({ ...prev, departmentLabel: e.target.value }))}
              placeholder="科室标签，可选"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
            />
          </div>
        ) : null}
        <Button onClick={() => void createPoint()}>创建点位</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">生成长期二维码</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">选择门诊点位</label>
            <select
              value={qrForm.pointId}
              onChange={(e) => setQrForm((prev) => ({ ...prev, pointId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
            >
              {!points.length ? (
                <option value="">请先创建点位</option>
              ) : (
                points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">选择量表</label>
            <select
              value={qrForm.scaleId}
              onChange={(e) => setQrForm((prev) => ({ ...prev, scaleId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300"
            >
              <option value="">请选择量表</option>
              {scales.map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.id} · {resolveLocalizedText(scale.title, 'zh')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => void createQr()} disabled={!qrForm.pointId || !qrForm.scaleId}>
          生成长期二维码
        </Button>
      </Card>

      {latestQrUrl ? (
        <InviteQrCard
          url={latestQrUrl}
          title="最新长期二维码"
          subtitle="张贴在门诊，患者扫码即可进入固定量表填写。"
        />
      ) : null}

      {status ? <div className="text-sm text-slate-500">{status}</div> : null}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">二维码列表</h2>
        <div className="mt-4 space-y-3">
          {qrItems.length ? (
            qrItems.map((qr) => (
              <ClinicQrListCard
                key={qr.id}
                pointName={qr.point.name}
                scaleLabel={qr.scale?.id || qr.scaleId}
                createdAt={qr.createdAt}
                isActive={qr.isActive}
                screeningCount={qr._count?.screenings || 0}
                url={qr.publicUrl}
                onToggle={() => toggleQr(qr.id, qr.isActive)}
              />
            ))
          ) : (
            <div className="text-sm text-slate-400">还没有生成长期二维码</div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">门诊记录池</h2>
        <div className="mt-4 space-y-3">
          {screenings.map((screening) => (
            <div key={screening.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="font-semibold text-slate-900">
                {screening.respondentName} · {screening.qr.scaleId}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                编号：{screening.screeningCode} · 点位：{screening.point.name} · 状态：{screening.status}
              </div>
              <div className="mt-1 text-sm text-slate-600">结论：{screening.result.conclusion}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
