
import React from 'react';
import { styled } from '@mui/material/styles';
import { Box, Tooltip, IconButton } from '@mui/material';
import { BarChart, Search, Settings, AccountTree } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SideNavContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  height: '100%',
  width: '80px',
  backgroundColor: theme.palette.background.paper,
  borderRight: `1px solid ${theme.palette.divider}`,
  paddingTop: theme.spacing(2),
}));

const NavItem = styled(IconButton)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: theme.spacing(1.5, 0),
  borderRadius: 0,
  '& .MuiSvgIcon-root': {
    fontSize: '2rem',
  },
  '& .MuiTypography-root': {
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
}));

interface NavItemProps {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
}

const SideNavItem: React.FC<NavItemProps> = ({ icon, label, onClick }) => (
  <Tooltip title={label} placement="right">
    <NavItem onClick={onClick} aria-label={label}>
      {icon}
    </NavItem>
  </Tooltip>
);

const SideNavigation: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SideNavContainer role="navigation">
      <SideNavItem icon={<AccountTree />} label="Graph" onClick={() => navigate('/graph')} />
      <SideNavItem icon={<Search />} label="Search" onClick={() => navigate('/search')} />
      <SideNavItem icon={<BarChart />} label="Analytics" onClick={() => navigate('/analytics')} />
      <SideNavItem icon={<Settings />} label="Settings" onClick={() => navigate('/settings')} />
    </SideNavContainer>
  );
};

export default SideNavigation;
