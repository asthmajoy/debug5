// Add this in a utility file like src/utils/walletUtils.js

import { ethers } from 'ethers';

/**
 * Checks if wallet is connected and returns the current account
 * @returns {Promise<{connected: boolean, account: string|null, chainId: number|null, error: string|null}>}
 */
export async function checkWalletConnection() {
  try {
    // Check if ethereum provider exists (MetaMask or similar)
    if (!window.ethereum) {
      return {
        connected: false,
        account: null,
        chainId: null,
        error: 'No Ethereum wallet detected'
      };
    }

    // Create ethers provider
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Get accounts
    const accounts = await provider.listAccounts();
    
    // Get network information
    const network = await provider.getNetwork();
    
    if (accounts.length === 0) {
      return {
        connected: false,
        account: null,
        chainId: network.chainId,
        error: 'Wallet not connected'
      };
    }
    
    // Return connection info
    return {
      connected: true,
      account: accounts[0],
      chainId: network.chainId,
      error: null
    };
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return {
      connected: false,
      account: null,
      chainId: null,
      error: error.message || 'Error connecting to wallet'
    };
  }
}

/**
 * Prompts user to connect their wallet
 * @returns {Promise<{success: boolean, account: string|null, error: string|null}>}
 */
export async function connectWallet() {
  try {
    // Check if ethereum provider exists
    if (!window.ethereum) {
      return {
        success: false,
        account: null,
        error: 'No Ethereum wallet detected. Please install MetaMask or a similar wallet.'
      };
    }

    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) {
      return {
        success: false,
        account: null,
        error: 'User rejected the connection request'
      };
    }
    
    return {
      success: true,
      account: accounts[0],
      error: null
    };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return {
      success: false,
      account: null,
      error: error.message || 'Error connecting wallet'
    };
  }
}

/**
 * Helper function to ensure we have a valid, connected account
 * Can be used in components to verify wallet connection
 * @returns {Promise<string|null>} Connected account or null
 */
export async function ensureWalletConnected() {
  try {
    // First check current connection
    const { connected, account } = await checkWalletConnection();
    
    if (connected && account) {
      return account;
    }
    
    // If not connected, try to connect
    const { success, account: newAccount } = await connectWallet();
    
    if (success && newAccount) {
      return newAccount;
    }
    
    return null;
  } catch (error) {
    console.error('Error ensuring wallet connection:', error);
    return null;
  }
}