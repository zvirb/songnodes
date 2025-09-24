import React from 'react';
import classNames from 'classnames';
import { useAppSelector, useAppDispatch } from '@store/index';
import { useResponsiveLayout } from '../Layout/ResponsiveLayoutProvider';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  badge?: number;
  active?: boolean;
}

export const BottomNavigation: React.FC = () => {
  const dispatch = useAppDispatch();
  const { deviceType, toggleLeftPanel, toggleRightPanel, toggleBottomSheet, toggleSettings } = useResponsiveLayout();
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);

  // Only show on mobile and tablet in portrait
  if (deviceType === 'desktop') return null;

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      action: toggleLeftPanel,
      badge: nodes.length,
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      action: toggleBottomSheet,
    },
    {
      id: 'route',
      label: 'Route',
      icon: '🗺️',
      action: () => {
        toggleRightPanel();
      },
      badge: selectedNodes.length || undefined,
      active: selectedNodes.length > 0,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      action: toggleSettings,
    },
    {
      id: 'data',
      label: 'Data',
      icon: '💾',
      action: () => {
        toggleBottomSheet();
      },
    },
  ];

  return (
    <nav
      className={classNames(
        'fixed bottom-0 left-0 right-0 z-[1000]',
        'bg-gray-900 border-t border-gray-700',
        'flex items-center justify-around',
        'h-16 px-2',
        'safe-area-bottom', // iOS safe area support
        'md:hidden' // Hide on desktop
      )}
      role="navigation"
      aria-label="Bottom navigation"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={item.action}
          className={classNames(
            'relative flex flex-col items-center justify-center',
            'w-full h-full',
            'text-xs font-medium',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
            item.active
              ? 'text-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          )}
          aria-label={item.label}
        >
          <span className="text-lg mb-1">{item.icon}</span>
          <span>{item.label}</span>
          {item.badge && (
            <span className={classNames(
              'absolute -top-1 -right-1',
              'min-w-[18px] h-[18px]',
              'flex items-center justify-center',
              'bg-blue-600 text-white',
              'text-[10px] font-bold',
              'rounded-full px-1'
            )}>
              {item.badge > 999 ? '999+' : item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
};