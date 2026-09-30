'use client';
import { useContext } from 'react';
import { ThemeContext } from '@/lib/theme/context';

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme requires ThemeProvider');
  return theme;
}
