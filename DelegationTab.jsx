import React, { useState, useEffect } from 'react';
import { formatAddress } from '../utils/formatters';
import Loader from './Loader';
import { 
  ArrowRight, 
  RotateCcw, 
  Users, 
  Wallet, 
  Lock, 
  Zap,
  Info
} from 'lucide-react';

const DelegationTab = ({ user, delegation }) => {
  // Component state
  const [delegateAddress, setDelegateAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingPower, setVotingPower] = useState("0.00000000");
  const [showDelegationChain, setShowDelegationChain] = useState(false);
  const [delegationPath, setDelegationPath] = useState([]);

  // Debug logging
  console.log("DelegationTab rendered, activeTab should be 'delegation'");
  console.log("Delegation prop:", delegation);
  console.log("User prop:", user);

  // Handle the case where delegation might be undefined
  const delegationInfo = delegation?.delegationInfo || {
    currentDelegate: null,
    lockedTokens: "0",
    delegatedToYou: "0",
    delegators: [],
    delegationChain: [],
    effectiveVotingPower: "0"
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

  // Fetch the voting power when component loads
  useEffect(() => {
    const fetchVotingPower = async () => {
      if (delegation?.getEffectiveVotingPower && user?.address) {
        try {
          const power = await delegation.getEffectiveVotingPower(user.address);
          setVotingPower(power);
        } catch (error) {
          console.error("Error fetching voting power:", error);
        }
      } else if (delegationInfo.effectiveVotingPower) {
        // Use the value from delegationInfo if available
        setVotingPower(delegationInfo.effectiveVotingPower);
      }
    };
    
    fetchVotingPower();
  }, [delegation, user?.address, user?.balance, delegationInfo?.currentDelegate, delegationInfo?.effectiveVotingPower]);

  // Fetch delegation path when component loads or when delegation changes
  useEffect(() => {
    const fetchDelegationPath = async () => {
      if (delegation?.getDelegationPath && user?.address) {
        try {
          const path = await delegation.getDelegationPath(user.address);
          setDelegationPath(path || []);
        } catch (error) {
          console.error("Error fetching delegation path:", error);
          setDelegationPath([]);
        }
      } else {
        setDelegationPath([]);
      }
    };
    
    fetchDelegationPath();
  }, [delegation, user?.address, delegationInfo?.currentDelegate]);

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

  // Determine delegation status
  const userAddress = user?.address || '';
  const currentDelegate = delegationInfo?.currentDelegate || '';
  const selfDelegated = isSelfDelegated(userAddress, currentDelegate);

  // Get directly delegated tokens (excluding self)
  const getDirectDelegatedToYou = () => {
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

  // FIXED: Get full transitive delegated tokens accounting for multi-level delegation
  const getFullTransitiveDelegation = () => {
    // If we have effectiveVotingPower, we calculate the transitive delegation
    // ONLY if user is self-delegated (not delegating to anyone else)
    if (delegationInfo.effectiveVotingPower && selfDelegated) {
      const effectivePower = parseFloat(delegationInfo.effectiveVotingPower || "0");
      const ownBalance = parseFloat(user?.balance || "0");
      
      // Transitive delegation is effective power minus own balance
      const transitiveDelegation = Math.max(0, effectivePower - ownBalance);
      return transitiveDelegation.toString();
    }
    
    // If user has delegated to someone else but has delegators themselves,
    // we need to properly account for "pass-through" tokens
    if (!selfDelegated && delegationInfo.delegators && delegationInfo.delegators.length > 0) {
      // In this case, we still count direct delegators but we clearly 
      // mark them as "passing through" to the ultimate delegate
      return getDirectDelegatedToYou();
    }
    
    // Fallback: only direct delegations
    return getDirectDelegatedToYou();
  };

  // Calculate proper voting power - use the effective voting power from contract
  const getDisplayVotingPower = () => {
    // Use the delegationInfo.effectiveVotingPower if available, otherwise use the fetched votingPower
    return delegationInfo.effectiveVotingPower || votingPower || "0.00000000";
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

  // Check if user is part of a delegation chain (is delegating to someone else)
  const isPartOfDelegationChain = () => {
    return !selfDelegated && currentDelegate !== '';
  };

  // Check if there's transitive delegation beyond direct delegators
  const hasTransitiveDelegation = () => {
    const directDelegation = parseFloat(getDirectDelegatedToYou());
    const fullTransitiveDelegation = parseFloat(getFullTransitiveDelegation());
    
    // If the full transitive delegation is significantly larger than direct delegation, we have transitive flow
    return fullTransitiveDelegation > (directDelegation + 0.00001);
  };

  // Get the amount of transitive delegation beyond direct delegators
  const getTransitiveDelegationDifference = () => {
    const directDelegation = parseFloat(getDirectDelegatedToYou());
    const fullTransitiveDelegation = parseFloat(getFullTransitiveDelegation());
    
    return Math.max(0, fullTransitiveDelegation - directDelegation).toString();
  };

  // ADDED: Calculate the ultimate delegate in a delegation chain
  const getUltimateDelegate = () => {
    if (selfDelegated || !currentDelegate) {
      return userAddress;
    }
    
    // If we have a delegation path, return the last address in that path
    if (delegationPath && delegationPath.length > 0) {
      return delegationPath[delegationPath.length - 1];
    }
    
    // Fallback to just the current delegate
    return currentDelegate;
  };

  // ADDED: Render the delegation chain/path
  const renderDelegationChain = () => {
    if (!isPartOfDelegationChain() || !delegationPath || delegationPath.length <= 1) {
      return null;
    }
    
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mb-4">
        <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">Delegation Chain:</h5>
        <div className="flex flex-wrap items-center text-sm">
          {delegationPath.map((address, idx) => (
            <React.Fragment key={idx}>
              <span className={`px-2 py-1 rounded-md ${address.toLowerCase() === userAddress.toLowerCase() 
                ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {formatAddress(address)}
              </span>
              {idx < delegationPath.length - 1 && (
                <ArrowRight className="mx-1 w-4 h-4 text-gray-400" />
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {delegationPath.length > 2 
            ? "Your voting power passes through this delegation chain."
            : "Your voting power is delegated to this address."}
        </p>
      </div>
    );
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
      
      // Refresh voting power after delegation
      if (delegation?.getEffectiveVotingPower && user?.address) {
        try {
          const newPower = await delegation.getEffectiveVotingPower(user.address);
          setVotingPower(newPower);
        } catch (error) {
          console.error("Error updating voting power after delegation:", error);
        }
      }

      // Refresh delegation path
      if (delegation?.getDelegationPath && user?.address) {
        try {
          const path = await delegation.getDelegationPath(user.address);
          setDelegationPath(path || []);
        } catch (error) {
          console.error("Error updating delegation path:", error);
        }
      }
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
      
      // Refresh voting power after resetting delegation
      if (delegation?.getEffectiveVotingPower && user?.address) {
        try {
          const newPower = await delegation.getEffectiveVotingPower(user.address);
          setVotingPower(newPower);
        } catch (error) {
          console.error("Error updating voting power after reset:", error);
        }
      }

      // Reset delegation path
      setDelegationPath([]);
    } catch (error) {
      console.error("Error resetting delegation:", error);
      alert("Error resetting delegation. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Main stats cards with updated display logic
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
      value: `${formatToEightDecimals(getDisplayVotingPower())} JST`,
      icon: <Zap className="w-5 h-5" />
    }
  ];

  // ADDED: ultimateDelegate reference for UI clarity
  const ultimateDelegate = getUltimateDelegate();
  const ultimateDelegateIsSelf = ultimateDelegate.toLowerCase() === userAddress.toLowerCase();

  return (
    <div className="transition-colors duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors duration-300">Delegation</h2>
        <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300 mt-1">
          Manage your voting power delegation and see how token voting power flows through the system
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="large" text="Loading delegation data..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main cards - horizontal stacking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Your Delegation Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
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
                
                {/* ADDED: Delegation chain visualization */}
                {renderDelegationChain()}
                
                {/* ADDED: Ultimate delegate indicator for users who are delegating */}
                {!selfDelegated && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mb-6">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                        Ultimate Delegate:
                      </h5>
                      <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium">
                        {formatAddress(ultimateDelegate)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {ultimateDelegateIsSelf 
                        ? "Your delegation forms a circular path back to you." 
                        : `Your voting power ultimately flows to this address.`}
                    </p>
                  </div>
                )}
                
                {/* Delegation actions */}
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

            {/* Delegated to you card */}
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
                      {formatToFiveDecimals(getFullTransitiveDelegation())}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">JST tokens</p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 transition-colors duration-300">
                  {/* FIXED: Message about pass-through delegation */}
                  {!selfDelegated && parseFloat(getFullTransitiveDelegation()) > 0 ? (
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        You have {formatToFiveDecimals(getFullTransitiveDelegation())} JST tokens delegated to your address.
                      </p>
                     
                    </div>
                  ) : parseFloat(getFullTransitiveDelegation()) > 0 ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      You have {formatToFiveDecimals(getFullTransitiveDelegation())} JST tokens delegated to your address.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      No tokens delegated to you yet.
                    </p>
                  )}
                </div>
                
                {/* Delegators section - now with transitive tracking */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 transition-colors duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">All Delegations to You:</h4>
                    <div>
                      <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md">
                        Total: {formatToFiveDecimals(getFullTransitiveDelegation())} JST
                      </span>
                    </div>
                  </div>
                  
                  {/* Direct delegators list */}
                  {hasRealDelegators() ? (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Direct Delegators:
                        </h5>
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                          {formatToFiveDecimals(getDirectDelegatedToYou())} JST
                        </span>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2 mb-4">
                        {delegationInfo.delegators
                          .filter(delegator => delegator.address.toLowerCase() !== userAddress.toLowerCase())
                          .map((delegator, idx) => (
                            <div 
                              key={idx} 
                              className="text-sm flex justify-between items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors duration-150"
                            >
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatAddress(delegator.address)}
                                {!selfDelegated && (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                                    (flows through)
                                  </span>
                                )}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-gray-200 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full text-xs">
                                {formatToFiveDecimals(delegator.balance)} JST
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 text-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No direct delegators</p>
                    </div>
                  )}
                  
                  {/* Transitive delegation summary card */}
                  {hasTransitiveDelegation() ? (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400">Transitive Delegations:</h5>
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                          {formatToFiveDecimals(getTransitiveDelegationDifference())} JST
                        </span>
                      </div>
                      
                      {/* Add transitive delegator details */}
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Transitive Flow</span>
                          <span className="text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full">
                            {formatToFiveDecimals(getTransitiveDelegationDifference())} JST
                          </span>
                        </div>
                        
                        {/* Remove the Delegation Chain Total entry and explanatory text */}
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-sm text-indigo-700 dark:text-indigo-300">Additional indirect delegation</span>
                          </div>
                          <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                            {formatToFiveDecimals(getTransitiveDelegationDifference())} JST
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : parseFloat(getFullTransitiveDelegation()) > 0 ? (
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        All your delegation is from direct delegators
                      </p>
                    </div>
                  ) : (
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No delegations received
                      </p>
                    </div>
                  )}
                </div>
                
                {/* ADDED: Warning box for users who have delegates but are delegating to someone else */}
                {!selfDelegated && hasRealDelegators() && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-amber-500 dark:text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                          Delegation Pass-Through
                        </h5>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Since you've delegated your voting power to {formatAddress(currentDelegate)}, 
                          all tokens delegated to you will also flow to your delegate 
                          {!ultimateDelegateIsSelf && ` and ultimately to ${formatAddress(ultimateDelegate)}`}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelegationTab;