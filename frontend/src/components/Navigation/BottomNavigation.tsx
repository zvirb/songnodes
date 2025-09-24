import React from 'react';

// Placeholder icons - will be replaced with actual icons later
const GraphIcon = () => <span>📊</span>;
const SearchIcon = () => <span>🔍</span>;
const RouteIcon = () => <span>🗺️</span>;
const SettingsIcon = () => <span>⚙️</span>;

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.5rem 0',
      background: 'none',
      border: 'none',
      color: isActive ? '#3b82f6' : '#9ca3af',
      transition: 'color 0.2s ease-in-out',
    }}
  >
    {icon}
    <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{label}</span>
  </button>
);

interface BottomNavigationProps {
  onSettingsClick: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ onSettingsClick }) => {
  // This state would typically come from a router or global state (Redux)
  const [activeView, setActiveView] = React.useState('graph');

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '5rem',
        backgroundColor: '#1e293b',
        borderTop: '1px solid #374151',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        zIndex: 1000,
      }}
    >
      <NavItem icon={<GraphIcon />} label="Graph" isActive={activeView === 'graph'} onClick={() => setActiveView('graph')} />
      <NavItem icon={<SearchIcon />} label="Search" isActive={activeView === 'search'} onClick={() => setActiveView('search')} />
      <NavItem icon={<RouteIcon />} label="Route" isActive={activeView === 'route'} onClick={() => setActiveView('route')} />
      <NavItem icon={<SettingsIcon />} label="Settings" isActive={activeView === 'settings'} onClick={onSettingsClick} />
    </div>
  );
};
