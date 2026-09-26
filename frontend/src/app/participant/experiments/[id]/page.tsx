import { redirect } from 'next/navigation';

// The run page shows the experiment information, eligibility and consent.
export default async function ExperimentInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/participant/experiments/${id}/run`);
}
