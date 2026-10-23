import React, { useState, useEffect, useCallback } from 'react';
import { Device, Deployment, FrigateConfig, NavTab } from './types';
import {
  fetchDevices,
  fetchDeployments,
  fetchFrigate,
  createDevice,
  updateDevice,
  deleteDevice,
  checkDevice,
  checkAllDevices,
  scanSubnet,
} from './lib/api';
import { Sidebar } from './components/Sidebar';
import { Overview } from './pages/Overview';
import { Devices } from './pages/Devices';
import { Deployments } from './pages/Deployments';
import { Frigate } from './pages/Frigate';
import { SshPortal } from './pages/SshPortal';
import { DeviceModal } from './components/DeviceModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Core state
  const [devices, setDevices] = useState<Device[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [frigateConfig, setFrigateConfig] = useState<FrigateConfig>({
    url: 'https://localhost:8971/',
    status: 'unknown',
  });

  const [loading, setLoading] = useState(true);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isScanningSubnet, setIsScanningSubnet] = useState(false);

  // SSH state
  const [sshTargetDeviceId, setSshTargetDeviceId] = useState<string | undefined>(undefined);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Load all initial data
  const loadData = useCallback(async () => {
    try {
      const [devs, deps, frig] = await Promise.all([
        fetchDevices().catch(() => []),
        fetchDeployments().catch(() => []),
        fetchFrigate().catch(() => ({ url: 'https://localhost:8971/', status: 'unknown' as const })),
      ]);
      setDevices(devs);
      setDeployments(deps);
      setFrigateConfig(frig);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto-refresh devices periodically (every 25 seconds)
    const interval = setInterval(() => {
      fetchDevices().then(setDevices).catch(() => {});
      fetchDeployments().then(setDeployments).catch(() => {});
    }, 25000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Handlers for Device actions
  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const handleOpenEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  };

  const handleOpenSsh = (deviceId: string) => {
    setSshTargetDeviceId(deviceId);
    setActiveTab('ssh');
  };

  const handleSaveDevice = async (deviceData: Partial<Device>) => {
    if (editingDevice) {
      const updated = await updateDevice(editingDevice.id, deviceData);
      setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } else {
      const created = await createDevice(deviceData);
      setDevices((prev) => [...prev, created]);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this device from Reboot?')) {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleCheckDevice = async (id: string) => {
    const updated = await checkDevice(id);
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleCheckAll = async () => {
    try {
      setIsCheckingAll(true);
      const updatedList = await checkAllDevices();
      setDevices(updatedList);
    } finally {
      setIsCheckingAll(false);
    }
  };

  const handleScanSubnet = async () => {
    try {
      setIsScanningSubnet(true);
      await scanSubnet();
      await loadData();
    } catch (err: any) {
      alert(`Subnet scan failed: ${err.message}`);
    } finally {
      setIsScanningSubnet(false);
    }
  };

  const onlineCount = devices.filter((d) => d.status === 'online').length;

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col md:flex-row">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onlineCount={onlineCount}
        totalCount={devices.length}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh] text-text-muted text-sm font-mono">
            Loading Reboot environment...
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <Overview
                devices={devices}
                deployments={deployments}
                frigateConfig={frigateConfig}
                onNavigate={setActiveTab}
                onCheckDevice={handleCheckDevice}
                onOpenAddDevice={handleOpenAddDevice}
                onScanSubnet={handleScanSubnet}
                isScanning={isScanningSubnet}
              />
            )}

            {activeTab === 'devices' && (
              <Devices
                devices={devices}
                onOpenAddModal={handleOpenAddDevice}
                onOpenEditModal={handleOpenEditDevice}
                onDeleteDevice={handleDeleteDevice}
                onCheckDevice={handleCheckDevice}
                onCheckAllDevices={handleCheckAll}
                isCheckingAll={isCheckingAll}
                onOpenSsh={handleOpenSsh}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'ssh' && (
              <SshPortal
                devices={devices}
                initialDeviceId={sshTargetDeviceId}
                onEditDevice={handleOpenEditDevice}
              />
            )}

            {activeTab === 'deployments' && (
              <Deployments
                devices={devices}
                deployments={deployments}
                onRefreshDeployments={loadData}
              />
            )}

            {activeTab === 'frigate' && (
              <Frigate
                config={frigateConfig}
                onConfigUpdated={setFrigateConfig}
              />
            )}
          </>
        )}
      </main>

      {/* Device Add/Edit Modal */}
      <DeviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDevice}
        initialDevice={editingDevice}
      />
    </div>
  );
};

export default App;
