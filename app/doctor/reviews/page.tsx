'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DoctorReviewItem = {
  id: string;
  status: string;
  reviewConclusion: string | null;
  reviewNotes: string | null;
  allowParentVisible: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  member: {
    id: string;
    nickname: string;
    realName: string | null;
    contactPhone: string | null;
    gender: string;
    ageMonths: number | null;
  } | null;
  assessment: {
    id: string;
    scaleId: string;
    scaleTitle: string;
    totalScore: number;
    conclusion: string;
    createdAt: string;
  } | null;
};

function reviewBadgeVariant(status: string) {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'REJECTED') return 'destructive' as const;
  if (status === 'NEEDS_MORE_INFO') return 'warning' as const;
  return 'info' as const;
}

export default function DoctorReviewsPage() {
  const { authHeaders } = useAuthSession();
  const [reviews, setReviews] = useState<DoctorReviewItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [pageStatus, setPageStatus] = useState('');
  const [submittingId, setSubmittingId] = useState('');
  const [notesByReview, setNotesByReview] = useState<Record<string, string>>({});

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/doctor/reviews?status=${statusFilter}`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      setReviews(data.reviews || []);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : '加载待复核列表失败');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, statusFilter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const completeDoctorReview = async (
    reviewId: string,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    const reviewNotes = notesByReview[reviewId] || '';
    if (status === 'REJECTED' && !reviewNotes.trim()) {
      setPageStatus('拒绝复核必须填写备注');
      return;
    }

    setSubmittingId(reviewId);
    setPageStatus('');
    try {
      const response = await fetch(`/api/doctor/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          status,
          reviewConclusion: status === 'APPROVED' ? '同意本次量表结果' : undefined,
          reviewNotes,
          allowParentVisible: status === 'APPROVED',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '复核失败');
      }

      setPageStatus(status === 'APPROVED' ? '已复核通过' : '已拒绝并记录备注');
      setNotesByReview((prev) => ({ ...prev, [reviewId]: '' }));
      await loadReviews();
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : '复核失败');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="待复核"
        description="查看已完成且需要医生复核的儿童量表结果，并记录医生决策。"
        actions={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            <option value="PENDING">待处理</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已拒绝</option>
            <option value="ALL">全部</option>
          </select>
        }
      />

      {pageStatus ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {pageStatus}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      ) : reviews.length ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-2xl bg-cyan-50 p-2 text-cyan-700">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {review.member?.realName || review.member?.nickname || '未命名儿童'}
                    </h2>
                    <Badge variant={reviewBadgeVariant(review.status)}>{review.status}</Badge>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">
                    {review.assessment?.scaleId} · {review.assessment?.scaleTitle}
                    {review.assessment ? ` · 总分 ${review.assessment.totalScore}` : ''}
                  </div>
                  <div className="mt-1 text-sm leading-7 text-slate-600">
                    {review.assessment?.conclusion || '暂无结论'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    提交时间：{review.assessment ? new Date(review.assessment.createdAt).toLocaleString() : '-'}
                  </div>
                  {review.member ? (
                    <Link
                      href={`/doctor/patients/${review.member.id}`}
                      className="mt-3 inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      查看患者时间线
                    </Link>
                  ) : null}
                </div>

                {['PENDING', 'IN_REVIEW', 'NEEDS_MORE_INFO'].includes(review.status) ? (
                  <div className="w-full space-y-3 lg:max-w-md">
                    <textarea
                      value={notesByReview[review.id] || ''}
                      onChange={(event) =>
                        setNotesByReview((prev) => ({
                          ...prev,
                          [review.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="复核备注；拒绝时必填"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void completeDoctorReview(review.id, 'APPROVED')}
                        disabled={submittingId === review.id}
                      >
                        {submittingId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>通过并允许家长查看</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void completeDoctorReview(review.id, 'REJECTED')}
                        disabled={submittingId === review.id}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>拒绝</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:max-w-sm">
                    {review.reviewNotes || review.reviewConclusion || '已完成复核'}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-500">
          当前没有符合筛选条件的复核项。
        </Card>
      )}
    </div>
  );
}
