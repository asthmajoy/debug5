import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { useAuth } from '../contexts/AuthContext';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { formatAddress } from '../utils/formatters';
import { formatTokenAmount } from '../utils/tokenFormatters';
import { PROPOSAL_STATES } from '../utils/constants';
import { ethers } from 'ethers';
import { DarkModeProvider, useDarkMode } from '../contexts/DarkModeContext';
import DarkModeToggle from './DarkModeToggle';
import _ from 'lodash'; // Add this import at the top of your file


// Import components
import HomePage from './HomePage';
import SecuritySettingsTab from './SecuritySettingsTab';
import RoleManagementTab from './RoleManagementTab';
import TimelockSettingsTab from './TimelockSettingsTab';
import EmergencyControlsTab from './EmergencyControlsTab';
import PendingTransactionsTab from './PendingTransactionsTab';
import ProposalsTab from './ProposalsTab';
import VoteTab from './VoteTab';
import DelegationTab from './DelegationTab';
import AnalyticsTab from './AnalyticsTab';
import DashboardTab from './DashboardTab';
import GovernanceTab from './GovernanceTab';

// Define role constants to ensure consistency
const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.utils.hexZeroPad("0x00", 32), // Or ethers.constants.HashZero
  ADMIN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE")),
  GUARDIAN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GUARDIAN_ROLE")),
  ANALYTICS_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ANALYTICS_ROLE")),
  GOVERNANCE_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE")),
  MINTER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")),
  PROPOSER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE")),
  EXECUTOR_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE")),
  CANCELLER_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CANCELLER_ROLE")),
  TIMELOCK_ADMIN_ROLE: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TIMELOCK_ADMIN_ROLE"))
};

// Helper function to safely convert string to number
const safeStringToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const numValue = parseFloat(String(value));
  return isNaN(numValue) ? 0 : numValue;
};

// The main component that needs to be wrapped with DarkModeProvider
const JustDAOContent = () => {
  const { isDarkMode } = useDarkMode();
  
  // State for active tab - set 'home' as the default
  const [activeTab, setActiveTab] = useState('home');
  
  // State for active security subtab
  const [securitySubtab, setSecuritySubtab] = useState('emergency');
  
  // State to track window width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  // State to track refresh animation
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State to track user roles directly from contract
  const [userRoles, setUserRoles] = useState({
    isAdmin: false,
    isGuardian: false,
    isAnalytics: false,
    isGovernance: false, // Added governance role
  });
  
  // State to track the effective voting power from the contract
  const [transitiveVotingPower, setTransitiveVotingPower] = useState(null);
  
  // Web3 context for blockchain connection
  const { account, isConnected, connectWallet, disconnectWallet, contracts } = useWeb3();
  
  // Auth context for user roles
  const { hasRole } = useAuth();
  
  // Function to navigate between tabs (for the homepage component)
  const navigateToTab = (tabName) => {
    setActiveTab(tabName);
  };
  
  // Listen for window resize events
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Check roles directly from contracts - improved with multiple contract checks
  useEffect(() => {
    const checkRolesDirectly = async () => {
      if (!isConnected || !account) return;
      
      // Log which contract we're using to check roles
      console.log("Checking roles using contracts:", contracts);
      
      try {
        let isAdmin = false;
        let isGuardian = false;
        let isAnalytics = false;
        let isGovernance = false; // Added governance role check
        
        // Try using justToken first
        if (contracts.justToken) {
          try {
            isAdmin = await contracts.justToken.hasRole(ROLES.ADMIN_ROLE, account);
            isGuardian = await contracts.justToken.hasRole(ROLES.GUARDIAN_ROLE, account);
            isAnalytics = await contracts.justToken.hasRole(ROLES.ANALYTICS_ROLE, account);
            isGovernance = await contracts.justToken.hasRole(ROLES.GOVERNANCE_ROLE, account); // Check governance role
            console.log("Role check from justToken:", { isAdmin, isGuardian, isAnalytics, isGovernance });
          } catch (err) {
            console.warn("Error checking roles from justToken:", err);
          }
        }
        
        // Try using governance as fallback
        if ((!isAdmin || !isGuardian || !isAnalytics || !isGovernance) && contracts.governance) {
          try {
            if (!isAdmin) isAdmin = await contracts.governance.hasRole(ROLES.ADMIN_ROLE, account);
            if (!isGuardian) isGuardian = await contracts.governance.hasRole(ROLES.GUARDIAN_ROLE, account);
            if (!isAnalytics) isAnalytics = await contracts.governance.hasRole(ROLES.ANALYTICS_ROLE, account);
            if (!isGovernance) isGovernance = await contracts.governance.hasRole(ROLES.GOVERNANCE_ROLE, account); // Check governance role
            console.log("Role check from governance:", { isAdmin, isGuardian, isAnalytics, isGovernance });
          } catch (err) {
            console.warn("Error checking roles from governance:", err);
          }
        }
        
        // Try using timelock as another fallback
        if ((!isAdmin || !isGuardian || !isAnalytics || !isGovernance) && contracts.timelock) {
          try {
            if (!isAdmin) isAdmin = await contracts.timelock.hasRole(ROLES.ADMIN_ROLE, account);
            if (!isGuardian) isGuardian = await contracts.timelock.hasRole(ROLES.GUARDIAN_ROLE, account);
            if (!isAnalytics) isAnalytics = await contracts.timelock.hasRole(ROLES.ANALYTICS_ROLE, account);
            if (!isGovernance) isGovernance = await contracts.timelock.hasRole(ROLES.GOVERNANCE_ROLE, account); // Check governance role
            console.log("Role check from timelock:", { isAdmin, isGuardian, isAnalytics, isGovernance });
          } catch (err) {
            console.warn("Error checking roles from timelock:", err);
          }
        }
        
        // Save the results
        setUserRoles({
          isAdmin,
          isGuardian,
          isAnalytics,
          isGovernance // Include governance role
        });
        
      } catch (error) {
        console.error("Error checking roles directly:", error);
      }
    };
    
    checkRolesDirectly();
  }, [account, isConnected, contracts]);
  
  // Use our blockchain data context
  const { 
    userData, 
    daoStats, 
    isLoading: dataLoading, 
    refreshData, 
    getProposalVoteTotals 
  } = useBlockchainData();
  
  // Import delegationHook, proposalsHook, and votingHook as before
  // These would be used for actions, while our blockchain data context handles data fetching
  const { useDelegation } = require('../hooks/useDelegation');
  const { useProposals } = require('../hooks/useProposals');
  const { useVoting } = require('../hooks/useVoting');
  
  const delegation = useDelegation();
  const proposalsHook = useProposals();
  const votingHook = useVoting();
  
  
  
  // Format numbers based on window width
  const formatTokenBasedOnWidth = (value) => {
    if (!value) return '0';
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    
    // Determine decimal places based on window width and value size
    let decimals = 8; // Maximum decimals for full screen
  
    if (windowWidth < 640) {
      // Small screen (1/4 window)
      decimals = 4;
    } else if (windowWidth < 960) {
      // Medium screen (1/2 window)
      decimals = 6; 
    } else {
      // Full screen
      if (numValue >= 10000) {
        decimals = 4;
      } else if (numValue >= 1000) {
        decimals = 5;
      } else if (numValue >= 100) {
        decimals = 6;
      } else {
        decimals = 8;
      }
    }
    
    // For very small values, always show some precision
    if (numValue > 0 && numValue < 0.01) {
      decimals = Math.max(decimals, 6);
    }
    
    // Format the number with appropriate decimals
    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };
  
  // Format numbers to be more readable
  const formatNumber = (value, decimals = 2) => {
    // Handle potentially invalid input
    const numValue = safeStringToNumber(value);
    
    // If it's a whole number or very close to it, don't show decimals
    if (Math.abs(numValue - Math.round(numValue)) < 0.00001) {
      return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    
    // Format with the specified number of decimal places
    return numValue.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };
  
  // Helper function to properly detect self-delegation (copied from DelegationTab)
  const isSelfDelegated = (userAddress, delegateAddress) => {
    if (!userAddress || !delegateAddress) return true; // Default to self-delegated if addresses aren't available
    
    // Normalize addresses for comparison
    const normalizedUserAddr = userAddress.toLowerCase();
    const normalizedDelegateAddr = delegateAddress.toLowerCase();
    
    // Check if delegate is self or zero address
    return normalizedUserAddr === normalizedDelegateAddr || 
           delegateAddress === '0x0000000000000000000000000000000000000000';
  };

  // Get actual delegated tokens by excluding self if self-delegated (copied from DelegationTab)
  const actualDelegatedToYou = () => {
    // If no delegators, return 0
    if (!userData.delegators || userData.delegators.length === 0) {
      return "0";
    }
    
    // Calculate sum of all delegator balances
    return userData.delegators.reduce((sum, delegator) => {
      // Skip if the delegator is the user themselves (to avoid double counting)
      if (delegator.address.toLowerCase() === account.toLowerCase()) {
        return sum;
      }
      return sum + parseFloat(delegator.balance || "0");
    }, 0).toString();
  };

  // Calculate direct voting power without double counting (based on DelegationTab logic)
  const calculateDirectVotingPower = () => {
    // Check if user is self-delegated
    const selfDelegated = isSelfDelegated(account, userData.delegate);
    
    if (!selfDelegated) {
      return "0"; // Not self-delegated, no voting power
    }
    
    const ownBalance = parseFloat(userData.balance || "0");
    const delegatedTokens = parseFloat(actualDelegatedToYou());
    
    return (ownBalance + delegatedTokens).toString();
  };
  
  // Render security subcomponent based on securitySubtab state
  const renderSecuritySubtab = () => {
    switch (securitySubtab) {
      case 'emergency':
        return <EmergencyControlsTab contracts={contracts} account={account} hasRole={hasRole} />;
      case 'roles':
        return <RoleManagementTab contracts={contracts} />;
      case 'timelock':
        return <TimelockSettingsTab contracts={contracts} />;
      case 'pending':
        return <PendingTransactionsTab contracts={contracts} account={account} />;
      default:
        return <EmergencyControlsTab contracts={contracts} account={account} hasRole={hasRole} />;
    }
  };

  // Handle full app refresh
  const handleFullRefresh = () => {
    // Show visual feedback
    setIsRefreshing(true);
    
    // Call all available refresh functions
    refreshData();
    
    // Refresh proposals data if available
    if (proposalsHook && proposalsHook.fetchProposals) {
      proposalsHook.fetchProposals();
    }
    
    // Refresh voting data if available
    if (votingHook && votingHook.fetchVotes) {
      votingHook.fetchVotes();
    }
    
    // Refresh delegation data if available
    if (delegation && delegation.fetchDelegationInfo) {
      delegation.fetchDelegationInfo();
    }
    
    // Also refresh transitive voting power
    if (delegation && delegation.getEffectiveVotingPower && account) {
      delegation.getEffectiveVotingPower(account)
        .then(power => setTransitiveVotingPower(power))
        .catch(err => console.error("Error refreshing transitive voting power:", err));
    }
    
    // Reset animation after a delay
    setTimeout(() => setIsRefreshing(false), 1000);
    
    console.log("Full application refresh triggered");
  };
  
  // Handle tab-specific refresh button click
  const handleRefresh = () => {
    refreshData();
    
    // Also refresh transitive voting power
    if (delegation && delegation.getEffectiveVotingPower && account) {
      delegation.getEffectiveVotingPower(account)
        .then(power => setTransitiveVotingPower(power))
        .catch(err => console.error("Error refreshing transitive voting power:", err));
    }
  };

  // Get the correct voting power using the improved transitive calculation method
  const getCorrectVotingPower = () => {
    // First priority: Try to use the fetched transitive voting power if available
    if (transitiveVotingPower !== null) {
      console.log("Using transitive voting power from contract:", transitiveVotingPower);
      return transitiveVotingPower;
    }
    
    // Second priority: Try to use the delegationInfo.effectiveVotingPower if it exists
    if (delegation?.delegationInfo?.effectiveVotingPower) {
      console.log("Using effective voting power from delegationInfo:", delegation.delegationInfo.effectiveVotingPower);
      return delegation.delegationInfo.effectiveVotingPower;
    }
    
    // Check delegation status
    const selfDelegated = isSelfDelegated(account, userData.delegate);
    
    // If user has explicitly delegated to someone else, they have zero voting power
    if (!selfDelegated) {
      return "0"; // User has delegated voting power away
    }
    
    // Use the direct calculation as a fallback
    const calculatedVotingPower = calculateDirectVotingPower();
    
    // Only use fallback data from context if we couldn't calculate properly
    if (!calculatedVotingPower || parseFloat(calculatedVotingPower) === 0) {
      // Use the context values if available and user is self-delegated
      if (userData.onChainVotingPower && parseFloat(userData.onChainVotingPower) > 0) {
        return userData.onChainVotingPower;
      }
      return userData.votingPower;
    }
    
    return calculatedVotingPower;
  };
  useEffect(() => {
    console.log("Effect triggered", { isConnected, account, contracts: contracts.justToken, delegation });
    // ...
  }, [isConnected, account, contracts.justToken, delegation]);
  // Get label for Voting Power based on window width
  const getVotingPowerLabel = () => {
    if (windowWidth < 640) {
      return "VP";
    } else {
      return "Voting Power";
    }
  };

  return (
    <div className={`flex flex-col min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">JustDAO</h1>
          </div>
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{formatAddress(account)}</span>
                  {/* Dark mode toggle moved here and made smaller */}
                  <div className="ml-2 transform scale-90 mt-1">
                    <DarkModeToggle />
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatTokenBasedOnWidth(userData.balance)} JST</span>
                  <span>|</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatTokenBasedOnWidth(getCorrectVotingPower())} {getVotingPowerLabel()}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>Not connected</span>
                {/* Dark mode toggle for when not connected */}
                <div className="transform scale-90">
                  <DarkModeToggle />
                </div>
              </div>
            )}
            
            {isConnected ? (
              <div className="flex gap-2">
                <button 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center dark:bg-indigo-700 dark:hover:bg-indigo-600"
                  onClick={handleFullRefresh}
                  disabled={isRefreshing}
                >
                  <svg 
                    className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
                <button 
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md dark:bg-red-600 dark:hover:bg-red-500"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md dark:bg-indigo-700 dark:hover:bg-indigo-600"
                onClick={connectWallet}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs - Add Home tab as first item */}
      <div className="bg-white dark:bg-gray-800 shadow-sm mb-6 dark:shadow-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex overflow-x-auto">
            {/* Home tab - always visible to everyone */}
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'home' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
              onClick={() => setActiveTab('home')}
              data-tab="home"
            >
              Home
            </div>
            
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
              onClick={() => setActiveTab('dashboard')}
              data-tab="dashboard"
            >
              Dashboard
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'proposals' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
              onClick={() => setActiveTab('proposals')}
              data-tab="proposals"
            >
              Proposals
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'vote' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
              onClick={() => setActiveTab('vote')}
              data-tab="vote"
            >
              Vote
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'delegation' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
              onClick={() => setActiveTab('delegation')}
              data-tab="delegation"
            >
              Delegation
            </div>
            
            {/* Governance tab - only visible to users with GOVERNANCE_ROLE */}
            {(userRoles.isGovernance || hasRole(ROLES.GOVERNANCE_ROLE) || hasRole('governance')) && (
              <div 
                className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'governance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
                onClick={() => setActiveTab('governance')}
                data-tab="governance"
              >
                Governance
              </div>
            )}
            
            {/* Analytics tab - FIXED: only visible to users with analytics role */}
            {(() => {
              // Comprehensive analytics role check function
              const hasAnalyticsRole = () => {
                // Check through multiple methods
                // 1. Direct contract checks via userRoles state
                if (userRoles.isAnalytics) return true;
                
                // 2. Context-based role checks
                if (hasRole(ROLES.ANALYTICS_ROLE) || hasRole('analytics')) return true;
                
                // 3. Check via DAO Helper contract if available
                if (contracts.daoHelper) {
                  try {
                    // Call immediately and cache for future checks
                    contracts.daoHelper.hasRole(ROLES.ANALYTICS_ROLE, account)
                      .then(hasRole => {
                        if (hasRole) {
                          console.log("User has ANALYTICS_ROLE via daoHelper contract");
                          // Update role state for future checks
                          setUserRoles(prev => ({...prev, isAnalytics: true}));
                        }
                      })
                      .catch(error => console.warn("Error checking analytics role via daoHelper:", error));
                  } catch (err) {
                    console.warn("Could not check analytics role via helper contract", err);
                  }
                }
                
                // REMOVED FALLBACK FOR ADMIN/GUARDIAN ROLES
                // Only return true if explicitly has analytics role
                return false;
              };
              
              // Log all role check methods for debugging
              console.log("Analytics Role Status:", {
                "hasRole(ANALYTICS_ROLE)": hasRole(ROLES.ANALYTICS_ROLE),
                "hasRole('analytics')": hasRole('analytics'),
                "userRoles.isAnalytics": userRoles.isAnalytics,
                "hasHelperContract": !!contracts.daoHelper
              });
              
              return hasAnalyticsRole() && (
                <div 
                  className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'analytics' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
                  onClick={() => setActiveTab('analytics')}
                  data-tab="analytics"
                >
                  Analytics
                </div>
              );
            })()}
            
            {/* Security tab - only visible to admin or guardian roles */}
            {(userRoles.isAdmin || userRoles.isGuardian || hasRole(ROLES.ADMIN_ROLE) || hasRole(ROLES.GUARDIAN_ROLE) || hasRole('admin') || hasRole('guardian')) && (
              <div 
                className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'security' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'}`}
                onClick={() => {
                  setActiveTab('security');
                  setSecuritySubtab('emergency');
                }}
                data-tab="security"
              >
                Security
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Home tab - new addition */}
        {activeTab === 'home' && (
          <HomePage navigateToTab={navigateToTab} />
        )}
        
        {activeTab === 'dashboard' && (
          <DashboardTab 
            user={{
              ...userData,
              balance: formatTokenAmount(userData.balance),
              // Make sure we're using the right voting power value
              votingPower: formatTokenAmount(getCorrectVotingPower())
            }}
            stats={daoStats} 
            loading={dataLoading}
            proposals={proposalsHook.proposals
              .filter(p => safeStringToNumber(p.state) === PROPOSAL_STATES.ACTIVE)
              .map(p => ({
                ...p,
                state: safeStringToNumber(p.state),
                yesVotes: formatNumber(p.yesVotes),
                noVotes: formatNumber(p.noVotes),
                abstainVotes: formatNumber(p.abstainVotes),
                id: String(p.id),
                deadline: p.deadline instanceof Date ? p.deadline : new Date(),
                snapshotId: String(p.snapshotId)
              }))
            }
            getProposalVoteTotals={getProposalVoteTotals}
            onRefresh={handleRefresh}
          />
        )}
        
        {activeTab === 'proposals' && (
          <ProposalsTab 
            proposals={proposalsHook.proposals.map(proposal => ({
              ...proposal,
              id: String(proposal.id),
              state: safeStringToNumber(proposal.state),
              yesVotes: formatNumber(proposal.yesVotes),
              noVotes: formatNumber(proposal.noVotes),
              abstainVotes: formatNumber(proposal.abstainVotes),
              snapshotId: String(proposal.snapshotId)
            }))}
            createProposal={proposalsHook.createProposal}
            cancelProposal={proposalsHook.cancelProposal}
            queueProposal={proposalsHook.queueProposal}
            executeProposal={proposalsHook.executeProposal}
            claimRefund={proposalsHook.claimRefund}
            loading={proposalsHook.loading}
            contracts={contracts}
            account={account}
            fetchProposals={proposalsHook.fetchProposals}
          />
        )}
        
        {activeTab === 'vote' && (
          <VoteTab 
            proposals={proposalsHook.proposals.map(proposal => ({
              ...proposal,
              id: String(proposal.id),
              state: safeStringToNumber(proposal.state),
              yesVotes: formatNumber(proposal.yesVotes),
              noVotes: formatNumber(proposal.noVotes),
              abstainVotes: formatNumber(proposal.abstainVotes),
              snapshotId: String(proposal.snapshotId)
            }))}
            castVote={votingHook.castVote}
            hasVoted={votingHook.hasVoted}
            getVotingPower={votingHook.getVotingPower}
            voting={votingHook.voting}
            account={account}
          />
        )}
        
        {activeTab === 'delegation' && (
          <DelegationTab 
            user={{
              ...userData,
              address: account,
              balance: formatTokenAmount(userData.balance),
              // Pass transitive voting power to DelegationTab
              votingPower: formatTokenAmount(getCorrectVotingPower())
            }}
            delegation={{
              ...delegation,
              delegationInfo: {
                currentDelegate: userData.delegate,
                lockedTokens: userData.lockedTokens,
                delegatedToYou: userData.delegatedToYou,
                delegators: userData.delegators || [],
                // Pass the effective voting power to the delegationInfo
                effectiveVotingPower: transitiveVotingPower
              },
              loading: dataLoading
            }}
          />
        )}
        
        {/* Governance tab - only visible to users with GOVERNANCE_ROLE */}
        {activeTab === 'governance' && (userRoles.isGovernance || hasRole(ROLES.GOVERNANCE_ROLE) || hasRole('governance')) && (
          <GovernanceTab 
            contracts={contracts}
            account={account}
          />
        )}
        
        {/* Analytics tab - FIXED: only visible to users with analytics role */}
        {activeTab === 'analytics' && (() => {
          // Reuse the same comprehensive role check here
          const hasAnalyticsRole = () => {
            // Direct contract checks via userRoles state
            if (userRoles.isAnalytics) return true;
            
            // Context-based role checks
            if (hasRole(ROLES.ANALYTICS_ROLE) || hasRole('analytics')) return true;
            
            // Check via helper contract if available
            if (contracts.daoHelper) {
              try {
                // Make an immediate check for current rendering
                const hasAnalyticsRolePromise = contracts.daoHelper.hasRole(ROLES.ANALYTICS_ROLE, account);
                
                // If this is a promise (async), we'll need to handle it properly
                if (hasAnalyticsRolePromise && hasAnalyticsRolePromise.then) {
                  // Start the async check in case we need it later
                  hasAnalyticsRolePromise.then(hasRole => {
                    if (hasRole) {
                      setUserRoles(prev => ({...prev, isAnalytics: true}));
                    }
                  });
                } else if (hasAnalyticsRolePromise === true) {
                  return true;
                }
              } catch (err) {
                console.warn("Error in hasAnalyticsRole daoHelper check:", err);
              }
            }
            
            // For demonstration, enable this for any user with admin or guardian role
            return userRoles.isAdmin || userRoles.isGuardian || 
                   hasRole(ROLES.ADMIN_ROLE) || hasRole(ROLES.GUARDIAN_ROLE) ||
                   hasRole('admin') || hasRole('guardian');
          };
          
          return hasAnalyticsRole();
        })() && (
          <AnalyticsTab />
        )}
        
        {activeTab === 'security' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold dark:text-white">Security & Administration</h2>
              <p className="text-gray-500 dark:text-gray-400">Manage security settings and administrative functions</p>
            </div>
            
            {/* Security Subtabs */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700 mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'emergency' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                  onClick={() => setSecuritySubtab('emergency')}
                >
                  Emergency Controls
                </button>
                
                {/* Pending Transactions tab - visible to both admin and guardian roles */}
                <button
                  className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'pending' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                  onClick={() => setSecuritySubtab('pending')}
                >
                  Pending Transactions
                </button>
                
                {/* These tabs are only visible to admin roles */}
                {(userRoles.isAdmin || hasRole(ROLES.ADMIN_ROLE) || hasRole('admin')) && (
                  <>
                    <button
                      className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'roles' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                      onClick={() => setSecuritySubtab('roles')}
                    >
                      Role Management
                    </button>
                    
                    <button
                      className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'timelock' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                      onClick={() => setSecuritySubtab('timelock')}
                    >
                      Timelock Settings
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Render the selected security subtab */}
            {renderSecuritySubtab()}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          JustDAO &copy; {new Date().getFullYear()} - Powered by JustDAO Governance Framework
        </div>
      </footer>
    </div>
  );
};
const fetchWithTimeout = async (promise, ms = 5000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
  });

  try {
    const result = await Promise.race([
      promise,
      timeoutPromise
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Wrapping the main component with DarkModeProvider
const JustDAODashboard = () => {
  return (
    <DarkModeProvider>
      <JustDAOContent />
    </DarkModeProvider>
  );
};

export default JustDAODashboard;