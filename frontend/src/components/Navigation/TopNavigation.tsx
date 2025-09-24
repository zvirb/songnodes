
import React from 'react';
import { styled } from '@mui/material/styles';
import { Box, Button, Menu, MenuItem } from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const TopNavContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  height: '100%',
  padding: theme.spacing(0, 2),
}));

const NavSection = styled(Box)(({ theme }) => ({
  margin: theme.spacing(0, 2),
}));

const NavMenuButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.primary,
}));

interface NavSectionProps {
  label: string;
  children: React.ReactNode;
}

const TopNavSection: React.FC<NavSectionProps> = ({ label, children }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <NavSection>
      <NavMenuButton
        endIcon={<KeyboardArrowDown />}
        onClick={handleClick}
        aria-label={label}
      >
        {label}
      </NavMenuButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {children}
      </Menu>
    </NavSection>
  );
};

const TopNavigation: React.FC = () => {
  const navigate = useNavigate();

  return (
    <TopNavContainer role="navigation">
      <TopNavSection label="View">
        <MenuItem onClick={() => { navigate('/2d-graph'); }}>2D Graph</MenuItem>
        <MenuItem onClick={() => { navigate('/3d-space'); }}>3D Space</MenuItem>
      </TopNavSection>
      <TopNavSection label="Tools">
        <MenuItem onClick={() => { navigate('/search'); }}>Search</MenuItem>
        <MenuItem onClick={() => { navigate('/route-builder'); }}>Route Builder</MenuItem>
        <MenuItem onClick={() => { navigate('/analytics'); }}>Analytics</MenuItem>
      </TopNavSection>
    </TopNavContainer>
  );
};
export default TopNavigation;
