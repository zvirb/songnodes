
import React from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { toggleHighContrast, toggleReducedMotion } from '../../store/uiSlice';
import { Box, Typography, FormControlLabel, Switch } from '@mui/material';

const AccessibilitySettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { highContrast, reducedMotion } = useAppSelector(state => state.ui.accessibility);

  const handleToggleHighContrast = () => {
    dispatch(toggleHighContrast());
  };

  const handleToggleReducedMotion = () => {
    dispatch(toggleReducedMotion());
  };

  return (
    <Box>
      <Typography variant="h6">Accessibility Settings</Typography>
      <FormControlLabel
        control={<Switch checked={highContrast} onChange={handleToggleHighContrast} />}
        label="High Contrast Mode"
      />
      <FormControlLabel
        control={<Switch checked={reducedMotion} onChange={handleToggleReducedMotion} />}
        label="Reduced Motion"
      />
    </Box>
  );
};

export default AccessibilitySettings;
