"use client";

import React from "react";

/**
 * PUBLIC_INTERFACE
 * ErrorBoundary
 * Catches runtime errors in client components and shows a minimal fallback to avoid app crashes.
 * It logs to console; server logging is not possible directly from the client.
 */
export class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Lightweight client-side log; avoid leaking sensitive info.
    // eslint-disable-next-line no-console
    console.error("UI ErrorBoundary caught an error:", { error, info });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
