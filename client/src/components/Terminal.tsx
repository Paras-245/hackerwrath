import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, ArrowDown, Terminal as TerminalIcon } from 'lucide-react';
import { DeploymentLogEntry, DeploymentStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface TerminalProps {
  logs: DeploymentLogEntry[];
  status?: DeploymentStatus;
  exitCode?: number | null;
  error?: string | null;
  onStop?: () => void;
  isRunning?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  status,
  exitCode,
  error,
  onStop,
  isRunning,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Scroll to bottom when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect user manual scroll up/down
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If within 30px of bottom, keep auto-scroll on
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 35;
    setAutoScroll(isAtBottom);
  };

  const copyLogs = () => {
    const rawText = logs.map((l) => `[${l.stream.toUpperCase()}] ${l.text}`).join('');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-border-subtle bg-canvas-card overflow-hidden shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-canvas-muted/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
            <TerminalIcon className="w-3.5 h-3.5 text-text-muted" />
            <span>deployment-console.log</span>
          </div>
          {status && <StatusBadge status={status} size="sm" />}
          {exitCode !== undefined && exitCode !== null && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                exitCode === 0
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
              }`}
            >
              exit: {exitCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1 text-xs text-accent-light hover:text-white px-2 py-1 rounded bg-accent/20 border border-accent/30 transition-colors"
              title="Jump to latest output"
            >
              <ArrowDown className="w-3 h-3" />
              <span>Scroll down</span>
            </button>
          )}

          {isRunning && onStop && (
            <button
              onClick={onStop}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-950/80 text-rose-300 border border-rose-700/60 hover:bg-rose-900 transition-colors"
            >
              Stop Deployment
            </button>
          )}

          <button
            onClick={copyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-md border border-border-subtle bg-canvas hover:bg-canvas-subtle transition-colors disabled:opacity-40"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-slate-200 bg-[#090b0e] space-y-1 select-text"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <TerminalIcon className="w-8 h-8 opacity-40" />
            <p>No active deployment logs. Submit a repository and command to begin.</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const isStderr = log.stream === 'stderr';
            const isSystem = log.stream === 'system';

            let tagStyle = 'text-slate-500';
            let textStyle = 'text-slate-200';

            if (isStderr) {
              tagStyle = 'text-rose-400 font-semibold';
              textStyle = 'text-rose-300';
            } else if (isSystem) {
              tagStyle = 'text-cyan-400 font-semibold';
              textStyle = 'text-cyan-200';
            }

            return (
              <div key={idx} className="flex items-start gap-2 group hover:bg-white/[0.02] px-1 rounded">
                <span className="text-slate-600 select-none min-w-[58px] text-[10px] pt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`select-none text-[10px] min-w-[50px] uppercase ${tagStyle}`}>
                  [{log.stream}]
                </span>
                <span className={`flex-1 whitespace-pre-wrap break-all ${textStyle}`}>
                  {log.text}
                </span>
              </div>
            );
          })
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300">
            <span className="font-semibold block mb-0.5">Execution Failure:</span>
            {error}
          </div>
        )}
      </div>

      {/* Terminal Footer Bar */}
      <div className="px-4 py-1.5 bg-canvas-muted/40 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-text-muted font-mono">
        <div>
          <span>Lines: {logs.length}</span>
          <span className="mx-2">·</span>
          <span>Auto-scroll: {autoScroll ? 'Active' : 'Paused (scrolled up)'}</span>
        </div>
        <div>
          <span>Terminal sandbox: isolated / in-memory</span>
        </div>
      </div>
    </div>
  );
};
