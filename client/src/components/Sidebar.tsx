import React from 'react';
import {
  LayoutDashboard,
  Server,
  Rocket,
  Camera,
  Cpu,
  RefreshCw,
  Menu,
  X,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onlineCount: number;
  totalCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onlineCount,
  totalCount,
  mobileOpen,
  setMobileOpen,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'devices' as NavTab, label: 'Devices', icon: Server, badge: `${onlineCount}/${totalCount}` },
    { id: 'ssh' as NavTab, label: 'SSH Console', icon: Terminal },
    { id: 'deployments' as NavTab, label: 'Deployments', icon: Rocket },
    { id: 'frigate' as NavTab, label: 'Frigate', icon: Camera },
  ];

  const handleSelect = (tab: NavTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-canvas-subtle border-b border-border-subtle sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light">
            <RefreshCw className="w-4 h-4 text-accent-light" />
          </div>
          <div>
            <div className="font-semibold text-sm text-text-primary tracking-tight">Reboot</div>
            <div className="text-[10px] text-text-muted">Old hardware. New purpose.</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-canvas-card"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-40 w-64 bg-canvas-subtle border-r border-border-subtle flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Logo & Branding */}
        <div>
          <div className="p-5 border-b border-border-subtle/70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-light shadow-inner">
                <RefreshCw className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  Reboot
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent-light border border-accent/30">
                    MVP
                  </span>
                </div>
                <div className="text-xs text-text-muted font-normal">Old hardware. New purpose.</div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-canvas-card text-white border border-border shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-canvas-card/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-accent-light' : 'text-text-muted'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-accent/20 text-accent-light border border-accent/30'
                          : 'bg-canvas-card text-text-muted border border-border-subtle'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-border-subtle/70 space-y-3">
          <div className="p-3 rounded-xl bg-canvas-card/60 border border-border-subtle">
            <div className="flex items-center gap-2 text-[11px] text-text-secondary mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-text-primary">Local Environment</span>
            </div>
            <p className="text-[11px] text-text-muted leading-tight">
              State stored in-memory. Zero cloud dependency.
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-faint px-1">
            <span>Self-hosted · Local-first</span>
            <span className="font-mono text-[10px]">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
