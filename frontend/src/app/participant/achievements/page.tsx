import Link from 'next/link';

export default function AchievementsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Achievements</h1>
      <p className="text-slate-600 mb-8">This page is currently under construction.</p>
      <Link href="/" className="text-blue-600 hover:underline">&larr; Back to Home</Link>
    </div>
  );
}
