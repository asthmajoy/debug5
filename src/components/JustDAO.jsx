import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { useAuth } from '../contexts/AuthContext';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { formatAddress } from '../utils/formatters';
import { formatTokenAmount } from '../utils/tokenFormatters';
import { PROPOSAL_STATES } from '../utils/constants';
import { ethers } from 'ethers';

// Import components
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

const JustDAODashboard = () => {
  // State for active tab
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State for active security subtab
  const [securitySubtab, setSecuritySubtab] = useState('emergency');
  
  // State to track window width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  // State to track user roles directly from contract
  const [userRoles, setUserRoles] = useState({
    isAdmin: false,
    isGuardian: false,
    isAnalytics: false,
  });
  
  // Web3 context for blockchain connection
  const { account, isConnected, connectWallet, disconnectWallet, contracts } = useWeb3();
  
  // Auth context for user roles
  const { hasRole } = useAuth();
  
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
  
  // Check roles directly from contracts
  useEffect(() => {
    const checkRolesDirectly = async () => {
      if (!isConnected || !account || !contracts.analyticsHelper) return;
      
      try {
        // Get role information directly from the contracts
        const isAdmin = await contracts.analyticsHelper.hasRole(ROLES.ADMIN_ROLE, account);
        const isGuardian = await contracts.analyticsHelper.hasRole(ROLES.GUARDIAN_ROLE, account);
        const isAnalytics = await contracts.analyticsHelper.hasRole(ROLES.ANALYTICS_ROLE, account);
        
        console.log("Direct role check from contract:", {
          isAdmin,
          isGuardian,
          isAnalytics,
        });
        
        setUserRoles({
          isAdmin,
          isGuardian,
          isAnalytics
        });
        
      } catch (error) {
        console.error("Error checking roles directly:", error);
      }
    };
    
    checkRolesDirectly();
  }, [account, isConnected, contracts.analyticsHelper]);
  
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
    let decimals = 5; // Maximum decimals for full screen
    
    if (windowWidth < 640) {
      // Small screen (1/4 window)
      decimals = 2;
    } else if (windowWidth < 960) {
      // Medium screen (1/2 window)
      decimals = 3; 
    } else {
      // Full screen
      if (numValue >= 10000) {
        decimals = 2;
      } else if (numValue >= 1000) {
        decimals = 3;
      } else if (numValue >= 100) {
        decimals = 4;
      } else {
        decimals = 5;
      }
    }
    
    // For very small values, always show some precision
    if (numValue > 0 && numValue < 0.01) {
      decimals = Math.max(decimals, 4);
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

  // Calculate proper voting power without double counting (based on DelegationTab logic)
  const calculateVotingPower = () => {
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

  // Handle manual refresh button click
  const handleRefresh = () => {
    refreshData();
  };

  // Get the correct voting power using the improved calculation
  const getCorrectVotingPower = () => {
    // Check delegation status first
    const selfDelegated = isSelfDelegated(account, userData.delegate);
    
    // If user has explicitly delegated to someone else, they have zero voting power
    if (!selfDelegated) {
      return "0"; // User has delegated voting power away
    }
    
    // Use the new calculation that avoids double counting
    const calculatedVotingPower = calculateVotingPower();
    
    // Only use fallback logic if we couldn't calculate properly AND user is self-delegated
    if (!calculatedVotingPower || parseFloat(calculatedVotingPower) === 0) {
      // Original fallback logic, only used when self-delegated
      if (userData.onChainVotingPower && parseFloat(userData.onChainVotingPower) > 0) {
        return userData.onChainVotingPower;
      }
      return userData.votingPower;
    }
    
    return calculatedVotingPower;
  };

  // Get label for Voting Power based on window width
  const getVotingPowerLabel = () => {
    if (windowWidth < 640) {
      return "VP";
    } else {
      return "Voting Power";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-indigo-600">JustDAO</h1>
          </div>
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="text-sm text-gray-700">
                <div>{formatAddress(account)}</div>
                <div className="flex gap-2">
                  <span>{formatTokenBasedOnWidth(userData.balance)} JST</span>
                  <span>|</span>
                  <span>{formatTokenBasedOnWidth(getCorrectVotingPower())} {getVotingPowerLabel()}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-700">Not connected</div>
            )}
            {isConnected ? (
              <div className="flex gap-2">
                <button 
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                onClick={connectWallet}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex overflow-x-auto">
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('dashboard')}
              data-tab="dashboard"
            >
              Dashboard
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'proposals' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('proposals')}
              data-tab="proposals"
            >
              Proposals
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'vote' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('vote')}
              data-tab="vote"
            >
              Vote
            </div>
            <div 
              className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'delegation' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('delegation')}
              data-tab="delegation"
            >
              Delegation
            </div>
            
            {/* Analytics tab - using direct contract role check + fallbacks */}
            {(userRoles.isAnalytics || hasRole(ROLES.ANALYTICS_ROLE) || hasRole('analytics')) && (
              <div 
                className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'analytics' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('analytics')}
                data-tab="analytics"
              >
                Analytics
              </div>
            )}
            
            {/* Security tab - only visible to admin or guardian roles */}
            {(userRoles.isAdmin || userRoles.isGuardian || hasRole(ROLES.ADMIN_ROLE) || hasRole(ROLES.GUARDIAN_ROLE) || hasRole('admin') || hasRole('guardian')) && (
              <div 
                className={`py-4 px-6 cursor-pointer border-b-2 ${activeTab === 'security' ? 'border-indigo-500 text-indigo-600' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
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
              // Use the same helper function for consistency
              votingPower: formatTokenAmount(getCorrectVotingPower())
            }}
            delegation={{
              ...delegation,
              delegationInfo: {
                currentDelegate: userData.delegate,
                lockedTokens: userData.lockedTokens,
                delegatedToYou: userData.delegatedToYou,
                delegators: userData.delegators || []
              },
              loading: dataLoading
            }}
          />
        )}
        
        {/* Analytics tab */}
        {activeTab === 'analytics' && (userRoles.isAnalytics || hasRole(ROLES.ANALYTICS_ROLE) || hasRole('analytics')) && (
          <AnalyticsTab contract={contracts.analyticsHelper} />
        )}
        
        {activeTab === 'security' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Security & Administration</h2>
              <p className="text-gray-500">Manage security settings and administrative functions</p>
            </div>
            
            {/* Security Subtabs */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'emergency' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
                  onClick={() => setSecuritySubtab('emergency')}
                >
                  Emergency Controls
                </button>
                
                {/* Pending Transactions tab - visible to both admin and guardian roles */}
                <button
                  className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'pending' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
                  onClick={() => setSecuritySubtab('pending')}
                >
                  Pending Transactions
                </button>
                
                {/* These tabs are only visible to admin roles */}
                {(userRoles.isAdmin || hasRole(ROLES.ADMIN_ROLE) || hasRole('admin')) && (
                  <>
                    <button
                      className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'roles' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
                      onClick={() => setSecuritySubtab('roles')}
                    >
                      Role Management
                    </button>
                    
                    <button
                      className={`px-3 py-1 rounded-full text-sm ${securitySubtab === 'timelock' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
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
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          JustDAO &copy; {new Date().getFullYear()} - Powered by JustDAO Governance Framework
        </div>
      </footer>
    </div>
  );
};

export default JustDAODashboard;