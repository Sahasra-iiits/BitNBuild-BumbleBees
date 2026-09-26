import { redirect } from 'next/navigation';

// Trial-order randomization is configured in the builder's experiment settings.
export default async function RandomizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/researcher/experiments/${id}/builder`);
}
