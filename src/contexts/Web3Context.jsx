// src/contexts/Web3Context.jsx
// Enhanced error handling and contract initialization with blockchain data support

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import JustTokenABI from '../config/abis/JustTokenUpgradeable.json';
import JustGovernanceABI from '../config/abis/JustGovernanceUpgradeable.json';
import JustTimelockABI from '../config/abis/JustTimelockUpgradeable.json';
import JustDAOHelperABI from '../config/abis/JustDAOHelperUpgradeable.json';
import { CONTRACT_ADDRESSES } from '../utils/constants.js';

const Web3Context = createContext();
 
// Make sure this is exported as a named export
export function useWeb3() {
  return useContext(Web3Context);
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [networkId, setNetworkId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [contracts, setContracts] = useState({
    justToken: null,  // Changed naming to match BlockchainDataService expectations
    governance: null,
    timelock: null,
    analyticsHelper: null,
    daoHelper: null,
    securityManager: null // Additional reference for security settings
  });
  const [contractsReady, setContractsReady] = useState(false);
  const [contractErrors, setContractErrors] = useState({});
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  
  // Expected network is Sepolia (chainId 11155111)
  const EXPECTED_NETWORK_ID = 11155111;
  const NETWORK_NAME = "Sepolia";
  
  // Use refs to store functions that need to access other functions
  // This prevents dependency cycles without hooks
  const functionsRef = useRef({});

  // Initialize contracts function
  functionsRef.current.initializeContracts = async (provider, signer) => {
    try {

      // Add this to your Web3Context.jsx file, inside the Web3Provider component

// Add this function to debug contract addresses and ABIs
function debugContractsInfo() {
  console.log("CONTRACT_ADDRESSES from constants:", CONTRACT_ADDRESSES);
  
  // Log ABI signatures for governance contract
  console.log("Governance ABI Methods:", 
    JustGovernanceABI.abi
      .filter(item => item.type === "function")
      .map(fn => `${fn.name}(${fn.inputs.map(i => i.type).join(',')}): ${fn.stateMutability}`)
  );
  
  // Log ABI signatures for DAOHelper contract
  console.log("DAOHelper ABI Methods:", 
    JustDAOHelperABI.abi
      .filter(item => item.type === "function")
      .map(fn => `${fn.name}(${fn.inputs.map(i => i.type).join(',')}): ${fn.stateMutability}`)
  );
  
  // Log current contract instances
  console.log("Current contract instances:", {
    governance: contracts.governance ? {
      address: contracts.governance.address,
      hasGetProposalState: typeof contracts.governance.getProposalState === 'function',
      hasGovParams: typeof contracts.governance.govParams === 'function'
    } : 'Not initialized',
    
    daoHelper: contracts.daoHelper ? {
      address: contracts.daoHelper.address,
      hasJustToken: typeof contracts.daoHelper.justToken === 'function',
      hasAdminRole: typeof contracts.daoHelper.ADMIN_ROLE === 'function'
    } : 'Not initialized',
    
    token: contracts.justToken ? {
      address: contracts.justToken.address,
      hasName: typeof contracts.justToken.name === 'function',
      hasBalance: typeof contracts.justToken.balanceOf === 'function'
    } : 'Not initialized',
    
    timelock: contracts.timelock ? {
      address: contracts.timelock.address,
      hasMinDelay: typeof contracts.timelock.minDelay === 'function'
    } : 'Not initialized'
  });
  
  // Check network information
  if (provider) {
    provider.getNetwork().then(network => {
      console.log("Connected to network:", {
        name: network.name,
        chainId: network.chainId
      });
    }).catch(error => {
      console.error("Error getting network:", error);
    });
  }
}

// Call this function after initializing contracts
functionsRef.current.initializeContracts = async (provider, signer) => {
  try {
    // Existing initializeContracts code...
    
    // After setting contracts but before returning
    setContracts(newContracts);
    setContractErrors(newContractErrors);
    
    // Debug logging
    console.log("Contracts ready status:", isReady);
    if (!isReady) {
      console.warn("Some contracts failed to initialize:", newContractErrors);
    } else {
      // Call debug function
      debugContractsInfo();
    }
    
    // Rest of the function...
  } catch (error) {
    // Error handling...
  }
};
      setContractsReady(false);
      const newContractErrors = {};
      const newContracts = {};
      
      console.log("Initializing contracts with addresses:", CONTRACT_ADDRESSES);
      
      // Initialize token contract
      try {
        const tokenContract = new ethers.Contract(
          CONTRACT_ADDRESSES.token,
          JustTokenABI.abi,
          signer
        );
        // Verify contract is accessible by calling a view function
        await tokenContract.name();
        newContracts.justToken = tokenContract; // Changed to justToken to match BlockchainDataService
        console.log("Token contract initialized successfully");
      } catch (error) {
        console.error("Error initializing token contract:", error);
        newContractErrors.token = error.message;
      }
      
      // Initialize governance contract
      try {
        const governanceContract = new ethers.Contract(
          CONTRACT_ADDRESSES.governance,
          JustGovernanceABI.abi,
          signer
        );
        // Verify contract works
        try {
          // Try to call a view function to verify
          await governanceContract.govParams();
        } catch (verifyError) {
          console.error("Error verifying governance contract:", verifyError);
          throw verifyError;
        }
        newContracts.governance = governanceContract;
        console.log("Governance contract initialized successfully");
      } catch (error) {
        console.error("Error initializing governance contract:", error);
        newContractErrors.governance = error.message;
      }
      
      // Initialize timelock contract
      try {
        const timelockContract = new ethers.Contract(
          CONTRACT_ADDRESSES.timelock,
          JustTimelockABI.abi,
          signer
        );
        // Verify contract works
        try {
          await timelockContract.minDelay();
        } catch (verifyError) {
          console.error("Error verifying timelock contract:", verifyError);
          throw verifyError;
        }
        newContracts.timelock = timelockContract;
        console.log("Timelock contract initialized successfully");
      } catch (error) {
        console.error("Error initializing timelock contract:", error);
        newContractErrors.timelock = error.message;
      }
      
      // Initialize DAO helper contract
      try {
        const daoHelperContract = new ethers.Contract(
          CONTRACT_ADDRESSES.daoHelper,
          JustDAOHelperABI.abi,
          signer
        );
        
        // Verify contract works by calling a view function
        try {
          // Call justToken() which is a public variable in the contract
          await daoHelperContract.justToken();
          // Alternative check if justToken fails
          if (!await daoHelperContract.justToken()) {
            // Try another view function as backup verification
            await daoHelperContract.ADMIN_ROLE();
          }
        } catch (verifyError) {
          console.error("Error verifying DAO helper contract:", verifyError);
          // Try a different function to verify if the first one failed
          try {
            await daoHelperContract.ADMIN_ROLE();
          } catch (secondVerifyError) {
            console.error("Failed secondary verification of DAO helper contract:", secondVerifyError);
            throw verifyError;
          }
        }
        
        newContracts.daoHelper = daoHelperContract;
        console.log("DAO helper contract initialized successfully");
      } catch (error) {
        console.error("Error initializing DAO helper contract:", error);
        newContractErrors.daoHelper = error.message;
      }
      
      // For security settings - governance contract also handles this
      newContracts.securityManager = newContracts.governance;
      
      // Set contracts object
      setContracts(newContracts);
      setContractErrors(newContractErrors);
      
      // Mark as ready if key contracts are available
      const isReady = newContracts.justToken && newContracts.governance && 
                      (newContracts.daoHelper || newContracts.timelock);
      setContractsReady(isReady);
      
      console.log("Contracts ready status:", isReady);
      if (!isReady) {
        console.warn("Some contracts failed to initialize:", newContractErrors);
      }
      
      // Set a refresh flag to trigger data reloads
      setRefreshCounter(prev => prev + 1);
      
      return isReady;
    } catch (error) {
      console.error("Error in contract initialization:", error);
      setContractErrors({global: error.message});
      setConnectionError("Failed to initialize contracts. Please check your connection.");
      setContractsReady(false);
      return false;
    }
  };

  // Define handler functions and store in functionsRef
  functionsRef.current.handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User has disconnected all accounts
      setIsConnected(false);
      setAccount('');
      setContractsReady(false);
    } else {
      setAccount(accounts[0]);
      // Refresh contract data with new account
      if (provider) {
        const signer = provider.getSigner();
        setSigner(signer);
        functionsRef.current.initializeContracts(provider, signer);
      }
    }
  };

  functionsRef.current.handleChainChanged = (chainIdHex) => {
    const chainId = parseInt(chainIdHex, 16);
    // Reload the page when the chain changes
    setNetworkId(chainId);
    setIsCorrectNetwork(chainId === EXPECTED_NETWORK_ID);
    
    // If network changed, reinitialize contracts
    if (provider && isConnected) {
      const signer = provider.getSigner();
      setSigner(signer);
      functionsRef.current.initializeContracts(provider, signer);
    }
    
    console.log("Network changed to:", chainId);
  };

  // Check if wallet is already connected on page load
  useEffect(() => {
    const CheckConnection = async () => {
      if (window.ethereum) {
        try {
          // Check if already connected
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            // Get network info
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await web3Provider.getNetwork();
            const chainId = network.chainId;
            
            setAccount(accounts[0]);
            setProvider(web3Provider);
            setSigner(web3Provider.getSigner());
            setIsConnected(true);
            setNetworkId(chainId);
            setIsCorrectNetwork(chainId === EXPECTED_NETWORK_ID);
            
            // Initialize contracts
            if (chainId === EXPECTED_NETWORK_ID) {
              await functionsRef.current.initializeContracts(web3Provider, web3Provider.getSigner());
            }
            
            // Set up listeners
            window.ethereum.on('accountsChanged', functionsRef.current.handleAccountsChanged);
            window.ethereum.on('chainChanged', functionsRef.current.handleChainChanged);
            
            console.log("Connected to wallet:", accounts[0]);
            console.log("Network:", network.name, "ChainId:", chainId);
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
          setConnectionError("Error connecting to wallet. Please try again.");
        }
      }
    };
    
    CheckConnection();
    
    // Cleanup function
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', functionsRef.current.handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', functionsRef.current.handleChainChanged);
      }
    };
  }, []); // No dependencies - this runs once on mount

  async function switchToCorrectNetwork() {
    if (!window.ethereum) return false;
    
    try {
      // Try to switch to the Sepolia network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + EXPECTED_NETWORK_ID.toString(16) }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        // Network not added to MetaMask, let's add it
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x' + EXPECTED_NETWORK_ID.toString(16),
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/']
              }
            ],
          });
          return true;
        } catch (addError) {
          console.error("Error adding Sepolia network:", addError);
          setConnectionError("Failed to add Sepolia network to your wallet.");
          return false;
        }
      }
      console.error("Error switching network:", error);
      setConnectionError("Failed to switch to Sepolia network.");
      return false;
    }
  }

  async function connectWallet() {
    setConnectionError(null);
    try {
      // Check if MetaMask is installed
      if (window.ethereum) {
        // Reset any previous errors
        setContractErrors({});
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Get network info
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await web3Provider.getNetwork();
        const chainId = network.chainId;
        
        // Check if we're on the correct network
        const correctNetwork = chainId === EXPECTED_NETWORK_ID;
        setIsCorrectNetwork(correctNetwork);
        
        // If not on correct network, prompt to switch
        if (!correctNetwork) {
          const networkSwitched = await switchToCorrectNetwork();
          if (!networkSwitched) {
            setConnectionError(`Please switch to ${NETWORK_NAME} network to use this application.`);
            return false;
          }
        }
        
        setAccount(accounts[0]);
        setProvider(web3Provider);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
        setNetworkId(chainId);
        
        // Initialize contracts
        const success = await functionsRef.current.initializeContracts(web3Provider, web3Provider.getSigner());
        
        // Set up listeners
        window.ethereum.on('accountsChanged', functionsRef.current.handleAccountsChanged);
        window.ethereum.on('chainChanged', functionsRef.current.handleChainChanged);
        
        console.log("Connected to:", accounts[0]);
        console.log("Network:", network.name, "ChainId:", chainId);
        
        return success;
      } else {
        console.error("MetaMask is not installed");
        setConnectionError("Please install MetaMask to use this application");
        return false;
      }
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      setConnectionError("Failed to connect to wallet: " + error.message);
      return false;
    }
  }

  // New method for force contract refresh
  // This will trigger a refresh of the contract data
  async function refreshContractData() {
    try {
      if (!provider || !signer) {
        throw new Error("Provider or signer not available");
      }
      
      console.log("Forcing contract refresh...");
      const success = await functionsRef.current.initializeContracts(provider, signer);
      if (success) {
        console.log("Contract refresh successful");
      } else {
        console.warn("Contract refresh completed but some contracts were not initialized");
      }
      
      return success;
    } catch (error) {
      console.error("Error refreshing contract data:", error);
      return false;
    }
  }

  // Modified to also refresh contract data
  async function refreshData() {
    // First refresh contract connections if needed
    if (isConnected && provider && signer) {
      await refreshContractData();
    }
    
    // Then trigger a refresh of all data by incrementing the counter
    setRefreshCounter(prev => prev + 1);
  }

  async function disconnectWallet() {
    setIsConnected(false);
    setAccount('');
    setSigner(null);
    setContracts({
      justToken: null,  // Changed name to match BlockchainDataService
      governance: null,
      timelock: null,
      analyticsHelper: null,
      daoHelper: null,
      securityManager: null
    });
    setContractsReady(false);
    setContractErrors({});
    setConnectionError(null);
    
    // Remove listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', functionsRef.current.handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', functionsRef.current.handleChainChanged);
    }
  }

  // Provide contract names for easier access
  const getContractByName = (name) => {
    switch(name) {
      case 'token':
      case 'justToken':
        return contracts.justToken;
      case 'governance':
        return contracts.governance;
      case 'timelock':
        return contracts.timelock;
      case 'analyticsHelper':
        return contracts.analyticsHelper;
      case 'daoHelper':
        return contracts.daoHelper;
      case 'securityManager':
        return contracts.securityManager;
      default:
        console.warn(`Unknown contract name: ${name}`);
        return null;
    }
  };

  // Check if contracts are initialized
  const isContractInitialized = (name) => {
    return !!getContractByName(name);
  };

  const value = {
    provider,
    signer,
    account,
    isConnected,
    networkId,
    isCorrectNetwork,
    contracts,
    contractsReady,
    contractErrors,
    refreshCounter,
    connectionError,
    getContractByName,
    isContractInitialized,
    connectWallet,
    disconnectWallet,
    refreshData,
    refreshContractData,
    switchToCorrectNetwork
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}