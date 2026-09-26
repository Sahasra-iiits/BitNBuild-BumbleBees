"use client";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExperimentHeader } from '@/components/researcher/ExperimentHeader';

export default function LogicPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="max-w-3xl mx-auto">
      <ExperimentHeader id={id} />
      <div className="bg-white border rounded-xl p-6 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold">Conditional branching is not available yet</h2>
        <p>Every participant sees every trial. Trials run in the order defined in the builder, or in a per-participant random order if you enable randomization there (trials marked “keep position” stay fixed).</p>
        <p>To compare conditions, give trials a condition label in the builder; results and exports are grouped by it.</p>
        <Link href={`/researcher/experiments/${id}/builder`} className="inline-block text-blue-700 hover:underline">
          Open the builder
        </Link>
      </div>
    </div>
  );
}
