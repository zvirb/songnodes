import React from 'react';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import SideNavigation from '../Navigation/SideNavigation';
import TopNavigation from '../Navigation/TopNavigation';
import { Box } from '@mui/material';

const UnifiedHeader: React.FC = () => {
  const { isMobile, isTablet, isDesktop } = useResponsiveLayout();

  if (isMobile) {
    return null;
  }

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: isDesktop ? '64px' : '100%',
        width: isTablet ? '80px' : '100%',
        backgroundColor: 'background.paper',
        borderBottom: isDesktop ? 1 : 0,
        borderRight: isTablet ? 1 : 0,
        borderColor: 'divider',
      }}
    >
      {isTablet && <SideNavigation />}
      {isDesktop && <TopNavigation />}
    </Box>
  );
};

export default UnifiedHeader;
