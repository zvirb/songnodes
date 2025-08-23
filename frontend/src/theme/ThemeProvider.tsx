import React from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useAppSelector } from '@store/index';
import { createSongNodesTheme } from './muiTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme } = useAppSelector(state => state.ui);
  
  const muiTheme = React.useMemo(() => {
    return createSongNodesTheme(theme.isDark);
  }, [theme.isDark]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};