import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { formatAddress } from '../utils/formatters';
import Loader from './Loader';
import { 
  ArrowRight, 
  RotateCcw, 
  Users, 
  Wallet, 
  Lock, 
  Zap,
  Info,
  Camera,
  ArrowUpRight
} from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';

const DelegationTab = ({ user, delegation }) => {
  // Component state
  const [delegateAddress, setDelegateAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingPower, setVotingPower] = useState("0.00000000");
  const [delegationPath, setDelegationPath] = useState([]);
  const [currentSnapshotId, setCurrentSnapshotId] = useState(null);
  const [directDelegations, setDirectDelegations] = useState("0");
  const [indirectDelegations, setIndirectDelegations] = useState("0");
  const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);
  const [proposerStake, setProposerStake] = useState(0);
  const [isProposer, setIsProposer] = useState(false);
  
  // Get Web3 context to access contracts - same as VoteTab
  const { contracts, contractsReady, account } = useWeb3();
  
  // Use ref to track if component is mounted and prevent memory leaks
  const mountedRef = useRef(true);
  
  // Use a ref to track last calculation inputs to prevent redundant recalculations
  const lastCalculationRef = useRef({
    votingPower: "0",
    directDelegations: "0",
    userBalance: "0",
    isProposer: false,
    proposerStake: 0
  });
  
  // Debounce timers
  const timersRef = useRef({
    fetchDelegation: null,
    fetchVotingPower: null
  });

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

  // Helper function to properly detect self-delegation - memoized
  const isSelfDelegated = useCallback((userAddress, delegateAddress) => {
    if (!userAddress || !delegateAddress) return true; // Default to self-delegated if addresses aren't available
    
    // Normalize addresses for comparison
    const normalizedUserAddr = userAddress.toLowerCase();
    const normalizedDelegateAddr = delegateAddress.toLowerCase();
    
    // Check if delegate is self or zero address
    return normalizedUserAddr === normalizedDelegateAddr || 
           delegateAddress === '0x0000000000000000000000000000000000000000';
  }, []);

  // Set mountedRef to false when component unmounts
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      
      // Clear any pending timers
      if (timersRef.current.fetchDelegation) {
        clearTimeout(timersRef.current.fetchDelegation);
      }
      if (timersRef.current.fetchVotingPower) {
        clearTimeout(timersRef.current.fetchVotingPower);
      }
    };
  }, []);

  // Fetch snapshot ID only once when contracts are ready
  useEffect(() => {
    if (!contractsReady || !contracts?.justToken) return;
    
    let isCancelled = false;
    
    const fetchSnapshotId = async () => {
      try {
        // Try multiple method variations
        const methodVariations = [
          'getCurrentSnapshotId',
          'get_current_snapshot_id',
          'currentSnapshotId',
          '_getCurrentSnapshotId'
        ];
  
        let id = null;
        for (const methodName of methodVariations) {
          if (isCancelled) return;
          
          try {
            if (typeof contracts.justToken[methodName] === 'function') {
              id = await contracts.justToken[methodName]();
              break;
            }
          } catch (methodError) {
            // Silently continue to next method
          }
        }
  
        if (!isCancelled && id && mountedRef.current) {
          setCurrentSnapshotId(id.toString());
        }
      } catch (error) {
        // Log error but don't update state if cancelled
        if (!isCancelled) {
          console.error("Error fetching snapshot ID:", error);
        }
      }
    };
  
    fetchSnapshotId();
    
    return () => {
      isCancelled = true;
    };
  }, [contractsReady, contracts?.justToken]);

  // Fetch delegation path - memoize the function to use in dependency array
  const fetchDelegationPath = useCallback(async () => {
    if (!delegation?.getDelegationPath || !user?.address || !mountedRef.current) return;
    
    try {
      const path = await delegation.getDelegationPath(user.address);
      if (mountedRef.current) {
        setDelegationPath(path || []);
      }
    } catch (error) {
      if (mountedRef.current) {
        console.error("Error fetching delegation path:", error);
        setDelegationPath([]);
      }
    }
  }, [delegation, user?.address]);

  // Effect for delegation path - with stable dependency
  useEffect(() => {
    fetchDelegationPath();
  }, [fetchDelegationPath, delegationInfo?.currentDelegate]);

  // Simplify this to avoid unnecessary dependencies
  const delegatorAddresses = delegationInfo.delegators?.map(d => d.address) || [];
// Calculate indirect delegations - without conditional logic
const calculateIndirectDelegations = useCallback((directDelegations, isUserProposer, stakeAmount) => {
  // Get inputs
  const votingPowerValue = parseFloat(votingPower || "0");
  const directValue = parseFloat(directDelegations || "0");
  const ownBalance = parseFloat(user?.balance || "0");
  
  // Always calculate the adjustment regardless of conditions
  const adjustedStakeAmount = isUserProposer ? stakeAmount : 0;
  
  // Calculate indirect by taking total voting power and subtracting components
  const indirectValue = Math.max(0, votingPowerValue - ownBalance - directValue - adjustedStakeAmount);
  
  // Always update the cache with current values
  lastCalculationRef.current = {
    votingPower: votingPowerValue.toString(),
    directDelegations: directValue.toString(),
    userBalance: ownBalance.toString(),
    isProposer: isUserProposer,
    proposerStake: stakeAmount,
    indirectValue: indirectValue.toString()
  };
  
  return indirectValue;
}, [votingPower, user?.balance]);

// Improved proposer status check method with better error handling
const checkProposerStatus = useCallback(async () => {
  try {
    // Ensure we have the necessary objects
    if (!contracts || !account || !delegation || !user?.address) {
      return { 
        isProposer: false, 
        proposerStake: 0 
      };
    }

    // First, check if getLastProposalDetails method exists
    if (typeof delegation.getLastProposalDetails !== 'function') {
      return { 
        isProposer: false, 
        proposerStake: 0 
      };
    }

    // Fetch last proposal details
    const lastProposalDetails = await delegation.getLastProposalDetails();

    // Check if proposer exists and matches current account
    if (lastProposalDetails && 
        lastProposalDetails.proposer && 
        user?.address && 
        lastProposalDetails.proposer.toLowerCase() === user.address.toLowerCase()) {
      
      // Parse stake amount, defaulting to 0 if not available
      const proposerStake = parseFloat(lastProposalDetails.stakedAmount || "0");
      
      return { 
        isProposer: true, 
        proposerStake 
      };
    }

    // If no match found
    return { 
      isProposer: false, 
      proposerStake: 0 
    };
  } catch (error) {
    console.error('Error in proposer status check:', error);
    return { 
      isProposer: false, 
      proposerStake: 0 
    };
  }
}, [contracts, account, delegation, user?.address]);

// Run the proposer check independently as soon as dependencies are ready
useEffect(() => {
  if (!user?.address || !contracts || !delegation) return;
  
  const runProposerStatusCheck = async () => {
    try {
      const result = await checkProposerStatus();
      if (mountedRef.current) {
        setIsProposer(result.isProposer);
        setProposerStake(result.proposerStake);
      }
    } catch (error) {
      console.error("Error in standalone proposer check:", error);
    }
  };
  
  runProposerStatusCheck();
}, [user?.address, contracts, delegation, checkProposerStatus]);

// Memoized fetch delegation data function
const fetchDelegationData = useCallback(async () => {
  if (!user?.address || !mountedRef.current) return;
  
  const address = user.address;
  
  setIsLoadingDelegations(true);
  
  try {
    // We'll use the isProposer and proposerStake from state which was already set
    // by the independent proposer check effect
    
    // Fetch total voting power
    let power = delegationInfo.effectiveVotingPower;
    if (delegation?.getEffectiveVotingPower) {
      try {
        power = await delegation.getEffectiveVotingPower(address);
      } catch (error) {
        console.error("Error fetching voting power:", error);
      }
    }
    
    if (mountedRef.current) {
      setVotingPower(power);
    }
    
    // Calculate direct delegations from delegationInfo
    const directFromDelegators = delegationInfo.delegators?.reduce((sum, delegator) => {
      if (delegator.address?.toLowerCase() === address.toLowerCase()) return sum;
      return sum + parseFloat(delegator.balance || "0");
    }, 0).toString() || "0";
    
    if (mountedRef.current) {
      setDirectDelegations(directFromDelegators);
      
      // Calculate indirect delegations (excluding stake)
      const calculatedIndirect = calculateIndirectDelegations(
        directFromDelegators, 
        isProposer, 
        proposerStake
      );
      
      setIndirectDelegations(calculatedIndirect.toString());
      setIsLoadingDelegations(false);
    }
  } catch (error) {
    console.error("Error in fetchDelegationData:", error);
    if (mountedRef.current) {
      setIsLoadingDelegations(false);
    }
  }
}, [
  user?.address, 
  delegationInfo?.delegators, 
  delegationInfo?.effectiveVotingPower,
  delegation?.getEffectiveVotingPower,
  calculateIndirectDelegations,
  isProposer,
  proposerStake
]);

// Debounced effect with stable dependencies
useEffect(() => {
  if (!user?.address) return;
  
  // Clear any pending fetch timer
  if (timersRef.current.fetchDelegation) {
    clearTimeout(timersRef.current.fetchDelegation);
  }
  
  // Set a small delay to prevent rapid consecutive fetches
  timersRef.current.fetchDelegation = setTimeout(() => {
    fetchDelegationData();
  }, 300);
  
  // Cleanup function
  return () => {
    if (timersRef.current.fetchDelegation) {
      clearTimeout(timersRef.current.fetchDelegation);
    }
  };
}, [fetchDelegationData]);

  // Format numbers with more precision for specific values - memoized
  const formatToFiveDecimals = useCallback((value) => {
    if (!value) return "0.00000";
    return parseFloat(value).toFixed(5);
  }, []);
  
  // Format with 8 decimal places for locked tokens and voting power - memoized
  const formatToEightDecimals = useCallback((value) => {
    if (!value) return "0.00000000";
    return parseFloat(value).toFixed(8);
  }, []);

  // Determine delegation status
  const userAddress = user?.address || '';
  const currentDelegate = delegationInfo?.currentDelegate || '';
  const selfDelegated = useMemo(() => 
    isSelfDelegated(userAddress, currentDelegate), 
    [isSelfDelegated, userAddress, currentDelegate]
  );

  // Get directly delegated tokens (excluding self) - memoized
  const directDelegatedToYou = directDelegations;

  // Get full transitive delegated tokens - memoized
  const fullTransitiveDelegation = useMemo(() => {
    // Add direct and indirect delegations
    const total = parseFloat(directDelegations) + parseFloat(indirectDelegations);
    
    // Safety check to ensure we have a valid number
    return isNaN(total) ? "0" : total.toString();
  }, [directDelegations, indirectDelegations]);

  // Calculate proper voting power - use the effective voting power from contract - memoized
  const displayVotingPower = useMemo(() => {
    // Use the delegationInfo.effectiveVotingPower if available, otherwise use the fetched votingPower
    return delegationInfo.effectiveVotingPower || votingPower || "0.00000000";
  }, [delegationInfo.effectiveVotingPower, votingPower]);

  // Check if there are actual delegators (excluding self)
  const hasRealDelegators = useMemo(() => {
    if (!delegationInfo.delegators || delegationInfo.delegators.length === 0) {
      return false;
    }
    
    // Check if there are delegators other than the user themselves
    return delegationInfo.delegators.some(delegator => 
      delegator.address?.toLowerCase() !== userAddress?.toLowerCase()
    );
  }, [delegationInfo.delegators, userAddress]);

  // Check if user is part of a delegation chain
  const isPartOfDelegationChain = !selfDelegated && currentDelegate !== '';

  // Check if there's transitive delegation
  const hasTransitiveDelegation = parseFloat(indirectDelegations) > 0.00001;

  // Calculate the ultimate delegate in a delegation chain
  const ultimateDelegate = useMemo(() => {
    if (selfDelegated || !currentDelegate) {
      return userAddress;
    }
    
    // If we have a delegation path, return the last address in that path
    if (delegationPath && delegationPath.length > 0) {
      return delegationPath[delegationPath.length - 1];
    }
    
    // Fallback to just the current delegate
    return currentDelegate;
  }, [selfDelegated, currentDelegate, userAddress, delegationPath]);

  // Check if ultimate delegate is self - calculated directly
  const ultimateDelegateIsSelf = ultimateDelegate.toLowerCase() === userAddress.toLowerCase();

  // Render the delegation chain/path - memoized
  const renderDelegationChain = useCallback(() => {
    if (!isPartOfDelegationChain || !delegationPath || delegationPath.length <= 1) {
      return null;
    }
    
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg mb-4">
        <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2 flex items-center">
          <ArrowUpRight className="w-4 h-4 mr-1" />
          Delegation Chain
        </h5>
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
      </div>
    );
  }, [isPartOfDelegationChain, delegationPath, userAddress]);

  // Main stats cards with updated display logic - memoized
  const statCards = useMemo(() => [
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
      value: `${formatToEightDecimals(displayVotingPower)} JST`,
      icon: <Zap className="w-5 h-5" />
    }
  ], [
    selfDelegated, 
    userAddress, 
    currentDelegate, 
    user?.balance, 
    displayVotingPower, 
    formatToEightDecimals, 
    formatToFiveDecimals
  ]);

  // Handler for reset delegation - memoized
  const handleResetDelegation = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await resetDelegation();
      if (mountedRef.current) {
        setDelegateAddress('');
      }
      
      // Clear any pending fetch timers
      if (timersRef.current.fetchVotingPower) {
        clearTimeout(timersRef.current.fetchVotingPower);
      }
      
      // Refresh voting power after resetting delegation
      timersRef.current.fetchVotingPower = setTimeout(async () => {
        if (delegation?.getEffectiveVotingPower && user?.address && mountedRef.current) {
          try {
            const newPower = await delegation.getEffectiveVotingPower(user.address);
            if (mountedRef.current) {
              setVotingPower(newPower);
            }
          } catch (error) {
            console.error("Error updating voting power after reset:", error);
          }
        }

        // Reset delegation path
        if (mountedRef.current) {
          setDelegationPath([]);
        }
      }, 500);
    } catch (error) {
      console.error("Error resetting delegation:", error);
      alert("Error resetting delegation. See console for details.");
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [resetDelegation, delegation, user?.address]);

  // Handler for delegation - memoized
  const handleDelegate = useCallback(async () => {
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
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
        return;
      } else if (warning.warningLevel > 0) {
        const proceed = window.confirm(warning.message + ". Do you want to proceed?");
        if (!proceed) {
          if (mountedRef.current) {
            setIsSubmitting(false);
          }
          return;
        }
      }
      
      await delegate(delegateAddress);
      if (mountedRef.current) {
        setDelegateAddress('');
      }
      
      // Clear any pending fetch timers
      if (timersRef.current.fetchVotingPower) {
        clearTimeout(timersRef.current.fetchVotingPower);
      }
      
      // Refresh voting power after delegation
      timersRef.current.fetchVotingPower = setTimeout(async () => {
        if (delegation?.getEffectiveVotingPower && user?.address && mountedRef.current) {
          try {
            const newPower = await delegation.getEffectiveVotingPower(user.address);
            if (mountedRef.current) {
              setVotingPower(newPower);
            }
          } catch (error) {
            console.error("Error updating voting power after delegation:", error);
          }
        }
        
        // Refresh delegation path
        if (delegation?.getDelegationPath && user?.address && mountedRef.current) {
          try {
            const path = await delegation.getDelegationPath(user.address);
            if (mountedRef.current) {
              setDelegationPath(path || []);
            }
          } catch (error) {
            console.error("Error updating delegation path:", error);
          }
        }
      }, 500);
    } catch (error) {
      console.error("Error delegating:", error);
      alert("Error delegating. See console for details.");
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [delegateAddress, user?.address, getDelegationDepthWarning, delegate, delegation, handleResetDelegation]);
  
  return (
    <div className="transition-colors duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors duration-300">Delegation</h2>
        <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300 mt-1">
          Manage your voting power and delegate tokens for governance participation
        </p>
      </div>
      
      {/* Snapshot Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700 shadow-sm min-h-0">        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              Current Snapshot ID:
            </span>
          </div>
          {currentSnapshotId !== null ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg text-sm">
              #{currentSnapshotId}
            </span>
          ) : (
            <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg text-sm">
              <Loader size="tiny" className="mr-2" />
              Loading...
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Note: Delegation chains and voting power calculations are finalized when a snapshot is created for governance actions.
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="large" text="Loading delegation data..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main cards layout - using a 3-column grid with first card spanning 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Your Delegation Status - takes up 8 out of 12 columns (2/3 of the width) */}
            <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-600/20 dark:to-purple-600/20 py-4 px-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Your Delegation Status
                </h3>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                
                
                {/* Delegation chain visualization */}
                {renderDelegationChain()}
                
                {/* Ultimate delegate indicator for users who are delegating */}
                {!selfDelegated && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg mb-6">
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
                        : `Your voting power flows to this address at the end of the chain.`}
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

            {/* Delegated to you card - takes up 4 out of 12 columns (1/3 of the width) */}
            <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-600/20 dark:to-teal-600/20 py-4 px-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Delegated to You
                </h3>
              </div>
              
              <div className="p-6">
                {isLoadingDelegations ? (
                  <div className="flex justify-center items-center py-6">
                    <Loader size="medium" text="Loading delegation data..." />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center space-x-6 mb-6">
                      {/* Only show direct delegations if there are no indirect delegations */}
                      {!hasTransitiveDelegation ? (
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3 shadow-md">
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                              {formatToFiveDecimals(directDelegatedToYou)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Direct</p>
                        </div>
                      ) : (
                        <>
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3 shadow-md">
                              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {formatToFiveDecimals(directDelegatedToYou)}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Direct</p>
                          </div>
                          
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-3 shadow-md">
                              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatToFiveDecimals(indirectDelegations)}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Indirect</p>
                            {isProposer && parseFloat(proposerStake) > 0 && (
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                                (Excludes {formatToFiveDecimals(proposerStake)} JST proposal stake)
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 transition-colors duration-300">
                      {parseFloat(fullTransitiveDelegation) > 0 ? (
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            You have {formatToFiveDecimals(fullTransitiveDelegation)} JST tokens delegated to you 
                            {hasTransitiveDelegation ? (
                              <>
                                (<span className="text-emerald-600 dark:text-emerald-400">{formatToFiveDecimals(directDelegations)} direct</span> + 
                                <span className="text-indigo-600 dark:text-indigo-400"> {formatToFiveDecimals(indirectDelegations)} transitive</span>).
                              </>
                            ) : (
                              <span> (all direct).</span>
                            )}
                          </p>
                          {isProposer && parseFloat(proposerStake) > 0 && hasTransitiveDelegation && (
                            <div className="flex items-center mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                              <Info className="w-4 h-4 mr-1" />
                              <span>Your proposal stake of {formatToFiveDecimals(proposerStake)} JST is excluded from indirect delegations but included in your total voting power.</span>
                            </div>
                          )}
                          {!selfDelegated && !ultimateDelegateIsSelf && (
                            <div className="flex items-center mt-2 text-xs text-amber-600 dark:text-amber-400">
                              <Info className="w-4 h-4 mr-1" />
                              <span>These tokens flow through to {formatAddress(ultimateDelegate)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          No tokens delegated to you yet.
                        </p>
                      )}
                    </div>
                    
                    {/* Delegators section */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 transition-colors duration-300">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Delegators:</h4>
                        <div>
                          <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md">
                            Total: {formatToFiveDecimals(fullTransitiveDelegation)} JST
                            {isProposer && parseFloat(proposerStake) > 0 && ' (excl. stake)'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Direct delegators list */}
                      {hasRealDelegators ? (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Direct Delegators:</h5>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 mb-4">
                            {delegationInfo.delegators
                              .filter(delegator => delegator.address?.toLowerCase() !== userAddress?.toLowerCase())
                              .map((delegator, idx) => (
                                <div 
                                  key={idx} 
                                  className="text-sm flex justify-between items-center p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/30 hover:bg-white dark:hover:bg-gray-700 transition-colors duration-150"
                                >
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {formatAddress(delegator.address)}
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
                      
                      {/* Indirect delegation summary - only shown if there are indirect delegations */}
                      {hasTransitiveDelegation && (
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Indirect Delegations:</h5>
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                              {formatToFiveDecimals(indirectDelegations)} JST
                              {isProposer && parseFloat(proposerStake) > 0 && ' (excl. stake)'}
                            </span>
                          </div>
                          {isProposer && parseFloat(proposerStake) > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              This excludes your proposal stake of {formatToFiveDecimals(proposerStake)} JST.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
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