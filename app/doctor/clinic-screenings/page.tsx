'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSearch, MapPin, PlusCircle, QrCode } from 'lucide-react';

import ClinicQrListCard from '@/components/ClinicQrListCard';
import InviteQrCard from '@/components/InviteQrCard';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

export default function DoctorClinicScreeningsPage() {
  const { authHeaders, user } = useAuthSession();
  const [screenings, setScreenings] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [qrs, setQrs] = useState<any[]>([]);
  const [scales, setScales] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [pageStatus, setPageStatus] = useState('');
  const [pointForm, setPointForm] = useState({
    name: '',
    locationLabel: '',
  });
  const [showAdvancedPoint, setShowAdvancedPoint] = useState(false);
  const [departmentLabel, setDepartmentLabel] = useState('');
  const [qrForm, setQrForm] = useState({
    pointId: '',
    scaleId: '',
  });

  const loadAll = async () => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('respondentName', query.trim());
      params.set('screeningCode', query.trim());
    }
    if (status !== 'ALL') {
      params.set('status', status);
    }

    const [screeningsRes, pointsRes, qrsRes, scalesRes] = await Promise.all([
      fetch(`/api/doctor/clinic-screenings?${params.toString()}`, { headers: authHeaders }),
      fetch('/api/doctor/clinic-points', { headers: authHeaders }),
      fetch('/api/doctor/clinic-qrs', { headers: authHeaders }),
      fetch('/api/scales'),
    ]);

    const [screeningsData, pointsData, qrsData, scalesData] = await Promise.all([
      screeningsRes.json().catch(() => ({})),
      pointsRes.json().catch(() => ({})),
      qrsRes.json().catch(() => ({})),
      scalesRes.json().catch(() => ({})),
    ]);

    setScreenings(screeningsData.screenings || []);
    setPoints(pointsData.points || []);
    setQrs(qrsData.qrs || []);
    setScales(scalesData.scales || []);

    if (!qrForm.pointId && pointsData.points?.length) {
      setQrForm((prev) => ({ ...prev, pointId: pointsData.points[0].id }));
    }
    if (!qrForm.scaleId && scalesData.scales?.length) {
      setQrForm((prev) => ({ ...prev, scaleId: scalesData.scales[0].id }));
    }
  };

  useEffect(() => {
    setDepartmentLabel(user?.doctorProfile?.departmentName || '');
  }, [user?.doctorProfile?.departmentName]);

  useEffect(() => {
    void loadAll();
  }, [authHeaders, query, status]);

  const statusOptions = useMemo(() => ['ALL', 'SUBMITTED', 'CLAIMED'], []);

  const qrItems = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return qrs.map((qr) => ({
      ...qr,
      publicUrl: `${window.location.origin}/clinic/qr/${qr.slug}`,
    }));
  }, [qrs]);

  const latestQrUrl = qrItems[0]?.publicUrl || '';

  const createPoint = async () => {
    setPageStatus('');
    const response = await fetch('/api/doctor/clinic-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        name: pointForm.name,
        locationLabel: pointForm.locationLabel || undefined,
        departmentLabel: showAdvancedPoint ? departmentLabel || undefined : undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPageStatus(data.error || '创建点位失败');
      return;
    }

    setPageStatus('门诊点位已创建，并已自动选中，可直接继续生成长期二维码');
    setPointForm({ name: '', locationLabel: '' });
    setPoints((prev) => [data.point, ...prev]);
    setQrForm((prev) => ({ ...prev, pointId: data.point.id }));
    await loadAll();
  };

  const createQr = async () => {
    setPageStatus('');
    const response = await fetch('/api/doctor/clinic-qrs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(qrForm),
    });
    const data = await response.json().catch(() => ({}));
    setPageStatus(response.ok ? '长期二维码已生成，下面会显示最新二维码' : data.error || '生成二维码失败');
    await loadAll();
  };

  const toggleQr = async (id: string, isActive: boolean) => {
    const response = await fetch(`/api/doctor/clinic-qrs/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const data = await response.json().catch(() => ({}));
    setPageStatus(response.ok ? '二维码状态已更新' : data.error || '更新失败');
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="门诊筛查"
        description="先创建一个门诊点位，再为该点位生成固定量表二维码，最后查看扫码结果。"
      />

      <Card className="p-6">
        <div className="flex items-center gap-2 text-slate-900">
          <MapPin className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold">创建门诊点位</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          只需要先填写“点位名称”。例如：`儿科 2 号诊室`、`儿科门诊护士台`。点位编码会自动生成。
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">点位名称</label>
            <Input
              value={pointForm.name}
              onChange={(e) => setPointForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：儿科 2 号诊室"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">位置说明，可选</label>
            <Input
              value={pointForm.locationLabel}
              onChange={(e) => setPointForm((prev) => ({ ...prev, locationLabel: e.target.value }))}
              placeholder="例如：门口海报架 / 分诊台右侧"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedPoint((value) => !value)}
          className="mt-4 text-sm font-medium text-cyan-700 hover:text-cyan-800"
        >
          {showAdvancedPoint ? '收起高级设置' : '高级设置'}
        </button>

        {showAdvancedPoint ? (
          <div className="mt-4 max-w-md">
            <label className="mb-2 block text-sm font-medium text-slate-700">科室标签，可选</label>
            <Input
              value={departmentLabel}
              onChange={(e) => setDepartmentLabel(e.target.value)}
              placeholder="默认会使用你的医生科室"
            />
          </div>
        ) : null}

        <Button className="mt-4" onClick={() => void createPoint()}>
          <PlusCircle className="h-4 w-4" />
          <span>创建点位</span>
        </Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-slate-900">
          <QrCode className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold">生成长期二维码</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          先选择门诊点位，再选择量表。已有旧二维码不会被覆盖，你可以在下面的列表中重新打开和复制。
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">选择门诊点位</label>
            <select
              value={qrForm.pointId}
              onChange={(e) => setQrForm((prev) => ({ ...prev, pointId: e.target.value }))}
              disabled={!points.length}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:bg-slate-100"
            >
              {!points.length ? (
                <option value="">请先创建点位</option>
              ) : (
                <>
                  <option value="">请选择点位</option>
                  {points.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.name}
                    </option>
                  ))}
                </>
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

        <Button
          className="mt-4"
          onClick={() => void createQr()}
          disabled={!qrForm.pointId || !qrForm.scaleId}
        >
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

      {pageStatus ? <div className="text-sm text-slate-500">{pageStatus}</div> : null}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">我的二维码</h2>
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
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按姓名或筛查编号搜索"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
          >
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-3">
          {screenings.length ? (
            screenings.map((screening) => (
              <Link
                key={screening.id}
                href={`/doctor/clinic-screenings/${screening.id}`}
                className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:border-cyan-300 hover:bg-white"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {screening.respondentName} · {screening.qr.scaleId}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      编号：{screening.screeningCode} · 状态：{screening.status}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      点位：{screening.point.name} · 结论：{screening.result.conclusion}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(screening.createdAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400">
              <FileSearch className="mx-auto mb-3 h-10 w-10" />
              暂无门诊筛查记录
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
