
import React from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { toggle3DMode } from '../../store/uiSlice';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { Box, Typography, IconButton, Tooltip, SpeedDial, SpeedDialIcon, SpeedDialAction } from '@mui/material';
import { ZoomIn, ZoomOut, CenterFocusStrong, Fullscreen, ViewInAr, ThreeDRotation, Search, Settings, Info } from '@mui/icons-material';

const actions = [
  { icon: <Search />, name: 'Search' },
  { icon: <Settings />, name: 'Settings' },
  { icon: <Info />, name: 'Info' },
];

const HUD: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isMobile } = useResponsiveLayout();
  const { fps, memory, gpu } = useAppSelector(state => state.performance);
  const { is3DMode } = useAppSelector(state => state.ui);

  const handleToggle3DMode = () => {
    dispatch(toggle3DMode());
  };

  if (isMobile) {
    return (
      <SpeedDial
        ariaLabel="SpeedDial basic example"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
          />
        ))}
      </SpeedDial>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 1000,
      }}
    >
      <Box
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: 2,
          borderRadius: 1,
        }}
      >
        <Typography variant="h6">Performance</Typography>
        <Typography>FPS: {fps}</Typography>
        <Typography>Memory: {memory}%</Typography>
        <Typography>GPU: {gpu}</Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 1,
          borderRadius: 1,
        }}
      >
        <Tooltip title="Zoom In">
          <IconButton sx={{ color: 'white' }}><ZoomIn /></IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out">
          <IconButton sx={{ color: 'white' }}><ZoomOut /></IconButton>
        </Tooltip>
        <Tooltip title="Center View">
          <IconButton sx={{ color: 'white' }}><CenterFocusStrong /></IconButton>
        </Tooltip>
        <Tooltip title="Fullscreen">
          <IconButton sx={{ color: 'white' }}><Fullscreen /></IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 1,
          borderRadius: 1,
        }}
      >
        <Tooltip title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}>
          <IconButton sx={{ color: 'white' }} onClick={handleToggle3DMode}>
            {is3DMode ? <ViewInAr /> : <ThreeDRotation />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default HUD;
