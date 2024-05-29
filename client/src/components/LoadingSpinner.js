// src/components/LoadingSpinner.js
import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import './LoadingSpinner.css';

const LoadingSpinner = () => {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="loading-spinner-overlay">
      <div className="spinner-border text-primary" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
