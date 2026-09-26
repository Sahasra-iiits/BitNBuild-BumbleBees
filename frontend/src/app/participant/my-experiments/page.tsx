import { redirect } from 'next/navigation';

export default function MyExperimentsPage() {
  redirect('/participant/history');
}
