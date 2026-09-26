import { redirect } from 'next/navigation';

export default async function ExperimentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/participant/experiments/${id}/run`);
}
