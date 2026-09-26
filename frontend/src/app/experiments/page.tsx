import { redirect } from 'next/navigation';

// Experiments are browsed from the participant area (sign-in required).
export default function PublicExperimentsPage() {
  redirect('/participant/experiments');
}
