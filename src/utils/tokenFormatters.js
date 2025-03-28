// src/utils/tokenFormatters.js - Updated with better handling for large token amounts
import { ethers } from 'ethers';

/**
 * Format a token value from wei to a user-friendly display format with 5 decimal places
 * @param {string|number|object} value - Token value in wei or ether
 * @returns {string} Formatted value with 5 decimal places
 */
export const formatTokenAmount = (value) => {
  try {
    // Return default for empty/falsy values
    if (!value) return "0.00000";
    
    // Handle BigNumber objects directly
    if (value._isBigNumber) {
      return ethers.utils.formatEther(value).substring(0, 7); // Keep 5 decimal places
    }
    
    // Convert the value to a string if it's not already
    const valueStr = value.toString();
    
    // If it looks like it already has decimals and is a reasonable size, it's likely already in ether
    if (valueStr.includes('.') && valueStr.length < 20) {
      return parseFloat(valueStr).toFixed(5);
    }
    
    // Try to determine if this is a wei value by attempting to create a BigNumber
    try {
      // If it's a numeric string without decimals, it might be wei
      if (valueStr.match(/^[0-9]+$/) || valueStr.includes('e+')) {
        const bigNum = ethers.BigNumber.from(valueStr);
        // If it's a large value, assume it's wei
        if (bigNum.gt(ethers.utils.parseUnits("1", 10))) { // If greater than 10^10, likely wei
          return ethers.utils.formatEther(bigNum).substring(0, 7); // Keep 5 decimal places
        }
      }
    } catch (e) {
      // Not a valid BigNumber, continue with standard parsing
    }
    
    // Default case: assume it's already in ether
    const numValue = parseFloat(valueStr);
    if (isNaN(numValue)) return "0.00000";
    return numValue.toFixed(5);
  } catch (error) {
    console.error("Error formatting token amount:", error, {value});
    return "0.00000";
  }
};

/**
 * Format a token value for display in header - more compact
 * @param {string|number|object} value - Token value in wei or ether
 * @returns {string} Formatted value for header display
 */
export const formatTokenForHeader = (value) => {
  const formatted = formatTokenAmount(value);
  const num = parseFloat(formatted);
  
  // For header display, we use a more compact format
  if (num === 0) return "0";
  if (num < 0.01) return "<0.01";
  if (num >= 1000) return `${Math.floor(num).toLocaleString()}`;
  return formatted;
};

/**
 * Format a token value to a standard format with proper ETH units, automatically 
 * determining how many decimals to show based on the value
 * @param {string|number|object} value - Token value in wei or ether
 * @returns {string} Formatted value with automatic decimal precision
 */
export const formatTokenStandard = (value) => {
  try {
    // Use our more robust formatTokenAmount function
    const formatted = formatTokenAmount(value);
    const numValue = parseFloat(formatted);
    
    // Format based on value size
    if (numValue === 0) return "0";
    if (numValue < 0.001) return "<0.001";
    if (numValue < 1) return numValue.toFixed(3);
    if (numValue < 1000) return numValue.toFixed(2);
    
    // For larger values, use locale string formatting with no decimals
    return Math.floor(numValue).toLocaleString();
  } catch (error) {
    console.error("Error formatting token standard:", error, {value});
    return "0";
  }
};

/**
 * Calculate how much of a value is delegated and return a formatted string
 * @param {string|number|object} total - Total token amount
 * @param {string|number|object} delegated - Delegated token amount
 * @returns {string} Formatted percentage
 */
export const formatDelegationPercentage = (total, delegated) => {
  try {
    if (!total || !delegated) return "0%";
    
    // Get formatted values to work with
    const totalStr = formatTokenAmount(total);
    const delegatedStr = formatTokenAmount(delegated);
    
    // Convert to numbers
    const totalNum = parseFloat(totalStr);
    const delegatedNum = parseFloat(delegatedStr);
    
    if (totalNum === 0) return "0%";
    
    // Calculate percentage
    const percentage = (delegatedNum / totalNum) * 100;
    
    // Format based on value
    if (percentage < 0.1) return "<0.1%";
    if (percentage > 99.9 && percentage < 100) return ">99.9%";
    return `${percentage.toFixed(1)}%`;
  } catch (error) {
    console.error("Error formatting delegation percentage:", error);
    return "0%";
  }
};