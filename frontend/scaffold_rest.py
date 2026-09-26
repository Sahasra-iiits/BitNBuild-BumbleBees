import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')

BASE = 'e:/BitNBuild/frontend/src/app'

def create_page(route, title, role="public"):
    content = f"""
import Link from 'next/link';

export default function {title.replace(' ', '').replace('-', '')}Page() {{
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-slate-600 mb-8">This page is currently under construction.</p>
      <Link href="/" className="text-blue-600 hover:underline">&larr; Back to Home</Link>
    </div>
  );
}}
"""
    write_file(f'{BASE}/{route}/page.tsx', content)

# Public
create_page('experiments', 'Public Experiments')
create_page('experiments/[id]', 'Experiment Details')
create_page('how-it-works', 'How It Works')
create_page('forgot-password', 'Forgot Password')
create_page('privacy', 'Privacy Policy')
create_page('terms', 'Terms of Service')

# Researcher 
create_page('researcher', 'Researcher Home')
create_page('researcher/experiments/new', 'Create New Experiment')
create_page('researcher/experiments/[id]', 'Experiment Dashboard')
create_page('researcher/experiments/[id]/trials', 'Trial Configuration')
create_page('researcher/experiments/[id]/logic', 'Logic Builder')
create_page('researcher/experiments/[id]/randomization', 'Randomization Config')
create_page('researcher/experiments/[id]/participants', 'Participant Access')
create_page('researcher/experiments/[id]/quality', 'Quality Rules')
create_page('researcher/experiments/[id]/preview', 'Experiment Preview')
create_page('researcher/experiments/[id]/publish', 'Publish Experiment')
create_page('researcher/experiments/[id]/results', 'Research Results')
create_page('researcher/experiments/[id]/data', 'Raw Data')
create_page('researcher/experiments/[id]/exports', 'Data Exports')
create_page('researcher/profile', 'Researcher Profile')
create_page('researcher/settings', 'Researcher Settings')

# Participant
create_page('participant', 'Participant Dashboard')
create_page('participant/experiments', 'Available Experiments')
create_page('participant/experiments/[id]', 'Experiment Info')
create_page('participant/experiments/[id]/consent', 'Informed Consent')
create_page('participant/my-experiments', 'My Experiments')
create_page('participant/rating', 'My Rating')
create_page('participant/history', 'Experiment History')
create_page('participant/achievements', 'Achievements')
create_page('participant/profile', 'Participant Profile')
create_page('participant/settings', 'Participant Settings')

print("All missing pages scaffolded successfully!")
