import { ethers } from 'ethers';

/**
 * Safely formats any value for rendering in React, with special handling for BigNumber objects
 * @param {any} value - The value to format
 * @param {number} decimals - Number of decimals to display for BigNumber values
 * @returns {string} A safely formatted string representation
 */
export function safeRender(value, decimals = 18) {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return '';
  }
  
  // Check if it's a BigNumber (ethers v5)
  if (value && typeof value === 'object' && value._isBigNumber) {
    return ethers.utils.formatUnits(value, decimals);
  }
  
  // Check if it might be a different kind of BigNumber-like object
  if (value && typeof value === 'object' && value._hex) {
    try {
      return ethers.utils.formatUnits(value, decimals);
    } catch (e) {
      console.warn('Failed to format hex value as BigNumber:', e);
      return String(value._hex);
    }
  }
  
  // Handle regular numbers and strings
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  
  // For other objects or arrays, use JSON stringify
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  
  // Fallback
  return String(value);
}

// Format address to truncated form (0x1234...5678)
export function formatAddress(address, start = 6, end = 4) {
  if (!address) return '';
  if (!ethers.utils.isAddress(address)) return address;
  
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

// Format ethers BigNumber to human-readable string with specified decimals
export function formatBigNumber(value, decimals = 18) {
  if (!value) return '0';
  
  try {
    return ethers.utils.formatUnits(value, decimals);
  } catch (error) {
    console.error('Error formatting BigNumber:', error);
    return '0';
  }
}

// Format a date to a human-readable string
export function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format a date to include time
export function formatDateTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format a timestamp to a relative time string (e.g., "2 hours ago")
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);
  
  if (diffYears > 0) {
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  } else if (diffMonths > 0) {
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Format a timestamp to a countdown string (e.g., "2 days left")
export function formatCountdown(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = date - now;
  
  if (diffMs <= 0) {
    return 'Expired';
  }
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} left`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} left`;
  } else {
    return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} left`;
  }
}

/**
 * Format a percentage value with proper handling of null/undefined values
 * @param {number} value - The value to format as percentage (0-1 range)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 1) {
  // Handle null, undefined, or NaN values
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  
  // Ensure value is treated as a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Format with the specified number of decimal places
  return `${(numValue * 100).toFixed(decimals)}%`;
}

// Format a number with commas as thousands separators
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '0';
  
  return parseFloat(value)
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Helper function for status colors
export function getStatusColor(status) {
  switch (status) {
    case 'active':
      return 'bg-yellow-100 text-yellow-800';
    case 'succeeded':
      return 'bg-green-100 text-green-800';
    case 'pending':
    case 'queued':
      return 'bg-blue-100 text-blue-800';
    case 'executed':
      return 'bg-indigo-100 text-indigo-800';
    case 'defeated':
      return 'bg-red-100 text-red-800';
    case 'canceled':
    case 'expired':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Helper function to format time in seconds to readable format
export function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours} hr${hours > 1 ? 's' : ''}` : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
}

/**
 * Get a color for a percentage value gradient
 * @param {number} value - Percentage value (0-1 range)
 * @param {string} lowColor - Color for low values (default: red)
 * @param {string} midColor - Color for medium values (default: yellow)
 * @param {string} highColor - Color for high values (default: green)
 * @returns {string} CSS color value
 */
export function getPercentageColor(value, lowColor = '#ef4444', midColor = '#f59e0b', highColor = '#10b981') {
  if (value === undefined || value === null || isNaN(value)) {
    return '#d1d5db'; // Default gray
  }
  
  if (value < 0.3) {
    return lowColor;
  } else if (value < 0.7) {
    return midColor;
  } else {
    return highColor;
  }
}