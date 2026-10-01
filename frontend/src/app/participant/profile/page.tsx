"use client";
import { useAuth } from '@/lib/context/AuthContext';
import { Mail, Calendar, GraduationCap, PersonStanding } from 'lucide-react';

export default function ParticipantProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const profile = user?.participantProfile;

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Your Profile</h1>
      
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {user?.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Participant Info</h2>
            <div className="text-sm text-slate-500 font-mono mt-1">ID: {profile?.pseudonymousId || user?.id}</div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-700">Email Address</div>
                <div className="text-slate-600">{user?.email}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-700">Age</div>
                <div className="text-slate-600">{profile?.age != null ? `${profile.age} years old` : 'Not provided'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <PersonStanding className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-700">Gender</div>
                <div className="text-slate-600 capitalize">{profile?.gender || 'Not specified'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-700">Education Level</div>
                <div className="text-slate-600 capitalize">{profile?.educationLevel || 'Not specified'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
