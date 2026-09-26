import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white border rounded-xl p-8 space-y-4">
        <h1 className="text-xl font-bold">Password reset is not available</h1>
        <p className="text-slate-600 text-sm">This server has no email service configured, so passwords cannot be reset by email. Please contact the platform administrator.</p>
        <Link href="/login" className="text-blue-600 hover:underline text-sm">
          Back to login
        </Link>
      </div>
    </div>
  );
}
