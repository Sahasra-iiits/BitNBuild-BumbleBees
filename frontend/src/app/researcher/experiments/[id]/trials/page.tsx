import { redirect } from 'next/navigation';

// Trials are created and configured in the builder.
export default async function TrialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/researcher/experiments/${id}/builder`);
}
