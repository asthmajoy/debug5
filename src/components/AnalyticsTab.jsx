import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, PieChart, LineChart, AreaChart } from 'lucide-react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { formatPercentage, formatNumber, formatBigNumber } from '../utils/formatters';

const AnalyticsTab = () => {
  const { contracts, contractsReady, account, provider } = useWeb3();
  const [selectedMetric, setSelectedMetric] = useState('proposal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionDetails, setConnectionDetails] = useState(null);
  
  // Analytics state
  const [proposalAnalytics, setProposalAnalytics] = useState(null);
  const [voterAnalytics, setVoterAnalytics] = useState(null);
  const [tokenAnalytics, setTokenAnalytics] = useState(null);
  const [timelockAnalytics, setTimelockAnalytics] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [delegationAnalytics, setDelegationAnalytics] = useState(null);

  // Improved BigNumber to Number conversion
  const formatBigNumberToNumber = (bn) => {
    if (!bn) return 0;
    if (typeof bn === 'number') return bn;
    
    // Try using ethers BigNumber methods first
    if (ethers.BigNumber.isBigNumber(bn)) {
      try {
        // If the number isn't too large, convert directly
        return bn.toNumber();
      } catch (e) {
        // For large numbers, convert to string then parse
        return parseFloat(bn.toString());
      }
    }
    
    // Handle regular objects with toString method
    try {
      if (bn.toString && typeof bn.toString === 'function') {
        const str = bn.toString();
        // Remove any "e+" scientific notation
        if (str.includes('e+')) {
          return parseFloat(str);
        }
        return parseFloat(str);
      }
    } catch (err) {
      console.error("Error parsing value:", err, bn);
    }
    
    // Last resort - try to use formatUnits
    try {
      return parseFloat(ethers.utils.formatUnits(bn, 0));
    } catch (e) {
      console.error("All conversion methods failed for:", bn);
    }
    
    return 0;
  };

  // Safely get property value with fallback
  const safeGet = (obj, path, defaultValue = 0) => {
    if (!obj) return defaultValue;
    const keys = path.split('.');
    return keys.reduce((o, key) => 
      (o && o[key] !== undefined) ? o[key] : defaultValue, obj);
  };

  // Debug function to check contract connectivity
  const checkContractConnectivity = useCallback(async () => {
    if (!contractsReady) {
      return {
        connected: false,
        message: "Contracts not ready. Connect your wallet to continue."
      };
    }

    const details = {
      connected: true,
      contracts: {},
      account: account || "Not connected",
      networkId: null
    };

    try {
      if (provider) {
        const network = await provider.getNetwork();
        details.networkId = network.chainId;
      }

      // Check each contract
      if (contracts.justToken) {
        try {
          const symbol = await contracts.justToken.symbol();
          const totalSupply = await contracts.justToken.totalSupply();
          details.contracts.justToken = {
            address: contracts.justToken.address,
            symbol,
            totalSupply: ethers.utils.formatEther(totalSupply)
          };
        } catch (err) {
          details.contracts.justToken = {
            address: contracts.justToken.address,
            error: err.message
          };
        }
      } else {
        details.contracts.justToken = "Not initialized";
      }

      if (contracts.governance) {
        try {
          // Get a simple call to check connection
          const state = await contracts.governance.getProposalState(0).catch(() => "No proposals");
          details.contracts.governance = {
            address: contracts.governance.address,
            status: "Connected"
          };
        } catch (err) {
          details.contracts.governance = {
            address: contracts.governance?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.governance = "Not initialized";
      }

      if (contracts.timelock) {
        try {
          const minDelay = await contracts.timelock.minDelay();
          details.contracts.timelock = {
            address: contracts.timelock.address,
            minDelay: minDelay.toString()
          };
        } catch (err) {
          details.contracts.timelock = {
            address: contracts.timelock?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.timelock = "Not initialized";
      }

      if (contracts.daoHelper) {
        try {
          // Check if we can call a simple function
          details.contracts.daoHelper = {
            address: contracts.daoHelper.address,
            status: "Connected"
          };
        } catch (err) {
          details.contracts.daoHelper = {
            address: contracts.daoHelper?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.daoHelper = "Not initialized";
      }

      return details;
    } catch (err) {
      return {
        connected: false,
        message: `Error checking contracts: ${err.message}`
      };
    }
  }, [contractsReady, contracts, account, provider]);

  // Load delegation analytics
  const loadDelegationAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.daoHelper) {
      setError("DAO Helper contract not available");
      return;
    }
    
    try {
      setLoading(true);
      const startIndex = 0;
      const count = 10; // Limit to 10 for performance
      
      console.log("Calling getDelegationAnalytics with:", startIndex, count);
      
      let analyticsData = [];
      let topDelegateData = [];
      
      try {
        const result = await contracts.daoHelper.getDelegationAnalytics(startIndex, count);
        console.log("getDelegationAnalytics raw result:", result);
        
        if (result && result.length >= 4) {
          const addresses = result[0] || [];
          const delegates = result[1] || [];
          const votingPowers = result[2] || [];
          const depths = result[3] || [];
          
          for (let i = 0; i < addresses.length; i++) {
            analyticsData.push({
              address: addresses[i] || ethers.constants.AddressZero,
              delegate: delegates[i] || ethers.constants.AddressZero,
              votingPower: ethers.utils.formatEther(votingPowers[i] || 0),
              depth: depths[i] ? formatBigNumberToNumber(depths[i]) : 0
            });
          }
        }
      } catch (err) {
        console.error("Error in getDelegationAnalytics:", err);
      }
      
      try {
        // Get top delegate concentration
        console.log("Calling getTopDelegateConcentration");
        const topDelegateResult = await contracts.daoHelper.getTopDelegateConcentration(5);
        console.log("getTopDelegateConcentration raw result:", topDelegateResult);
        
        if (topDelegateResult && topDelegateResult.length >= 3) {
          const topDelegates = topDelegateResult[0] || [];
          const delegatedPowers = topDelegateResult[1] || [];
          const percentages = topDelegateResult[2] || [];
          
          for (let i = 0; i < topDelegates.length; i++) {
            topDelegateData.push({
              address: topDelegates[i] || ethers.constants.AddressZero,
              delegatedPower: ethers.utils.formatEther(delegatedPowers[i] || 0),
              percentage: formatBigNumberToNumber(percentages[i]) / 100 // Convert basis points to percentage
            });
          }
        }
      } catch (err) {
        console.error("Error in getTopDelegateConcentration:", err);
      }
      
      setDelegationAnalytics({
        delegations: analyticsData,
        topDelegates: topDelegateData
      });
      
      console.log("Updated delegation analytics:", {
        delegations: analyticsData,
        topDelegates: topDelegateData
      });
      
    } catch (error) {
      console.error("Error loading delegation analytics:", error);
      setError(`Failed to load delegation analytics: ${error.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [contracts, contractsReady]);

  // Load proposal analytics
  const loadProposalAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.governance) {
      setError("Governance contract not available");
      return;
    }
    
    try {
      setLoading(true);
      // We'll calculate some basic proposal analytics from the available contract methods
      
      // Initialize counters
      let totalProposals = 0;
      let activeProposals = 0;
      let succeededProposals = 0;
      let executedProposals = 0;
      let defeatedProposals = 0;
      let canceledProposals = 0;
      
      // Try to get proposals sequentially until we hit an invalid ID
      let id = 0;
      let isValid = true;
      const maxProposals = 30; // Limit to prevent excessive calls
      
      while (isValid && id < maxProposals) {
        try {
          const state = await contracts.governance.getProposalState(id);
          const stateNumber = formatBigNumberToNumber(state);
          console.log(`Proposal ${id} state:`, stateNumber);
          
          totalProposals++;
          
          // Count by state (state values: 0=Active, 1=Canceled, 2=Defeated, 3=Succeeded, 4=Queued, 5=Executed, 6=Expired)
          if (stateNumber === 0) activeProposals++;
          else if (stateNumber === 1) canceledProposals++;
          else if (stateNumber === 2) defeatedProposals++;
          else if (stateNumber === 3) succeededProposals++;
          else if (stateNumber === 5) executedProposals++;
          
          id++;
        } catch (err) {
          console.log(`No more valid proposals after ID ${id-1}:`, err.message);
          isValid = false;
        }
      }
      
      // Calculate success rate
      const successRate = totalProposals > 0 ? 
        ((succeededProposals + executedProposals) / totalProposals) * 100 : 0;
      
      // Calculate voter participation if possible
      let avgVotingTurnout = 0;
      
      if (totalProposals > 0 && contracts.justToken) {
        // Sample a few proposals to estimate turnout
        let totalTurnout = 0;
        let sampleCount = 0;
        
        for (let i = 0; i < Math.min(5, totalProposals); i++) {
          try {
            console.log(`Getting vote data for proposal ${i}`);
            const voteData = await contracts.governance.getProposalVotes(i);
            console.log(`Vote data for proposal ${i}:`, voteData);
            
            if (!voteData || voteData.length < 3) {
              console.warn(`Invalid vote data for proposal ${i}`);
              continue;
            }
            
            // Extract vote counts from the data
            const yesVotes = voteData[0] ? ethers.BigNumber.from(voteData[0]) : ethers.BigNumber.from(0);
            const noVotes = voteData[1] ? ethers.BigNumber.from(voteData[1]) : ethers.BigNumber.from(0);
            const abstainVotes = voteData[2] ? ethers.BigNumber.from(voteData[2]) : ethers.BigNumber.from(0);
            
            const totalVotes = yesVotes.add(noVotes).add(abstainVotes);
            
            // Get token total supply
            const totalSupply = await contracts.justToken.totalSupply();
            
            if (!totalSupply.isZero()) {
              try {
                // Calculate turnout percentage safely
                const turnoutPercentage = totalVotes.mul(100).div(totalSupply);
                const turnoutValue = formatBigNumberToNumber(turnoutPercentage);
                totalTurnout += turnoutValue;
                sampleCount++;
              } catch (convErr) {
                console.warn(`Error converting turnout value:`, convErr);
              }
            }
          } catch (err) {
            console.warn(`Error getting vote data for proposal ${i}:`, err);
          }
        }
        
        if (sampleCount > 0) {
          avgVotingTurnout = totalTurnout / sampleCount;
        }
      }
      
      setProposalAnalytics({
        totalProposals,
        activeProposals,
        succeededProposals,
        executedProposals,
        defeatedProposals,
        canceledProposals,
        successRate,
        avgVotingTurnout
      });
      
      console.log("Updated proposal analytics:", {
        totalProposals,
        activeProposals,
        succeededProposals,
        executedProposals,
        defeatedProposals,
        canceledProposals,
        successRate,
        avgVotingTurnout
      });
      
    } catch (error) {
      console.error("Error loading proposal analytics:", error);
      setError(`Failed to load proposal analytics: ${error.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [contracts, contractsReady]);

  // Load voter analytics
  const loadVoterAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.governance || !contracts.justToken) {
      setError("Governance or Token contract not available");
      return;
    }
    
    try {
      setLoading(true);
      // Get total token holders (approximation)
      const totalSupply = await contracts.justToken.totalSupply();
      
      // Get current snapshot ID
      let snapshotId;
      try {
        snapshotId = await contracts.justToken.getCurrentSnapshotId();
        console.log("Current snapshot ID:", snapshotId.toString());
      } catch (err) {
        console.warn("Failed to get snapshot ID:", err.message);
        snapshotId = ethers.BigNumber.from(0);
      }
      
      // Calculate delegation stats
      let delegatorCount = 0;
      let delegateCount = 0;
      let totalDelegated = ethers.BigNumber.from(0);
      
      try {
        // Use the delegation analytics if already loaded
        if (delegationAnalytics) {
          delegatorCount = delegationAnalytics.delegations.length;
          delegateCount = new Set(delegationAnalytics.delegations.map(d => d.delegate)).size;
          
          delegationAnalytics.delegations.forEach(d => {
            totalDelegated = totalDelegated.add(ethers.utils.parseEther(d.votingPower));
          });
        } else {
          // If not loaded yet, make a simpler calculation
          // This is just an approximation - in a real implementation, you'd query more delegation data
          const sampleAddresses = account ? [account] : [];
          
          for (const addr of sampleAddresses) {
            if (!addr) continue;
            
            try {
              const delegate = await contracts.justToken.getDelegate(addr);
              if (delegate !== ethers.constants.AddressZero && delegate !== addr) {
                delegateCount++;
              }
              
              const delegators = await contracts.justToken.getDelegatorsOf(addr);
              delegatorCount += delegators.length;
              
              try {
                const votingPower = await contracts.justToken.getDelegatedToAddress(addr);
                totalDelegated = totalDelegated.add(votingPower);
              } catch (vpErr) {
                console.warn(`Error getting delegation for ${addr}:`, vpErr.message);
              }
            } catch (err) {
              console.warn(`Error getting delegation info for ${addr}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.warn("Error calculating delegation stats:", err.message);
      }
      
      // Calculate participation rate safely
      let participationRate = 0;
      try {
        if (!totalSupply.isZero()) {
          participationRate = parseFloat(
            totalDelegated.mul(100).div(totalSupply).toString()
          ) / 100;
        }
      } catch (err) {
        console.warn("Error calculating participation rate:", err.message);
      }
      
      setVoterAnalytics({
        totalDelegators: delegatorCount,
        totalDelegates: delegateCount,
        participationRate,
        activeDelegated: ethers.utils.formatEther(totalDelegated)
      });
      
      console.log("Updated voter analytics:", {
        totalDelegators: delegatorCount,
        totalDelegates: delegateCount,
        participationRate,
        activeDelegated: ethers.utils.formatEther(totalDelegated)
      });
      
    } catch (error) {
      console.error("Error loading voter analytics:", error);
      setError(`Failed to load voter analytics: ${error.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [contracts, contractsReady, account, delegationAnalytics]);

  // Load token analytics
  const loadTokenAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.justToken) {
      setError("Token contract not available");
      return;
    }
    
    try {
      setLoading(true);
      // Get basic token information
      const totalSupply = await contracts.justToken.totalSupply();
      
      // Get current snapshot ID
      let snapshotId;
      try {
        snapshotId = await contracts.justToken.getCurrentSnapshotId();
      } catch (err) {
        console.warn("Failed to get snapshot ID:", err.message);
        snapshotId = ethers.BigNumber.from(0);
      }
      
      // Try to get snapshot metrics if available
      let activeHolders = 0;
      let activeDelegates = 0;
      let totalDelegated = ethers.BigNumber.from(0);
      
      try {
        console.log("Retrieving snapshot metrics for ID:", snapshotId.toString());
        const metrics = await contracts.justToken.getSnapshotMetrics(snapshotId);
        console.log("Snapshot metrics:", metrics);
        
        // Handle different return formats
        if (Array.isArray(metrics)) {
          activeHolders = formatBigNumberToNumber(metrics[1] || 0);
          activeDelegates = formatBigNumberToNumber(metrics[2] || 0);
          totalDelegated = metrics[3] || ethers.BigNumber.from(0);
        } else if (metrics && typeof metrics === 'object') {
          activeHolders = formatBigNumberToNumber(metrics.activeHolders || 0);
          activeDelegates = formatBigNumberToNumber(metrics.activeDelegates || 0);
          totalDelegated = metrics.totalDelegatedTokens || ethers.BigNumber.from(0);
        }
      } catch (err) {
        console.warn("Error getting snapshot metrics:", err.message);
        
        // Fall back to delegation analytics if available
        if (delegationAnalytics && delegationAnalytics.topDelegates) {
          activeDelegates = new Set(delegationAnalytics.topDelegates.map(d => d.address)).size;
        }
      }
      
      // Calculate the percentage delegated safely
      let percentageDelegated = 0;
      try {
        if (!totalSupply.isZero()) {
          percentageDelegated = parseFloat(
            totalDelegated.mul(100).div(totalSupply).toString()
          );
        }
      } catch (err) {
        console.warn("Error calculating percentage delegated:", err.message);
      }
      
      const tokenAnalyticsData = {
        totalSupply: ethers.utils.formatEther(totalSupply),
        activeHolders,
        activeDelegates,
        totalDelegated: ethers.utils.formatEther(totalDelegated),
        percentageDelegated
      };
      
      setTokenAnalytics(tokenAnalyticsData);
      console.log("Updated token analytics:", tokenAnalyticsData);
      
    } catch (error) {
      console.error("Error loading token analytics:", error);
      setError(`Failed to load token analytics: ${error.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [contracts, contractsReady, delegationAnalytics]);

  // Load timelock analytics
  const loadTimelockAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.timelock) {
      setError("Timelock contract not available");
      return;
    }
    
    try {
      setLoading(true);
      // Get timelock configuration
      const minDelay = await contracts.timelock.minDelay();
      let gracePeriod;
      
      try {
        gracePeriod = await contracts.timelock.gracePeriod();
      } catch (err) {
        console.warn("Error getting grace period:", err.message);
        gracePeriod = ethers.BigNumber.from(14 * 24 * 60 * 60); // Default to 14 days
      }
      
      // Get threat level delays
      let lowThreatDelay = ethers.BigNumber.from(0);
      let mediumThreatDelay = ethers.BigNumber.from(0);
      let highThreatDelay = ethers.BigNumber.from(0);
      let criticalThreatDelay = ethers.BigNumber.from(0);
      
      try {
        lowThreatDelay = await contracts.timelock.lowThreatDelay();
        mediumThreatDelay = await contracts.timelock.mediumThreatDelay();
        highThreatDelay = await contracts.timelock.highThreatDelay();
        criticalThreatDelay = await contracts.timelock.criticalThreatDelay();
      } catch (err) {
        console.warn("Error getting threat level delays:", err.message);
        // Fallback to minimum delay if specific delays are not available
        lowThreatDelay = minDelay;
        mediumThreatDelay = minDelay.mul(3);
        highThreatDelay = minDelay.mul(7);
        criticalThreatDelay = minDelay.mul(14);
      }
      
      // Get pending transactions (approximation)
      let pendingCount = ethers.BigNumber.from(0);
      try {
        pendingCount = await contracts.timelock.getPendingTransactionCount();
      } catch (err) {
        console.warn("Error getting pending transaction count:", err.message);
        // Fallback to a default value
        pendingCount = ethers.BigNumber.from(0);
      }
      
      const timelockAnalyticsData = {
        minDelay: formatBigNumberToNumber(minDelay),
        gracePeriod: formatBigNumberToNumber(gracePeriod),
        lowThreatDelay: formatBigNumberToNumber(lowThreatDelay),
        mediumThreatDelay: formatBigNumberToNumber(mediumThreatDelay),
        highThreatDelay: formatBigNumberToNumber(highThreatDelay),
        criticalThreatDelay: formatBigNumberToNumber(criticalThreatDelay),
        pendingTransactions: formatBigNumberToNumber(pendingCount)
      };
      
      setTimelockAnalytics(timelockAnalyticsData);
      console.log("Updated timelock analytics:", timelockAnalyticsData);
      
    } catch (error) {
      console.error("Error loading timelock analytics:", error);
      setError(`Failed to load timelock analytics: ${error.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [contracts, contractsReady]);

  // Calculate governance health score based on available metrics
  const calculateHealthScore = useCallback(() => {
    // Only calculate if we have all the necessary data
    if (!proposalAnalytics || !voterAnalytics || !tokenAnalytics || !timelockAnalytics) return;
    
    // Components of the health score:
    // 1. Proposal Success Rate (20%)
    // 2. Voter Participation (20%)
    // 3. Delegation Rate (20%)
    // 4. Proposal Activity (20%)
    // 5. Security Balance (20%)
    
    // 1. Calculate proposal success score (0-20)
    const successScore = Math.min(20, (proposalAnalytics.successRate / 100) * 20);
    
    // 2. Calculate voter participation score (0-20)
    const participationScore = Math.min(20, (voterAnalytics.participationRate * 2) * 20);
    
    // 3. Calculate delegation score (0-20)
    const delegationScore = Math.min(20, (tokenAnalytics.percentageDelegated / 100) * 20);
    
    // 4. Calculate proposal activity score (0-20)
    // Based on number of proposals, max score at 20 proposals
    const activityScore = Math.min(20, (proposalAnalytics.totalProposals / 20) * 20);
    
    // 5. Calculate security balance score (0-20)
    // Based on timelock delays having a good balance
    const securityScore = Math.min(20, ((
      timelockAnalytics.lowThreatDelay > 0 ? 5 : 0) +
      (timelockAnalytics.mediumThreatDelay > timelockAnalytics.lowThreatDelay ? 5 : 0) +
      (timelockAnalytics.highThreatDelay > timelockAnalytics.mediumThreatDelay ? 5 : 0) +
      (timelockAnalytics.criticalThreatDelay > timelockAnalytics.highThreatDelay ? 5 : 0)
    ));
    
    // Overall score (0-100)
    const overallScore = Math.round(
      successScore + participationScore + delegationScore + activityScore + securityScore
    );
    
    const healthScoreData = {
      overall: overallScore,
      components: [
        Math.round(successScore),
        Math.round(participationScore),
        Math.round(delegationScore),
        Math.round(activityScore),
        Math.round(securityScore)
      ]
    };
    
    setHealthScore(healthScoreData);
    console.log("Updated health score:", healthScoreData);
    
  }, [proposalAnalytics, voterAnalytics, tokenAnalytics, timelockAnalytics]);

  // Check contract connectivity when component mounts
  useEffect(() => {
    async function checkConnectivity() {
      const details = await checkContractConnectivity();
      setConnectionDetails(details);
      console.log("Contract connectivity details:", details);
    }
    
    checkConnectivity();
  }, [checkContractConnectivity]);

  // Load data based on selected metric
  useEffect(() => {
    if (!contractsReady) {
      setLoading(false);
      setError("Contracts not ready. Please connect your wallet.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        // Load data based on selected tab
        switch (selectedMetric) {
          case 'proposal':
            await loadProposalAnalytics();
            break;
          case 'voter':
            await loadVoterAnalytics();
            break;
          case 'token':
            await loadTokenAnalytics();
            break;
          case 'timelock':
            await loadTimelockAnalytics();
            break;
          case 'health':
            // Health score depends on all other metrics
            if (!proposalAnalytics) await loadProposalAnalytics();
            if (!voterAnalytics) await loadVoterAnalytics();
            if (!tokenAnalytics) await loadTokenAnalytics();
            if (!timelockAnalytics) await loadTimelockAnalytics();
            calculateHealthScore();
            break;
          case 'delegation':
            await loadDelegationAnalytics();
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`Error loading ${selectedMetric} analytics:`, err);
        setError(`Failed to load analytics: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [
    selectedMetric, 
    contractsReady, 
    loadProposalAnalytics, 
    loadVoterAnalytics, 
    loadTokenAnalytics, 
    loadTimelockAnalytics,
    loadDelegationAnalytics,
    calculateHealthScore,
    proposalAnalytics,
    voterAnalytics,
    tokenAnalytics,
    timelockAnalytics
  ]);

  // Format seconds to a human-readable duration
  const formatDuration = (seconds) => {
    if (!seconds) return "0 seconds";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  };

  // Simple progress bar component
  const ProgressBar = ({ value, max, color = "bg-blue-500" }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };

  // Render contract connectivity debug info
  const renderDebugInfo = () => {
    if (!connectionDetails) return null;
    
    return (
      <div className="bg-gray-100 p-4 mb-6 rounded-lg text-sm">
        <h3 className="font-bold mb-2">Contract Connection Details:</h3>
        <div>Connected: {connectionDetails.connected ? 'Yes' : 'No'}</div>
        {connectionDetails.message && <div className="text-red-500">{connectionDetails.message}</div>}
        {connectionDetails.networkId && <div>Network ID: {connectionDetails.networkId}</div>}
        {connectionDetails.account && <div>Account: {connectionDetails.account}</div>}
        
        {connectionDetails.contracts && (
          <div className="mt-2">
            <div className="font-bold">Contracts:</div>
            <ul className="pl-4">
              {Object.entries(connectionDetails.contracts).map(([name, details]) => (
                <li key={name} className="mb-1">
                  <strong>{name}:</strong>{' '}
                  {typeof details === 'string' ? details : (
                    details.error ? (
                      <span className="text-red-500">{details.error}</span>
                    ) : (
                      <span className="text-green-500">
                        Connected {details.address && `(${details.address.slice(0, 6)}...${details.address.slice(-4)})`}
                      </span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render metric selection buttons
  const renderMetricButtons = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'proposal' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('proposal')}
      >
        <BarChart className="w-4 h-4 mr-2" />
        Proposals
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'voter' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('voter')}
      >
        <PieChart className="w-4 h-4 mr-2" />
        Voters
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'token' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('token')}
      >
        <LineChart className="w-4 h-4 mr-2" />
        Tokens
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'timelock' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('timelock')}
      >
        <AreaChart className="w-4 h-4 mr-2" />
        Timelock
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'health' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('health')}
      >
        <BarChart className="w-4 h-4 mr-2" />
        Health Score
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'delegation' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        onClick={() => setSelectedMetric('delegation')}
      >
        <PieChart className="w-4 h-4 mr-2" />
        Delegation
      </button>
    </div>
  );

  // Render proposal analytics
  const renderProposalAnalytics = () => {
    if (!proposalAnalytics) return <div>No proposal data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Proposal Overview</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Total Proposals:</div>
            <div className="font-bold text-right">{proposalAnalytics.totalProposals}</div>
            <div>Active:</div>
            <div className="font-bold text-right">{proposalAnalytics.activeProposals}</div>
            <div>Succeeded:</div>
            <div className="font-bold text-right">{proposalAnalytics.succeededProposals}</div>
            <div>Executed:</div>
            <div className="font-bold text-right">{proposalAnalytics.executedProposals}</div>
            <div>Defeated:</div>
            <div className="font-bold text-right">{proposalAnalytics.defeatedProposals}</div>
            <div>Canceled:</div>
            <div className="font-bold text-right">{proposalAnalytics.canceledProposals}</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Success Metrics</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Success Rate:</span>
                <span className="font-bold">{formatPercentage(proposalAnalytics.successRate / 100)}</span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.successRate} 
                max={100} 
                color="bg-green-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Avg Voting Turnout:</span>
                <span className="font-bold">{formatPercentage(proposalAnalytics.avgVotingTurnout / 100)}</span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.avgVotingTurnout} 
                max={100} 
                color="bg-blue-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Execution Rate:</span>
                <span className="font-bold">
                  {formatPercentage(proposalAnalytics.totalProposals > 0 ? 
                    (proposalAnalytics.executedProposals / proposalAnalytics.totalProposals) : 0)}
                </span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.executedProposals} 
                max={proposalAnalytics.totalProposals} 
                color="bg-indigo-500" 
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Proposal Distribution</h3>
          {proposalAnalytics.totalProposals > 0 ? (
            <div>
              {/* Simple visual representation instead of a chart */}
              <div className="flex items-center mb-2">
                <div 
                  className="h-4 bg-yellow-400" 
                  style={{ width: `${(proposalAnalytics.activeProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-green-400" 
                  style={{ width: `${(proposalAnalytics.succeededProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-blue-400" 
                  style={{ width: `${(proposalAnalytics.executedProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-red-400" 
                  style={{ width: `${(proposalAnalytics.defeatedProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-gray-400" 
                  style={{ width: `${(proposalAnalytics.canceledProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-400 mr-1"></div>
                  <span>Active</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 mr-1"></div>
                  <span>Succeeded</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 mr-1"></div>
                  <span>Executed</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-400 mr-1"></div>
                  <span>Defeated</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 mr-1"></div>
                  <span>Canceled</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No proposals created yet</div>
          )}
        </div>
      </div>
    );
  };

  // Render voter analytics
  const renderVoterAnalytics = () => {
    if (!voterAnalytics) return <div>No voter data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Delegation Overview</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Total Delegators:</div>
            <div className="font-bold text-right">{voterAnalytics.totalDelegators}</div>
            <div>Total Delegates:</div>
            <div className="font-bold text-right">{voterAnalytics.totalDelegates}</div>
            <div>Participation Rate:</div>
            <div className="font-bold text-right">{formatPercentage(voterAnalytics.participationRate)}</div>
            <div>Active Delegated:</div>
            <div className="font-bold text-right">{parseFloat(voterAnalytics.activeDelegated).toFixed(2)} JST</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Delegation Metrics</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Participation Rate:</span>
                <span className="font-bold">{formatPercentage(voterAnalytics.participationRate)}</span>
              </div>
              <ProgressBar 
                value={voterAnalytics.participationRate * 100} 
                max={100} 
                color="bg-blue-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Delegation Ratio:</span>
                <span className="font-bold">
                  {voterAnalytics.totalDelegators > 0 ? 
                    (voterAnalytics.totalDelegates / voterAnalytics.totalDelegators).toFixed(2) : 
                    '0.00'} delegates per delegator
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render token analytics
  const renderTokenAnalytics = () => {
    if (!tokenAnalytics) return <div>No token data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Token Supply</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Total Supply:</div>
            <div className="font-bold text-right">{parseFloat(tokenAnalytics.totalSupply).toFixed(2)} JST</div>
            <div>Active Holders:</div>
            <div className="font-bold text-right">{tokenAnalytics.activeHolders}</div>
            <div>Active Delegates:</div>
            <div className="font-bold text-right">{tokenAnalytics.activeDelegates}</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Delegation Status</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Total Delegated:</div>
            <div className="font-bold text-right">{parseFloat(tokenAnalytics.totalDelegated).toFixed(2)} JST</div>
            <div>Percentage Delegated:</div>
            <div className="font-bold text-right">{formatPercentage(tokenAnalytics.percentageDelegated / 100)}</div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span>Delegation Progress:</span>
              <span className="font-bold">{formatPercentage(tokenAnalytics.percentageDelegated / 100)}</span>
            </div>
            <ProgressBar 
              value={tokenAnalytics.percentageDelegated} 
              max={100} 
              color="bg-green-500" 
            />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Token Distribution</h3>
          <div className="text-center pt-4">
            <div className="text-4xl font-bold">{tokenAnalytics.activeHolders}</div>
            <div className="text-gray-500">Active Token Holders</div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span>Holders / Delegates Ratio:</span>
              <span className="font-bold">
                {tokenAnalytics.activeDelegates > 0 ? 
                  (tokenAnalytics.activeHolders / tokenAnalytics.activeDelegates).toFixed(2) : 
                  '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render timelock analytics
  const renderTimelockAnalytics = () => {
    if (!timelockAnalytics) return <div>No timelock data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Timelock Configuration</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Minimum Delay:</div>
            <div className="font-bold text-right">{formatDuration(timelockAnalytics.minDelay)}</div>
            <div>Grace Period:</div>
            <div className="font-bold text-right">{formatDuration(timelockAnalytics.gracePeriod)}</div>
            <div>Pending Transactions:</div>
            <div className="font-bold text-right">{timelockAnalytics.pendingTransactions}</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Threat Level Delays</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span>Low Threat:</span>
                <span className="font-bold">{formatDuration(timelockAnalytics.lowThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.lowThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-green-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Medium Threat:</span>
                <span className="font-bold">{formatDuration(timelockAnalytics.mediumThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.mediumThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-yellow-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>High Threat:</span>
                <span className="font-bold">{formatDuration(timelockAnalytics.highThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.highThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-orange-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Critical Threat:</span>
                <span className="font-bold">{formatDuration(timelockAnalytics.criticalThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.criticalThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-red-500" 
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render health score
  const renderHealthScore = () => {
    if (!healthScore) return <div>No health score data available. Please ensure all analytics tabs have been loaded.</div>;
    
    const getScoreColor = (score) => {
      if (score >= 80) return "text-green-600";
      if (score >= 60) return "text-yellow-600";
      if (score >= 40) return "text-orange-600";
      return "text-red-600";
    };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow col-span-1 md:col-span-2">
          <h3 className="text-lg font-medium mb-4">Governance Health Score</h3>
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(healthScore.overall)}`}>
                {healthScore.overall}
              </div>
              <div className="text-gray-500 mt-2">out of 100</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-sm text-gray-500">Proposal Success</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[0] * 5)}`}>
                {healthScore.components[0]}/20
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-sm text-gray-500">Participation</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[1] * 5)}`}>
                {healthScore.components[1]}/20
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-sm text-gray-500">Delegation</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[2] * 5)}`}>
                {healthScore.components[2]}/20
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-sm text-gray-500">Activity</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[3] * 5)}`}>
                {healthScore.components[3]}/20
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-sm text-gray-500">Security</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[4] * 5)}`}>
                {healthScore.components[4]}/20
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Interpretation</h3>
          <p className="text-gray-700 mb-4">
            {healthScore.overall >= 80 && "Your DAO governance is in excellent health with strong participation and balanced decision-making."}
            {healthScore.overall >= 60 && healthScore.overall < 80 && "Your DAO governance is functioning well, though there's room for improvement in some areas."}
            {healthScore.overall >= 40 && healthScore.overall < 60 && "Your DAO governance needs attention in several key areas to improve effectiveness."}
            {healthScore.overall < 40 && "Your DAO governance is struggling and requires significant improvements across multiple dimensions."}
          </p>
          
          <h4 className="font-medium mt-4">Recommendations</h4>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
            {healthScore.components[0] < 10 && (
              <li>Improve proposal success rate by enhancing planning and community discussion before submission</li>
            )}
            {healthScore.components[1] < 10 && (
              <li>Increase voter participation by improving proposal visibility or incentives</li>
            )}
            {healthScore.components[2] < 10 && (
              <li>Enhance delegation mechanisms to encourage more balanced token delegation</li>
            )}
            {healthScore.components[3] < 10 && (
              <li>Increase governance activity with more regular proposals</li>
            )}
            {healthScore.components[4] < 10 && (
              <li>Review threat level configuration to ensure appropriate security for different actions</li>
            )}
          </ul>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Score Breakdown</h3>
          <p className="text-gray-700 mb-4">
            The governance health score is calculated based on five key dimensions:
          </p>
          
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Proposal Success (20%):</span> Measures proposal success rate and execution
            </div>
            <div>
              <span className="font-medium">Participation (20%):</span> Measures voter turnout and engagement
            </div>
            <div>
              <span className="font-medium">Delegation (20%):</span> Evaluates delegation patterns and concentration
            </div>
            <div>
              <span className="font-medium">Activity (20%):</span> Assesses proposal frequency and governance activity
            </div>
            <div>
              <span className="font-medium">Security (20%):</span> Evaluates timelock configuration and threat level balance
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render delegation analytics
  const renderDelegationAnalytics = () => {
    if (!delegationAnalytics) return <div>No delegation data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Top Delegates</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500">
                  <th className="p-2">Address</th>
                  <th className="p-2">Delegated Power</th>
                  <th className="p-2">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {delegationAnalytics.topDelegates.map((delegate, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2 font-mono text-xs">{delegate.address.substring(0, 6)}...{delegate.address.substring(delegate.address.length - 4)}</td>
                    <td className="p-2">{parseFloat(delegate.delegatedPower).toFixed(2)}</td>
                    <td className="p-2">{formatPercentage(delegate.percentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Delegation Chains</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500">
                  <th className="p-2">Delegator</th>
                  <th className="p-2">Delegate</th>
                  <th className="p-2">Power</th>
                  <th className="p-2">Depth</th>
                </tr>
              </thead>
              <tbody>
                {delegationAnalytics.delegations.slice(0, 5).map((delegation, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2 font-mono text-xs">{delegation.address.substring(0, 6)}...{delegation.address.substring(delegation.address.length - 4)}</td>
                    <td className="p-2 font-mono text-xs">{delegation.delegate.substring(0, 6)}...{delegation.delegate.substring(delegation.delegate.length - 4)}</td>
                    <td className="p-2">{parseFloat(delegation.votingPower).toFixed(2)}</td>
                    <td className="p-2">{delegation.depth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow col-span-1 md:col-span-2">
          <h3 className="text-lg font-medium mb-2">Delegation Concentration</h3>
          <div className="h-8 w-full flex items-center">
            {delegationAnalytics.topDelegates.length > 0 ? (
              delegationAnalytics.topDelegates.map((delegate, index) => (
                <div
                  key={index}
                  className={`h-8 ${index % 2 === 0 ? 'bg-blue-500' : 'bg-blue-700'}`}
                  style={{ width: `${delegate.percentage * 100}%` }}
                  title={`${delegate.address}: ${formatPercentage(delegate.percentage)}`}
                ></div>
              ))
            ) : (
              <div className="text-gray-500">No delegation data</div>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {delegationAnalytics.topDelegates.length > 0 ? (
              <div>
                Top {delegationAnalytics.topDelegates.length} delegates control {formatPercentage(delegationAnalytics.topDelegates.reduce((sum, delegate) => sum + delegate.percentage, 0))} of delegated voting power
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Main render function
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">DAO Governance Analytics</h2>
      
      {!contractsReady && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Wallet not connected!</strong> Please connect your wallet to access contract data.
        </div>
      )}
      
      {renderDebugInfo()}
      {renderMetricButtons()}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <div>
          {selectedMetric === 'proposal' && renderProposalAnalytics()}
          {selectedMetric === 'voter' && renderVoterAnalytics()}
          {selectedMetric === 'token' && renderTokenAnalytics()}
          {selectedMetric === 'timelock' && renderTimelockAnalytics()}
          {selectedMetric === 'health' && renderHealthScore()}
          {selectedMetric === 'delegation' && renderDelegationAnalytics()}
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;