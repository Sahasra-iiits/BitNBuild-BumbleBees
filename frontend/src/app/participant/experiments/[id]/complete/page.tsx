import { redirect } from 'next/navigation';

// Completion results (reward and rating changes) are shown on the run page when a
// session finishes; afterwards they are listed in the participant history.
export default function CompletePage() {
  redirect('/participant/history');
}
