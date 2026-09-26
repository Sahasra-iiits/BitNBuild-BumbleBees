"use client";
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ValidationIssue } from '@/shared/experiment';

const STYLE = {
  error: { icon: AlertCircle, cls: 'text-red-700 bg-red-50 border-red-200', label: 'Error' },
  warning: { icon: AlertTriangle, cls: 'text-amber-800 bg-amber-50 border-amber-200', label: 'Warning' },
  info: { icon: Info, cls: 'text-slate-700 bg-slate-50 border-slate-200', label: 'Info' },
} as const;

export function IssueList({ issues, onSelect, empty = 'No problems found.' }: { issues: ValidationIssue[]; onSelect?: (issue: ValidationIssue) => void; empty?: string }) {
  if (issues.length === 0) return <p className="text-sm text-emerald-700">{empty}</p>;
  const ordered = [...issues].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.severity) - ['error', 'warning', 'info'].indexOf(b.severity));
  return (
    <ul className="space-y-1.5">
      {ordered.map((issue, i) => {
        const s = STYLE[issue.severity];
        const Icon = s.icon;
        const content = (
          <>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="sr-only">{s.label}: </span>
              {issue.message}
            </span>
          </>
        );
        return (
          <li key={`${issue.code}-${issue.trialId ?? ''}-${issue.elementId ?? ''}-${i}`}>
            {onSelect && issue.trialId ? (
              <button type="button" onClick={() => onSelect(issue)} className={`w-full text-left flex gap-2 text-xs border rounded-md px-2.5 py-1.5 hover:brightness-95 ${s.cls}`}>
                {content}
              </button>
            ) : (
              <div className={`flex gap-2 text-xs border rounded-md px-2.5 py-1.5 ${s.cls}`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
