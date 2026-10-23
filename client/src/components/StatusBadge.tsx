import React from 'react';
import { DeploymentStatus } from '../types';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'unknown' | DeploymentStatus;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', pulse }) => {
  const isOnline = status === 'online';
  const isOffline = status === 'offline';
  const isRunning = status === 'running';
  const isSuccessful = status === 'successful';
  const isFailed = status === 'failed';
  const isStopped = status === 'stopped';
  const isQueued = status === 'queued';

  let dotColor = 'bg-slate-400';
  let badgeBg = 'bg-slate-800/60 text-slate-300 border-slate-700/60';
  let label = status.charAt(0).toUpperCase() + status.slice(1);

  if (isOnline || isSuccessful) {
    dotColor = 'bg-emerald-400';
    badgeBg = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
    label = isOnline ? 'Online' : 'Successful';
  } else if (isOffline || isFailed) {
    dotColor = 'bg-rose-400';
    badgeBg = 'bg-rose-950/40 text-rose-300 border-rose-800/50';
    label = isOffline ? 'Offline' : 'Failed';
  } else if (isRunning) {
    dotColor = 'bg-blue-400';
    badgeBg = 'bg-blue-950/40 text-blue-300 border-blue-800/50';
    label = 'Running';
  } else if (isQueued) {
    dotColor = 'bg-amber-400';
    badgeBg = 'bg-amber-950/40 text-amber-300 border-amber-800/50';
    label = 'Queued';
  } else if (isStopped) {
    dotColor = 'bg-zinc-400';
    badgeBg = 'bg-zinc-900/60 text-zinc-300 border-zinc-700/50';
    label = 'Stopped';
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${paddingClass} ${badgeBg} transition-colors`}
    >
      <span className="relative flex h-2 w-2">
        {(pulse || isRunning) && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      <span>{label}</span>
    </span>
  );
};
