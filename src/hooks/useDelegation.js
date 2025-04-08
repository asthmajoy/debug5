// src/hooks/useDelegation.js - Updated to properly handle transitive voting power
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { useBlockchainData } from '../contexts/BlockchainDataContext';

export function useDelegation() {
  const { contracts, account, isConnected, contractsReady } = useWeb3();
  const { userData, refreshData } = useBlockchainData();
  
  const [delegationInfo, setDelegationInfo] = useState({
    currentDelegate: null,
    lockedTokens: "0",
    delegatedToYou: "0",
    delegators: [],
    isSelfDelegated: true,
    delegationChain: [], // Track delegation chain
    effectiveVotingPower: "0" // Add effectiveVotingPower to state
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state with blockchain data from context and fetch effective voting power
  useEffect(() => {
    if (userData) {
      // Calculate if self-delegated
      const isSelfDelegated = 
        userData.delegate === account || 
        userData.delegate === ethers.constants.AddressZero || 
        !userData.delegate;
      
      setDelegationInfo({
        currentDelegate: userData.delegate,
        lockedTokens: userData.lockedTokens,
        delegatedToYou: userData.delegatedToYou,
        delegators: userData.delegators || [],
        isSelfDelegated,
        delegationChain: [account, userData.delegate].filter(a => !!a && a !== ethers.constants.AddressZero),
        effectiveVotingPower: "0" // Initialize, will be updated by getEffectiveVotingPower
      });
      
      setLoading(false);
      
      // If not self-delegated, try to fetch the delegation chain
      if (!isSelfDelegated && contractsReady && contracts.justToken) {
        fetchDelegationChain(account);
      }
      
      // Always fetch effective voting power when userData changes
      if (account && contractsReady && contracts.justToken) {
        getEffectiveVotingPower(account).then(power => {
          setDelegationInfo(prev => ({
            ...prev,
            effectiveVotingPower: power
          }));
        }).catch(err => {
          console.error("Error fetching effective voting power:", err);
        });
      }
    }
  }, [userData, account, contractsReady, contracts]);

  // Fetch the entire delegation chain for an address
  const fetchDelegationChain = async (startAddr) => {
    if (!contractsReady || !contracts.justToken) return;
    
    try {
      const chain = [startAddr];
      let currentDelegate = startAddr;
      const visited = new Set();
      visited.add(currentDelegate.toLowerCase());
      
      // Follow the delegation chain up to a reasonable depth
      for (let i = 0; i < 10; i++) {
        try {
          const nextDelegate = await contracts.justToken.getDelegate(currentDelegate);
          
          // Stop if delegate is self or zero address
          if (nextDelegate === ethers.constants.AddressZero || 
              nextDelegate.toLowerCase() === currentDelegate.toLowerCase()) {
            break;
          }
          
          // Detect cycles
          if (visited.has(nextDelegate.toLowerCase())) {
            console.warn("Delegation cycle detected:", chain);
            chain.push(`${nextDelegate} (CYCLE)`);
            break;
          }
          
          // Add to chain and continue
          chain.push(nextDelegate);
          visited.add(nextDelegate.toLowerCase());
          currentDelegate = nextDelegate;
        } catch (err) {
          console.warn("Error following delegation chain:", err);
          break;
        }
      }
      
      console.log("Delegation chain:", chain);
      
      // Update delegation info with the chain
      setDelegationInfo(prev => ({
        ...prev,
        delegationChain: chain
      }));
      
      return chain;
    } catch (err) {
      console.error("Error fetching delegation chain:", err);
      return [startAddr];
    }
  };

  // Delegate voting power to another address
  const delegate = async (delegateeAddress) => {
    if (!isConnected || !contractsReady) throw new Error("Not connected");
    if (!contracts.justToken) throw new Error("Token contract not initialized");
    if (!ethers.utils.isAddress(delegateeAddress)) throw new Error("Invalid address format");
    
    // Prevent self-delegation via regular delegate - should use resetDelegation instead
    if (delegateeAddress.toLowerCase() === account.toLowerCase()) {
      return resetDelegation();
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Delegating from ${account} to ${delegateeAddress}`);
      
      // Check for delegator cycles and find ultimate delegate
      const checkDelegationChain = async (startAddr, targetAddr) => {
        let currentDelegate = targetAddr;
        const visited = new Set();
        const chain = [startAddr.toLowerCase()];
        visited.add(startAddr.toLowerCase());
        
        // Follow the chain to detect cycles or excessive depth
        for (let i = 0; i < 10; i++) {
          try {
            if (!currentDelegate || 
                currentDelegate === ethers.constants.AddressZero || 
                currentDelegate.toLowerCase() === currentDelegate.toLowerCase()) {
              break;
            }
            
            // Detect cycles
            if (visited.has(currentDelegate.toLowerCase())) {
              return { 
                hasCycle: true, 
                finalDelegate: null, 
                depth: visited.size - 1,
                chain: [...chain, `${currentDelegate} (CYCLE)`]
              };
            }
            
            chain.push(currentDelegate.toLowerCase());
            visited.add(currentDelegate.toLowerCase());
            
            // Get next delegate in the chain
            const nextDelegate = await contracts.justToken.getDelegate(currentDelegate);
            
            // If delegate is self or zero address, we've reached the end
            if (nextDelegate === ethers.constants.AddressZero || 
                nextDelegate.toLowerCase() === currentDelegate.toLowerCase()) {
              break;
            }
            
            currentDelegate = nextDelegate;
          } catch (err) {
            console.warn("Error checking delegation chain:", err);
            break;
          }
        }
        
        return { 
          hasCycle: false, 
          finalDelegate: currentDelegate, 
          depth: visited.size - 1,
          chain
        };
      };
      
      // First check for potential delegation issues
      if (contracts.daoHelper) {
        try {
          const warningLevel = await contracts.daoHelper.checkDelegationDepthWarning(account, delegateeAddress);
          
          if (warningLevel === 3) {
            throw new Error("This delegation would exceed the maximum delegation depth limit or create a cycle");
          } else if (warningLevel === 2) {
            console.warn("This delegation will reach the maximum allowed delegation depth");
          } else if (warningLevel === 1) {
            console.warn("This delegation is getting close to the maximum depth limit");
          }
        } catch (depthErr) {
          // If no helper or helper error, do our own chain check
          if (!depthErr.message.includes("delegation")) {
            // Check delegation chain manually
            const chainCheck = await checkDelegationChain(account, delegateeAddress);
            
            if (chainCheck.hasCycle) {
              throw new Error("This delegation would create a cycle");
            }
            
            if (chainCheck.depth > 7) { // Typical maximum depth is 8
              throw new Error("This delegation would exceed the maximum depth limit");
            }
            
            console.log(`Delegation chain: ${chainCheck.chain.join(' -> ')} (depth: ${chainCheck.depth})`);
          } else {
            throw depthErr;
          }
        }
      } else {
        // No helper contract, do our own chain check
        const chainCheck = await checkDelegationChain(account, delegateeAddress);
        
        if (chainCheck.hasCycle) {
          throw new Error("This delegation would create a cycle");
        }
        
        if (chainCheck.depth > 7) { // Typical maximum depth is 8
          throw new Error("This delegation would exceed the maximum depth limit");
        }
        
        console.log(`Delegation chain: ${chainCheck.chain.join(' -> ')} (depth: ${chainCheck.depth})`);
      }
      
      // Get current delegators before delegation
      const myDelegators = [];
      try {
        const delegatorAddresses = await contracts.justToken.getDelegatorsOf(account);
        for (const addr of delegatorAddresses) {
          try {
            const balance = await contracts.justToken.balanceOf(addr);
            myDelegators.push({
              address: addr,
              balance: ethers.utils.formatEther(balance)
            });
          } catch (err) {
            console.warn(`Error getting delegator ${addr} balance:`, err);
          }
        }
        
        if (myDelegators.length > 0) {
          console.log(`Current delegators who will be affected: ${myDelegators.length}`, 
                     myDelegators.map(d => `${d.address}: ${d.balance} JUST`).join(', '));
          console.log(`Total tokens that will transitively flow: ${
            myDelegators.reduce((sum, d) => sum + parseFloat(d.balance), 0).toFixed(5)
          } JUST`);
        }
      } catch (err) {
        console.warn("Could not check current delegators:", err);
      }
      
      // Execute the delegation
      const tx = await contracts.justToken.delegate(delegateeAddress, {
        gasLimit: 300000 // Set a reasonable gas limit
      });
      
      await tx.wait();
      console.log("Delegation transaction confirmed");
      
      // Perform post-delegation checks
      try {
        // Check if any delegators are now affected by transitive delegation
        const delegators = await contracts.justToken.getDelegatorsOf(account);
        if (delegators.length > 0) {
          console.log(`This account has ${delegators.length} delegators whose tokens will now transitively flow to ${delegateeAddress}`);
          
          // Calculate total tokens that will transitively flow
          let totalTransitiveTokens = 0;
          for (const delegator of delegators) {
            if (delegator.toLowerCase() !== account.toLowerCase()) {
              try {
                const balance = await contracts.justToken.balanceOf(delegator);
                totalTransitiveTokens += parseFloat(ethers.utils.formatEther(balance));
              } catch (err) {
                console.warn(`Error getting balance for delegator ${delegator}:`, err);
              }
            }
          }
          
          console.log(`Total tokens that will transitively flow: ${totalTransitiveTokens.toFixed(5)} JUST`);
        }
        
        // Fetch and log the new delegation chain
        await fetchDelegationChain(account);
        
        // Update effective voting power after delegation
        const newVotingPower = await getEffectiveVotingPower(account);
        setDelegationInfo(prev => ({
          ...prev,
          effectiveVotingPower: newVotingPower
        }));
      } catch (err) {
        console.warn("Could not perform post-delegation checks:", err);
      }
      
      // Refresh blockchain data to update state
      refreshData();
      
      return true;
    } catch (err) {
      console.error("Error delegating:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Reset delegation (self-delegate)
  const resetDelegation = async () => {
    if (!isConnected || !contractsReady) throw new Error("Not connected");
    if (!contracts.justToken) throw new Error("Token contract not initialized");
    
    try {
      setLoading(true);
      setError(null);
      
      console.log("Resetting delegation to self");
      
      // Check for delegators first
      try {
        const delegators = await contracts.justToken.getDelegatorsOf(account);
        if (delegators.length > 0) {
          console.log(`This account has ${delegators.length} delegators who will now delegate directly to you`);
        }
      } catch (err) {
        console.warn("Could not check delegators:", err);
      }
      
      let tx;
      // Check if the contract has resetDelegation or if we should use delegate(self)
      if (typeof contracts.justToken.resetDelegation === 'function') {
        // Use resetDelegation if available
        tx = await contracts.justToken.resetDelegation({
          gasLimit: 200000
        });
      } else {
        // Otherwise delegate to self
        tx = await contracts.justToken.delegate(account, {
          gasLimit: 200000
        });
      }
      
      await tx.wait();
      console.log("Reset delegation transaction confirmed");
      
      // Update effective voting power after resetting delegation
      const newVotingPower = await getEffectiveVotingPower(account);
      setDelegationInfo(prev => ({
        ...prev,
        effectiveVotingPower: newVotingPower
      }));
      
      // Refresh blockchain data to update state
      refreshData();
      
      return true;
    } catch (err) {
      console.error("Error resetting delegation:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get delegation depth warning info
  const getDelegationDepthWarning = async (delegator, delegatee) => {
    if (!isConnected || !contractsReady) throw new Error("Not connected");
    
    // If trying to delegate to self, return no warning (it's just a reset)
    if (delegator.toLowerCase() === delegatee.toLowerCase()) {
      return { warningLevel: 0, message: "Self-delegation has no depth issues" };
    }
    
    try {
      // Try to use DAO helper if available
      if (contracts.daoHelper) {
        try {
          const warningLevel = await contracts.daoHelper.checkDelegationDepthWarning(delegator, delegatee);
          return {
            warningLevel: Number(warningLevel),
            message: getWarningMessage(Number(warningLevel))
          };
        } catch (helperErr) {
          console.warn("Error using DAO helper for delegation depth check:", helperErr);
        }
      }
      
      // Fallback: Calculate delegation chain and check depth manually
      const { hasCycle, depth, chain } = await calculateDelegationDepth(delegator, delegatee);
      
      // Determine warning level
      let warningLevel = 0;
      if (hasCycle) {
        warningLevel = 3;
      } else if (depth >= 8) {
        warningLevel = 3;
      } else if (depth >= 6) {
        warningLevel = 2;
      } else if (depth >= 4) {
        warningLevel = 1;
      }
      
      return {
        warningLevel,
        message: getWarningMessage(warningLevel),
        chain
      };
    } catch (err) {
      console.error("Error checking delegation depth:", err);
      throw err;
    }
  };
  
  // Calculate delegation depth manually
  const calculateDelegationDepth = async (delegator, delegatee) => {
    const chain = [delegator.toLowerCase()];
    let currentDelegate = delegatee;
    const visited = new Set();
    visited.add(delegator.toLowerCase());
    
    // Check the delegation chain depth
    while (currentDelegate && currentDelegate !== ethers.constants.AddressZero) {
      if (visited.has(currentDelegate.toLowerCase())) {
        return { 
          hasCycle: true, 
          depth: visited.size,
          chain: [...chain, `${currentDelegate} (CYCLE)`]
        };
      }
      
      chain.push(currentDelegate.toLowerCase());
      visited.add(currentDelegate.toLowerCase());
      
      // Get the next delegate in the chain
      try {
        currentDelegate = await contracts.justToken.getDelegate(currentDelegate);
        
        // If the delegate is delegating to themself or not delegating, stop
        if (currentDelegate === ethers.constants.AddressZero || 
            currentDelegate.toLowerCase() === chain[chain.length - 1].toLowerCase()) {
          break;
        }
      } catch (err) {
        console.warn("Error tracing delegation chain:", err);
        break;
      }
    }
    
    return {
      hasCycle: false,
      depth: visited.size,
      chain
    };
  };

  // Get delegation warning message
  function getWarningMessage(warningLevel) {
    switch (Number(warningLevel)) {
      case 0:
        return "No delegation depth issues";
      case 1:
        return "This delegation is getting close to the maximum delegation depth limit";
      case 2:
        return "This delegation will reach the maximum delegation depth limit";
      case 3:
        return "This delegation would exceed the maximum delegation depth limit or create a cycle";
      default:
        return "Unknown delegation depth warning";
    }
  }

  // Fetch delegators of a given address
  const fetchDelegators = async (address) => {
    if (!isConnected || !contractsReady || !contracts.justToken) {
      return [];
    }
    
    try {
      setLoading(true);
      
      // Get delegator addresses
      const delegatorAddresses = await contracts.justToken.getDelegatorsOf(address);
      
      // Get balance for each delegator
      const delegators = await Promise.all(
        delegatorAddresses.map(async (delegatorAddr) => {
          try {
            const balance = await contracts.justToken.balanceOf(delegatorAddr);
            const formattedBalance = ethers.utils.formatEther(balance);
            
            // Check if this delegator is also delegating to others
            const delegatorDelegate = await contracts.justToken.getDelegate(delegatorAddr);
            const isSelfDelegated = 
              delegatorDelegate === ethers.constants.AddressZero || 
              delegatorDelegate.toLowerCase() === delegatorAddr.toLowerCase();
            
            return {
              address: delegatorAddr,
              balance: formattedBalance,
              isSelfDelegated
            };
          } catch (err) {
            console.warn(`Error getting delegator ${delegatorAddr} details:`, err);
            return {
              address: delegatorAddr,
              balance: "0",
              isSelfDelegated: true
            };
          }
        })
      );
      
      return delegators;
    } catch (err) {
      console.error("Error fetching delegators:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Function to calculate total tokens transitively delegated
  const getTransitiveDelegation = async (address) => {
    if (!isConnected || !contractsReady || !contracts.justToken) {
      return {
        incomingDelegation: "0",
        outgoingDelegation: "0",
        passingThrough: "0",
        delegators: [],
        delegationChain: []
      };
    }
    
    try {
      // Get current delegate
      const currentDelegate = await contracts.justToken.getDelegate(address);
      const isSelfDelegated = 
        currentDelegate === ethers.constants.AddressZero || 
        currentDelegate.toLowerCase() === address.toLowerCase();
      
      // Get delegators
      const delegators = await fetchDelegators(address);
      
      // Calculate incoming delegation (excluding self)
      const incomingDelegation = delegators
        .filter(d => d.address.toLowerCase() !== address.toLowerCase())
        .reduce((sum, d) => sum + parseFloat(d.balance), 0);
      
      // Get user's own balance
      const balance = await contracts.justToken.balanceOf(address);
      const ownBalance = parseFloat(ethers.utils.formatEther(balance));
      
      // Calculate outgoing delegation (if not self-delegated)
      let outgoingDelegation = 0;
      if (!isSelfDelegated) {
        outgoingDelegation = ownBalance;
      }
      
      // Calculate passing through (if not self-delegated)
      let passingThrough = 0;
      if (!isSelfDelegated) {
        passingThrough = incomingDelegation;
      }
      
      // Get delegation chain
      const delegationChain = await fetchDelegationChain(address);
      
      return {
        incomingDelegation: incomingDelegation.toString(),
        outgoingDelegation: outgoingDelegation.toString(),
        passingThrough: passingThrough.toString(),
        delegators,
        delegationChain
      };
    } catch (err) {
      console.error("Error calculating transitive delegation:", err);
      return {
        incomingDelegation: "0",
        outgoingDelegation: "0",
        passingThrough: "0",
        delegators: [],
        delegationChain: []
      };
    }
  };

  // Manual function to fetch delegation info
  const fetchDelegationInfo = async () => {
    if (!isConnected || !contractsReady || !account) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Get basic delegation info
      const currentDelegate = await contracts.justToken.getDelegate(account);
      const isSelfDelegated = 
        currentDelegate === ethers.constants.AddressZero || 
        currentDelegate.toLowerCase() === account.toLowerCase();
      
      // Get locked tokens
      const lockedTokens = !isSelfDelegated ? 
        await contracts.justToken.balanceOf(account) : 
        ethers.BigNumber.from(0);
      
      // Get delegators
      const delegators = await fetchDelegators(account);
      
      // Calculate delegated to you
      const delegatedToYou = delegators
        .filter(d => d.address.toLowerCase() !== account.toLowerCase())
        .reduce((sum, d) => sum + parseFloat(d.balance), 0);
      
      // Get delegation chain
      const delegationChain = await fetchDelegationChain(account);
      
      // Get effective voting power
      const effectiveVotingPower = await getEffectiveVotingPower(account);
      
      // Update state
      setDelegationInfo({
        currentDelegate,
        lockedTokens: ethers.utils.formatEther(lockedTokens),
        delegatedToYou: delegatedToYou.toString(),
        delegators,
        isSelfDelegated,
        delegationChain,
        effectiveVotingPower
      });
      
      // Also refresh global data
      refreshData();
    } catch (err) {
      console.error("Error fetching delegation info:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



// Inside your component or hook
const getEffectiveVotingPower = useCallback(
  async (address) => {
    if (!isConnected || !contractsReady || !contracts.justToken) {
      return "0";
    }

    try {
      setLoading(true);

      const currentSnapshotId = await contracts.justToken.getCurrentSnapshotId();

      const votingPower = await contracts.justToken.getEffectiveVotingPower(
        address,
        currentSnapshotId
      );

      const formattedVotingPower = ethers.utils.formatEther(votingPower);

      setDelegationInfo((prev) => ({
        ...prev,
        effectiveVotingPower: formattedVotingPower,
      }));

      return formattedVotingPower;
    } catch (err) {
      console.error("Error getting effective voting power:", err);
      return "0";
    } finally {
      setLoading(false);
    }
  },
  [isConnected, contractsReady, contracts.justToken] // <- Dependencies
);
  
  // Single return statement with all functions
  return {
    delegationInfo,
    loading,
    error,
    delegate,
    resetDelegation,
    getDelegationDepthWarning,
    fetchDelegators,
    getTransitiveDelegation,
    fetchDelegationInfo,
    fetchDelegationChain,
    getEffectiveVotingPower  // Included in the return
  };
}

export default useDelegation;