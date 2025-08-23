import { createTheme, ThemeOptions } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    graph: {
      primary: string;
      secondary: string;
      accent: string;
      edge: string;
      selectedNode: string;
      hoveredNode: string;
      background: string;
    };
  }

  interface PaletteOptions {
    graph?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      edge?: string;
      selectedNode?: string;
      hoveredNode?: string;
      background?: string;
    };
  }

  interface Theme {
    visualization: {
      zIndex: {
        canvas: number;
        overlay: number;
        tooltip: number;
        controls: number;
      };
      performance: {
        enableOptimizations: boolean;
        lowMemoryMode: boolean;
        preferWebGL: boolean;
      };
    };
  }

  interface ThemeOptions {
    visualization?: {
      zIndex?: {
        canvas?: number;
        overlay?: number;
        tooltip?: number;
        controls?: number;
      };
      performance?: {
        enableOptimizations?: boolean;
        lowMemoryMode?: boolean;
        preferWebGL?: boolean;
      };
    };
  }
}

const commonTheme: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none' as const,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        elevation3: {
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            padding: '4px 8px',
          },
        },
        paper: {
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          marginTop: 4,
        },
        option: {
          padding: '12px 16px',
          '&:hover': {
            backgroundColor: alpha('#3B82F6', 0.08),
          },
        },
      },
    },
  },
  visualization: {
    zIndex: {
      canvas: 1,
      overlay: 10,
      tooltip: 1500,
      controls: 1400,
    },
    performance: {
      enableOptimizations: true,
      lowMemoryMode: false,
      preferWebGL: true,
    },
  },
};

export const lightTheme = createTheme({
  ...commonTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#8B5CF6',
      light: '#A78BFA',
      dark: '#7C3AED',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    info: {
      main: '#06B6D4',
      light: '#22D3EE',
      dark: '#0891B2',
    },
    background: {
      default: '#F9FAFB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
    },
    divider: '#E5E7EB',
    graph: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      accent: '#F59E0B',
      edge: '#9CA3AF',
      selectedNode: '#EC4899',
      hoveredNode: '#06B6D4',
      background: '#F9FAFB',
    },
  },
});

export const darkTheme = createTheme({
  ...commonTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#60A5FA',
      light: '#93C5FD',
      dark: '#3B82F6',
      contrastText: '#111827',
    },
    secondary: {
      main: '#A78BFA',
      light: '#C4B5FD',
      dark: '#8B5CF6',
      contrastText: '#111827',
    },
    error: {
      main: '#F87171',
      light: '#FCA5A5',
      dark: '#EF4444',
    },
    warning: {
      main: '#FBBF24',
      light: '#FCD34D',
      dark: '#F59E0B',
    },
    success: {
      main: '#34D399',
      light: '#6EE7B7',
      dark: '#10B981',
    },
    info: {
      main: '#22D3EE',
      light: '#67E8F9',
      dark: '#06B6D4',
    },
    background: {
      default: '#111827',
      paper: '#1F2937',
    },
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
    },
    divider: '#374151',
    graph: {
      primary: '#60A5FA',
      secondary: '#A78BFA',
      accent: '#FBBF24',
      edge: '#6B7280',
      selectedNode: '#F472B6',
      hoveredNode: '#22D3EE',
      background: '#111827',
    },
  },
  components: {
    ...commonTheme.components,
    MuiPaper: {
      styleOverrides: {
        ...commonTheme.components?.MuiPaper?.styleOverrides,
        root: {
          ...commonTheme.components?.MuiPaper?.styleOverrides?.root,
          backgroundImage: 'none',
        },
      },
    },
  },
});

export const createSongNodesTheme = (isDark: boolean) => {
  return isDark ? darkTheme : lightTheme;
};