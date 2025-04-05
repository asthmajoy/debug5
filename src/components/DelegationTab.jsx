import React, { useState, useEffect } from 'react';
import { formatAddress } from '../utils/formatters';
import Loader from './Loader';
import { ArrowRight, RotateCcw, Users, Wallet, Lock, Zap } from 'lucide-react';

const DelegationTab = ({ user, delegation }) => {
  // Add debugging
  console.log("DelegationTab rendered, activeTab should be 'delegation'");
  console.log("Delegation prop:", delegation);
  console.log("User prop:", user);

  const [delegateAddress, setDelegateAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle the case where delegation might be undefined
  const delegationInfo = delegation?.delegationInfo || {
    currentDelegate: null,
    lockedTokens: "0",
    delegatedToYou: "0",
    delegators: []
  };
  const loading = delegation?.loading || false;
  const delegate = delegation?.delegate || (() => {
    console.error("Delegation function not available");
    alert("Delegation feature not available");
  });
  const resetDelegation = delegation?.resetDelegation || (() => {
    console.error("Reset delegation function not available");
    alert("Reset delegation feature not available");
  });
  const getDelegationDepthWarning = delegation?.getDelegationDepthWarning || (() => {
    return { warningLevel: 0, message: "Delegation depth check not available" };
  });

  // Helper function to properly detect self-delegation
  const isSelfDelegated = (userAddress, delegateAddress) => {
    if (!userAddress || !delegateAddress) return true; // Default to self-delegated if addresses aren't available
    
    // Normalize addresses for comparison
    const normalizedUserAddr = userAddress.toLowerCase();
    const normalizedDelegateAddr = delegateAddress.toLowerCase();
    
    // Check if delegate is self or zero address
    return normalizedUserAddr === normalizedDelegateAddr || 
           delegateAddress === '0x0000000000000000000000000000000000000000';
  };

  // Format numbers with more precision for specific values
  const formatToFiveDecimals = (value) => {
    if (!value) return "0.00000";
    return parseFloat(value).toFixed(5);
  };
  
  // Format with 8 decimal places for locked tokens and voting power
  const formatToEightDecimals = (value) => {
    if (!value) return "0.00000000";
    return parseFloat(value).toFixed(8);
  };

  // Determine delegation status directly in the component
  // Handle potentially missing user address or currentDelegate
  const userAddress = user?.address || '';
  const currentDelegate = delegationInfo?.currentDelegate || '';
  const selfDelegated = isSelfDelegated(userAddress, currentDelegate);

  // Get actual delegated tokens by excluding self if self-delegated
  const actualDelegatedToYou = () => {
    // If no delegators, return 0
    if (!delegationInfo.delegators || delegationInfo.delegators.length === 0) {
      return "0";
    }
    
    // Calculate sum of all delegator balances
    return delegationInfo.delegators.reduce((sum, delegator) => {
      // Skip if the delegator is the user themselves (to avoid double counting)
      if (delegator.address.toLowerCase() === userAddress.toLowerCase()) {
        return sum;
      }
      return sum + parseFloat(delegator.balance || "0");
    }, 0).toString();
  };

  const handleDelegate = async () => {
    if (!delegateAddress) return;
    
    // Make sure user address exists
    if (!user?.address) {
      alert("User address not available");
      return;
    }
    
    // Prevent self-delegation via the form - should use reset instead
    if (delegateAddress.toLowerCase() === user.address.toLowerCase()) {
      return handleResetDelegation();
    }
    
    try {
      setIsSubmitting(true);
      // Check for potential delegation depth issues
      const warning = await getDelegationDepthWarning(user.address, delegateAddress);
      
      if (warning.warningLevel === 3) {
        alert("This delegation would exceed the maximum delegation depth limit or create a cycle");
        return;
      } else if (warning.warningLevel > 0) {
        const proceed = window.confirm(warning.message + ". Do you want to proceed?");
        if (!proceed) return;
      }
      
      await delegate(delegateAddress);
      setDelegateAddress('');
    } catch (error) {
      console.error("Error delegating:", error);
      alert("Error delegating. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDelegation = async () => {
    try {
      setIsSubmitting(true);
      await resetDelegation();
      setDelegateAddress('');
    } catch (error) {
      console.error("Error resetting delegation:", error);
      alert("Error resetting delegation. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate proper voting power without double counting
  const calculateVotingPower = () => {
    if (!selfDelegated) {
      return "0.00000000"; // Not self-delegated, no voting power
    }
    
    const ownBalance = parseFloat(user?.balance || "0");
    
    // Only add actual delegated tokens (excluding self)
    const delegatedTokens = parseFloat(actualDelegatedToYou());
    
    return (ownBalance + delegatedTokens).toString();
  };

  // Check if there are actual delegators (excluding self)
  const hasRealDelegators = () => {
    if (!delegationInfo.delegators || delegationInfo.delegators.length === 0) {
      return false;
    }
    
    // Check if there are delegators other than the user themselves
    return delegationInfo.delegators.some(delegator => 
      delegator.address.toLowerCase() !== userAddress.toLowerCase()
    );
  };

  const statCards = [
    {
      title: "Current Delegate",
      value: selfDelegated ? 
        `${userAddress ? formatAddress(userAddress) : 'Self'} (Self)` : 
        currentDelegate ? formatAddress(currentDelegate) : 'Unknown',
      icon: <Users className="w-5 h-5" />
    },
    {
      title: "Locked Tokens",
      value: `${selfDelegated ? "0.00000000" : formatToEightDecimals(user?.balance)} JST`,
      icon: <Lock className="w-5 h-5" />
    },
    {
      title: "Your Balance",
      value: `${formatToFiveDecimals(user?.balance)} JST`,
      icon: <Wallet className="w-5 h-5" />
    },
    {
      title: "Your Voting Power",
      value: `${formatToEightDecimals(calculateVotingPower())} JST`,
      icon: <Zap className="w-5 h-5" />
    }
  ];

  return (
    <div className="transition-colors duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors duration-300">Delegation</h2>
        <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300 mt-1">
          Manage your voting power delegation
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="large" text="Loading delegation data..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Your delegation status */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-600/20 dark:to-purple-600/20 py-4 px-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Your Delegation Status
              </h3>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {statCards.map((card, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 transition-colors duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.title}</p>
                        <p className="text-lg font-semibold text-gray-800 dark:text-white">{card.value}</p>
                      </div>
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        {card.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 transition-colors duration-300">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delegate Your Voting Power</label>
                  <div className="flex space-x-3">
                    <input 
                      type="text" 
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:bg-gray-800 dark:text-white transition-colors duration-300 placeholder-gray-400 dark:placeholder-gray-500" 
                      placeholder="Enter delegate address (0x...)" 
                      value={delegateAddress}
                      onChange={(e) => setDelegateAddress(e.target.value)}
                    />
                    <button 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg shadow-sm hover:shadow transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      onClick={handleDelegate}
                      disabled={!user?.balance || parseFloat(user?.balance || "0") === 0 || isSubmitting}
                    >
                      {isSubmitting ? "Processing..." : "Delegate"}
                      {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Delegating transfers your voting power but allows you to maintain token ownership.
                    {!selfDelegated && " Your tokens are locked while delegated."}
                  </p>
                </div>
                
                {!selfDelegated && (
                  <div className="text-center">
                    <button 
                      className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-5 py-3 rounded-lg font-medium transition-colors duration-300"
                      onClick={handleResetDelegation}
                      disabled={isSubmitting}
                    >
                      <RotateCcw className="w-4 h-4" />
                      {isSubmitting ? "Processing..." : "Reset Delegation (Self-Delegate)"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Delegated to you */}
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-600/20 dark:to-teal-600/20 py-4 px-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Delegated to You
              </h3>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-36 h-36 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3 shadow-md">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatToFiveDecimals(actualDelegatedToYou())}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">JST tokens</p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 transition-colors duration-300">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {parseFloat(actualDelegatedToYou()) > 0 
                    ? `You have ${formatToFiveDecimals(actualDelegatedToYou())} JST tokens delegated to your address from other token holders.`
                    : "No tokens delegated to you yet."}
                </p>
              </div>
              
              {hasRealDelegators() ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 transition-colors duration-300">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Your Delegators:</h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                    {delegationInfo.delegators
                      .filter(delegator => delegator.address.toLowerCase() !== userAddress.toLowerCase())
                      .map((delegator, idx) => (
                        <div 
                          key={idx} 
                          className="text-sm flex justify-between items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors duration-150"
                        >
                          <span className="text-gray-600 dark:text-gray-400">{formatAddress(delegator.address)}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full text-xs">
                            {formatToFiveDecimals(delegator.balance)} JST
                          </span>
                        </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center transition-colors duration-300">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No delegators yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelegationTab;