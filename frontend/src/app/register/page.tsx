"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiRequestError } from '@/lib/api/client';
import { homeForRole, useAuth } from '@/lib/context/AuthContext';

type Role = 'RESEARCHER' | 'PARTICIPANT';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState<Role>('RESEARCHER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [age, setAge] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (role === 'RESEARCHER' && !institution) return;
    if (role === 'PARTICIPANT' && !age) return;

    setIsLoading(true);
    setError(null);

    try {
      // Registering through the auth context signs the user in for the whole app.
      const user = await register({
        email,
        password,
        role,
        ...(role === 'RESEARCHER' ? { researcherProfile: { institution } } : {}),
        ...(role === 'PARTICIPANT' ? { participantProfile: { age: parseInt(age, 10) } } : {}),
      });
      router.push(homeForRole(user.role));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'CONFLICT' || err.statusCode === 409) {
          setError('An account with this email already exists. Try logging in instead.');
        } else if (err.code === 'VALIDATION_ERROR') {
          setError(err.message || 'Please check your information and try again.');
        } else {
          setError(err.message || 'Registration failed. Please try again.');
        }
      } else {
        setError('Unable to connect to server. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="font-bold text-2xl tracking-tight text-slate-900 mb-1">CogniScale</div>
          <h1 className="text-lg font-semibold text-slate-700 mt-3">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Join the research platform.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">I am a...</label>
            <div className="flex gap-3">
              {(['RESEARCHER', 'PARTICIPANT'] as Role[]).map(r => (
                <label
                  key={r}
                  className={`flex items-center gap-2 border-2 p-3 rounded-lg flex-1 cursor-pointer transition-all ${role === r ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-semibold capitalize">{r.toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">Email address</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="you@university.edu"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700">Password</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              minLength={8}
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
              title="Must contain at least one number and one uppercase and lowercase letter, and at least 8 or more characters"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-slate-400">At least 8 characters, including uppercase, lowercase, and a number.</p>
          </div>

          {role === 'RESEARCHER' && (
            <div className="space-y-2">
              <label htmlFor="institution" className="block text-sm font-medium text-slate-700">Institution / Organization</label>
              <input
                id="institution"
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="e.g., State University"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {role === 'PARTICIPANT' && (
            <div className="space-y-2">
              <label htmlFor="age" className="block text-sm font-medium text-slate-700">Age</label>
              <input
                id="age"
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={e => setAge(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="Your age"
                required
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Log in</Link>
        </div>
        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
