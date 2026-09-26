import { redirect } from 'next/navigation';

// Consent is collected on the run page before the session starts.
export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/participant/experiments/${id}/run`);
}
