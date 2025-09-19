import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@store/index';
import { register, clearError } from '@store/authSlice';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(state => state.auth);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear general error
    if (error) {
      dispatch(clearError());
    }
  };
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await dispatch(register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })).unwrap();
    } catch (err) {
      // Error is handled by Redux
      console.error('Registration failed:', err);
    }
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        maxWidth: 400, 
        mx: 'auto',
        mt: 8,
        borderRadius: 2,
      }}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom 
          align="center"
          sx={{ mb: 3, fontWeight: 600 }}
        >
          Create Account
        </Typography>
        
        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center" 
          sx={{ mb: 3 }}
        >
          Join SongNodes to explore music connections
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <TextField
          fullWidth
          required
          id="username"
          name="username"
          label="Username"
          autoComplete="username"
          autoFocus
          value={formData.username}
          onChange={handleChange}
          error={!!validationErrors.username}
          helperText={validationErrors.username}
          disabled={loading}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        
        <TextField
          fullWidth
          required
          id="email"
          name="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          error={!!validationErrors.email}
          helperText={validationErrors.email}
          disabled={loading}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        
        <TextField
          fullWidth
          required
          id="password"
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          error={!!validationErrors.password}
          helperText={validationErrors.password}
          disabled={loading}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  disabled={loading}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        
        <TextField
          fullWidth
          required
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={!!validationErrors.confirmPassword}
          helperText={validationErrors.confirmPassword}
          disabled={loading}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  disabled={loading}
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ 
            mb: 2,
            py: 1.5,
            textTransform: 'none',
            fontSize: '1rem',
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Sign Up'
          )}
        </Button>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, textAlign: 'center' }}>
          By signing up, you agree to our Terms of Service and Privacy Policy
        </Typography>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Link 
              component="button" 
              type="button"
              variant="body2" 
              onClick={onSwitchToLogin}
              disabled={loading}
              sx={{ fontWeight: 600 }}
            >
              Sign in
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};