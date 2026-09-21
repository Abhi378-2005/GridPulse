'use client';

import React from 'react';
import { Card, CardContent } from './Card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors in child components
 * and shows a friendly fallback instead of white-screening the app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full flex items-center justify-center border-destructive/30 bg-destructive/5">
          <CardContent className="text-center p-6">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm font-semibold text-destructive mb-1">
              {this.props.fallbackTitle || 'Component Error'}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {this.state.error?.message || 'Something went wrong'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-muted transition-colors"
            >
              ↻ Retry
            </button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
