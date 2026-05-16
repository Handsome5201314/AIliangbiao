'use client';

import dynamic from 'next/dynamic';

const NeonateWardManager = dynamic(
  () => import('@/components/doctor/NeonateWardManager'),
  { ssr: false }
);

export default function DoctorNeonatesPage() {
  return <NeonateWardManager />;
}
