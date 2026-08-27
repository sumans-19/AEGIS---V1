import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import MasterHeader from '../components/dashboard/MasterHeader';
import MasterSidebar from '../components/dashboard/MasterSidebar';
import HomeOverview from '../components/dashboard/HomeOverview';
import DroneInspectionView from '../components/dashboard/DroneInspectionView';
import Mission from './Mission';
import AIDashboard from './AIDashboard';
import Disasters from './Disasters';
import CoordinationPanel from '../components/mission/CoordinationPanel';
import SettingsView from '../components/dashboard/SettingsView';
import { useSimStore } from '../store/useSimStore';

export default function MasterDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab from path or query param
  const getInitialTab = () => {
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    if (location.pathname === '/mission') return 'mission';
    if (location.pathname === '/ai-dashboard') return 'ai-decisions';
    if (location.pathname === '/disasters') return 'disasters';
    if (location.pathname === '/drone-inspection') return 'drone-3d';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && location.pathname === '/mission' && activeTab !== 'mission') {
      setActiveTab('mission');
    } else if (!tabParam && location.pathname === '/ai-dashboard' && activeTab !== 'ai-decisions') {
      setActiveTab('ai-decisions');
    }
  }, [searchParams, location.pathname]);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', newTab);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="app-container" style={{
      width: '100vw',
      height: '100vh',
      background: '#151C1E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Outer Aerospace Workstation Display Frame */}
      <div className="app-frame" style={{
        width: '100%',
        height: '100%',
        background: '#DCE6E8',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        position: 'relative',
      }}>
        {/* Master Header Row */}
        <MasterHeader activeTab={activeTab} />

        {/* Main Body Row: Sidebar Rail + Workspace Area */}
        <div className="app-body" style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Left Navigation Rail */}
          <MasterSidebar activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Main Content Area */}
          <div className="app-main-content" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#DCE6E8',
            overflow: 'hidden',
            minWidth: 0,
            position: 'relative',
          }}>
            {activeTab === 'overview' && (
              <HomeOverview onNavigate={handleTabChange} />
            )}

            {activeTab === 'drone-3d' && (
              <DroneInspectionView />
            )}

            {activeTab === 'mission' && (
              <Mission isEmbedded onClose={() => handleTabChange('overview')} />
            )}

            {activeTab === 'ai-decisions' && (
              <AIDashboard isEmbedded />
            )}

            {activeTab === 'swarm' && (
              <CoordinationPanel onClose={() => handleTabChange('overview')} />
            )}

            {activeTab === 'disasters' && (
              <Disasters isEmbedded onSelectScenario={() => handleTabChange('mission')} />
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
