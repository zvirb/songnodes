
import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import GraphSettings from './GraphSettings';
import DisplaySettings from './DisplaySettings';
import PerformanceSettings from './PerformanceSettings';
import AccessibilitySettings from './AccessibilitySettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Settings: React.FC = () => {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="settings tabs">
          <Tab label="Graph" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
          <Tab label="Display" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
          <Tab label="Performance" id="settings-tab-2" aria-controls="settings-tabpanel-2" />
          <Tab label="Accessibility" id="settings-tab-3" aria-controls="settings-tabpanel-3" />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        <GraphSettings />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <DisplaySettings />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <PerformanceSettings />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <AccessibilitySettings />
      </TabPanel>
    </Box>
  );
};

export default Settings;
