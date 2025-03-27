// src/utils/addressUtils.js - Fixed version with improved handling for empty inputs
import { ethers } from 'ethers';

/**
 * Normalizes Ethereum addresses for reliable comparison
 * @param {string} address - The address to normalize
 * @returns {string} The normalized address in lowercase
 */
export function normalizeAddress(address) {
  if (!address) return '';
  
  try {
    // Ensure we have a string and remove any whitespace
    let normalized = address.toString().toLowerCase().trim();
    
    // If the address is empty after trimming, return empty string
    if (normalized === '') {
      return '';
    }
    
    // Remove the '0x' prefix if present to normalize
    if (normalized.startsWith('0x')) {
      normalized = normalized.substring(2);
    }
    
    // Add 0x prefix back for consistent format
    return '0x' + normalized;
  } catch (err) {
    console.error(`Error normalizing address ${address}:`, err);
    // Return original converted to string and lowercase as fallback
    return String(address || '').toLowerCase();
  }
}

/**
 * Compare two Ethereum addresses for equality regardless of checksumming
 * @param {string} address1 - First address
 * @param {string} address2 - Second address
 * @returns {boolean} True if addresses are the same
 */
export function addressesEqual(address1, address2) {
  try {
    // Special case: if either address is empty/null/undefined after conversion to string and trimming, 
    // they only match if both are empty
    const trimmed1 = String(address1 || '').trim();
    const trimmed2 = String(address2 || '').trim();
    
    if (trimmed1 === '' || trimmed2 === '') {
      return trimmed1 === '' && trimmed2 === '';
    }
    
    // Get normalized versions of both addresses
    const normalized1 = normalizeAddress(address1);
    const normalized2 = normalizeAddress(address2);
    
    // Extra validation - ensure both are valid addresses
    let isValid1 = false;
    let isValid2 = false;
    
    try {
      isValid1 = ethers.utils.isAddress(normalized1);
      isValid2 = ethers.utils.isAddress(normalized2);
    } catch (validationErr) {
      console.warn(`Address validation error:`, validationErr);
    }
    
    if (!isValid1 || !isValid2) {
      console.warn(`Address comparison includes invalid address: ${address1} or ${address2}`);
      return false; // At least one address is invalid, so they can't be equal
    }
    
    // Compare the normalized addresses
    return normalized1 === normalized2;
  } catch (err) {
    console.error(`Error comparing addresses ${address1} and ${address2}:`, err);
    return false;
  }
}

/**
 * Tests if a set of addresses from different sources represent the same address
 * Useful for debugging address comparison issues
 * @param {Object} addressOptions - Object with addresses from different sources
 * @returns {Object} Detailed comparison information
 */
export function diagnoseMismatchedAddresses(addressOptions) {
  const { address1, address2, label1 = 'addr1', label2 = 'addr2' } = addressOptions;
  
  try {
    // Special handling for empty values
    const trimmed1 = String(address1 || '').trim();
    const trimmed2 = String(address2 || '').trim();
    const areEmpty = {
      address1: trimmed1 === '',
      address2: trimmed2 === ''
    };
    
    // Get different representations for comparison
    const norm1 = normalizeAddress(address1);
    const norm2 = normalizeAddress(address2);
    
    let checksum1 = '';
    let checksum2 = '';
    let isValidAddr1 = false;
    let isValidAddr2 = false;
    
    try {
      isValidAddr1 = ethers.utils.isAddress(trimmed1 || '0x0');
      isValidAddr2 = ethers.utils.isAddress(trimmed2 || '0x0');
      
      if (isValidAddr1) {
        checksum1 = ethers.utils.getAddress(address1);
      }
      
      if (isValidAddr2) {
        checksum2 = ethers.utils.getAddress(address2);
      }
    } catch (e) {
      console.warn("Couldn't get checksum address:", e);
    }
    
    const original1 = String(address1 || '');
    const original2 = String(address2 || '');
    
    const isEqualNormalized = norm1 === norm2;
    const isEqualChecksum = checksum1 === checksum2 && checksum1 !== '';
    const isEqualOriginal = original1 === original2;
    
    // Get string representations for debugging
    const addressDetails = {
      [label1]: {
        original: original1,
        isEmpty: areEmpty.address1,
        normalized: norm1,
        checksum: checksum1,
        length: original1.length,
        valid: isValidAddr1
      },
      [label2]: {
        original: original2,
        isEmpty: areEmpty.address2,
        normalized: norm2,
        checksum: checksum2,
        length: original2.length,
        valid: isValidAddr2
      },
      comparison: {
        originalEqual: isEqualOriginal,
        normalizedEqual: isEqualNormalized,
        checksumEqual: isEqualChecksum,
        addressesEqual: addressesEqual(address1, address2),
        bothEmpty: areEmpty.address1 && areEmpty.address2,
        oneEmpty: areEmpty.address1 || areEmpty.address2
      }
    };
    
    return addressDetails;
  } catch (err) {
    console.error(`Error diagnosing address mismatch:`, err);
    return { error: err.message };
  }
}

/**
 * Extremely aggressive normalization of Ethereum addresses
 * Handles checksummed, non-checksummed, with/without 0x, and even truncated addresses
 * @param {string} address - The address to normalize
 * @returns {string} The normalized address
 */
export function superNormalizeAddress(address) {
  // Handle edge cases first
  if (!address) return '';
  
  try {
    // Check if string is empty after conversion and trimming
    const trimmed = String(address).trim();
    if (trimmed === '') {
      return '';
    }
    
    // Convert to string and lowercase
    let normalized = String(address).toLowerCase().trim();
    
    // Remove any whitespace and special characters
    normalized = normalized.replace(/[\s\r\n\t]/g, '');
    
    // Remove 0x prefix if present
    if (normalized.startsWith('0x')) {
      normalized = normalized.substring(2);
    }
    
    // Make sure it's the right length for hex (40 chars for 20 bytes)
    if (normalized.length > 40) {
      normalized = normalized.substring(0, 40);
    }
    
    // Add 0x prefix back
    normalized = '0x' + normalized;
    
    return normalized;
  } catch (err) {
    console.error(`Error super-normalizing address ${address}:`, err);
    // Return original as string and lowercase if all else fails
    return String(address || '').toLowerCase().trim();
  }
}

/**
 * Compare two ethereum addresses with multiple fallback strategies
 * Will try extremely aggressive techniques to match addresses
 * @param {string} address1 - First address
 * @param {string} address2 - Second address
 * @param {Object} options - Comparison options
 * @returns {boolean} True if addresses are the same
 */
export function forceAddressesEqual(address1, address2, options = {}) {
  const { debug = true, matchLength = 40 } = options;
  
  try {
    // Input validation - special case for empty addresses
    const trimmed1 = String(address1 || '').trim();
    const trimmed2 = String(address2 || '').trim();
    
    // If either is empty, they only match if both are empty
    if (trimmed1 === '' || trimmed2 === '') {
      const bothEmpty = trimmed1 === '' && trimmed2 === '';
      if (debug) console.log(`One or both addresses are empty. Both empty: ${bothEmpty}`);
      return bothEmpty;
    }
    
    // Strategy 1: Try regular case-insensitive string comparison
    const norm1 = String(address1).toLowerCase().trim();
    const norm2 = String(address2).toLowerCase().trim();
    
    // Log the values we're comparing (useful for debugging)
    if (debug) {
      console.log(`ADDRESS COMPARISON DEBUG:
      address1: ${address1} (${typeof address1})
      address2: ${address2} (${typeof address2})
      normalized1: ${norm1}
      normalized2: ${norm2}
      `);
    }
    
    if (norm1 === norm2) {
      if (debug) console.log('MATCH: Simple normalization matched');
      return true;
    }
    
    // Strategy 2: Try super-normalized addresses
    const superNorm1 = superNormalizeAddress(address1);
    const superNorm2 = superNormalizeAddress(address2);
    
    if (superNorm1 === superNorm2) {
      if (debug) console.log('MATCH: Super-normalized addresses matched');
      return true;
    }
    
    // Strategy 3: Compare substrings (in case one address is truncated)
    // Get the minimum length to compare (to avoid index errors)
    const minLength = Math.min(
      Math.min(superNorm1.length, superNorm2.length), 
      2 + matchLength // 2 for '0x' + matchLength characters
    );
    
    if (minLength >= 10) { // Only do substring comparison if we have enough chars
      const sub1 = superNorm1.substring(0, minLength);
      const sub2 = superNorm2.substring(0, minLength);
      
      if (sub1 === sub2) {
        if (debug) console.log(`MATCH: First ${minLength} characters match`);
        return true;
      }
    }
    
    // Strategy 4: Try using ethers.js utilities if both are valid addresses
    try {
      const isValid1 = ethers.utils.isAddress(address1);
      const isValid2 = ethers.utils.isAddress(address2);
      
      if (isValid1 && isValid2) {
        // Get checksummed addresses
        const checksum1 = ethers.utils.getAddress(address1);
        const checksum2 = ethers.utils.getAddress(address2);
        
        if (checksum1 === checksum2) {
          if (debug) console.log('MATCH: Checksummed addresses matched');
          return true;
        }
      }
    } catch (ethersErr) {
      // Silently fail and continue to next strategy
    }
    
    // No match found
    return false;
  } catch (err) {
    console.error('Error in forceAddressesEqual:', err);
    // Last resort, direct string comparison
    return String(address1) === String(address2);
  }
}

/**
 * Register a list of proposals that should always show the claim button for specific users
 * This is useful for testing and emergency overrides
 * @param {Array} proposals - Array of proposal IDs
 * @param {string} userAddress - User's address
 * @returns {boolean} True if this proposal should show the button for this user
 */
export function forceShowClaimButton(proposalId, userAddress) {
  // Hard-coded override list - update with your specific proposal IDs and addresses
  const overrides = [
    // Format: {proposal: id, proposers: ['0x123...', '0x456...']}
    // {proposal: 1, proposers: ['0xYOUR_ADDRESS_HERE']}
  ];
  
  // If userAddress is empty, never show the button
  if (!userAddress || String(userAddress).trim() === '') {
    return false;
  }
  
  // Check if this proposal is in our override list
  const override = overrides.find(o => o.proposal === proposalId);
  if (override) {
    // Check if the current user is in the proposers list
    // This is an "OR" check - any address in the list will work
    return override.proposers.some(addr => 
      forceAddressesEqual(addr, userAddress, {debug: false})
    );
  }
  
  return false; // No override for this proposal
}

/**
 * Console logging component that makes address comparison issues more visible
 */
export function debugAddressComparison(account, proposer, proposal) {
  // Input validation for empty addresses
  const formattedAccount = account || '(empty)';
  const formattedProposer = proposer || '(empty)';
  
  // Create box ASCII art to make this debug info stand out
  console.log(`
┌──────────────────────────────────────────────────┐
│ ADDRESS COMPARISON DEBUG - PROPOSAL #${proposal?.id || '?'} │
└──────────────────────────────────────────────────┘
User Account: ${formattedAccount}
Proposer:     ${formattedProposer}

● Original:
  User:     ${formattedAccount}
  Proposer: ${formattedProposer}
  
● Normalized:
  User:     ${superNormalizeAddress(account)}
  Proposer: ${superNormalizeAddress(proposer)}
  
● Is User Empty: ${!account || String(account).trim() === ''}
● Is Proposer Empty: ${!proposer || String(proposer).trim() === ''}
  
● Using ethers.js:
  Equal: ${account && proposer && 
          ethers.utils.isAddress(account) && 
          ethers.utils.isAddress(proposer) && 
          ethers.utils.getAddress(account) === ethers.utils.getAddress(proposer)}
  
● Using addressesEqual:
  Result: ${addressesEqual(account, proposer)}
  
● Using forceAddressesEqual:
  Result: ${forceAddressesEqual(account, proposer)}
  
● Proposal in refundable state? 
  ${['defeated', 'canceled', 'expired'].includes((proposal?.stateLabel || '').toLowerCase())}

● Stake already refunded? ${proposal?.stakeRefunded || false}  
`);
}