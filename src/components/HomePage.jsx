import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { formatTokenAmount } from '../utils/tokenFormatters';
import { ethers } from 'ethers';
import { 
  Scale, 
  MapPin, 
  Home, 
  Briefcase, 
  Network, 
  BarChart4, 
  CircleDollarSign, 
  CoinsIcon, 
  Landmark, 
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  Award
} from 'lucide-react';

// Custom components and hooks
const JustDAOLandingPage = ({ onNavigateToMain }) => {
  
  // Function to navigate to specific app section
  const navigateToAppSection = (section) => {
    console.log(`Attempting to navigate to section: ${section}`);
    
    // First, try the prop-based navigation
    if (typeof onNavigateToMain === 'function') {
      console.log('Using onNavigateToMain for navigation');
      onNavigateToMain(section);
    }
    
    // Set the active tab directly
    setActiveTab(section);
    
    // Fallback navigation methods
    setTimeout(() => {
      // Try data-tab attribute
      const tabElement = document.querySelector(`[data-tab="${section}"]`);
      if (tabElement) {
        console.log(`Found tab element for ${section}`);
        tabElement.click();
        return;
      }
      
      // Try alternative selectors
      const alternativeSelectors = [
        `[data-tab="${section}-tab"]`,
        `button[aria-controls="${section}"]`,
        `a[href="#${section}"]`
      ];
      
      for (const selector of alternativeSelectors) {
        const fallbackElement = document.querySelector(selector);
        if (fallbackElement) {
          console.log(`Found fallback element with selector: ${selector}`);
          fallbackElement.click();
          return;
        }
      }
      
      console.error(`Could not find navigation target for section: ${section}`);
    }, 100);
  };

  const [activeTab, setActiveTab] = useState('mission');
  const [governanceData, setGovernanceData] = useState({});
  const [tokenData, setTokenData] = useState({});
  const [timelockData, setTimelockData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [threatLevelInfo, setThreatLevelInfo] = useState({});
  const [topDelegates, setTopDelegates] = useState([]);
  const [pendingProposals, setPendingProposals] = useState([]);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  
  // Mission tab specific states
  const [impactMetrics, setImpactMetrics] = useState(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactError, setImpactError] = useState(null);
  const [externalData, setExternalData] = useState(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Get web3 context for blockchain connection
  const { account, isConnected, connectWallet, disconnectWallet, contracts } = useWeb3();
  const { userData, daoStats, refreshData } = useBlockchainData();

  // Simulated API endpoints (replace with real ones in production)
  const API_ENDPOINTS = {
    IMPACT_METRICS: 'https://api.justdao.org/v1/metrics/impact',
    LEGAL_AID_DATA: 'https://api.justdao.org/v1/data/legal-aid',
    CASE_STATISTICS: 'https://api.justdao.org/v1/stats/cases',
    COMMUNITY_ENGAGEMENT: 'https://api.justdao.org/v1/stats/community'
  };

  // Fetch impact metrics from API
  const fetchImpactMetrics = useCallback(async () => {
    setImpactLoading(true);
    setImpactError(null);
    
    try {
      // In production, uncomment this and use real API:
      // const response = await axios.get(API_ENDPOINTS.IMPACT_METRICS);
      // const data = response.data;
      
      // Simulated API response
      const data = {
        casesResolved: {
          total: 0,
          byType: {
            housing: 0,
            family: 0,
            immigration: 0,
            consumer: 0
          },
          quarterly: {
            q1: 0,
            q2: 0,
            q3: 0,
            q4: 0
          }
        },
        geographicCoverage: {
          statesCovered: 1,
          topStates: ['Indiana'],
          growthRate: 10
        },
        externalAnalysis: {
          evictionCrisis: {
            description: "3.7M households at risk of eviction nationwide",
            daoImpact: "Assisted 0 households with eviction defense",
            successRate: 100
          },
          immigrationBacklog: {
            description: "1.4M case backlog in immigration courts nationwide",
            daoImpact: "Provided representation for 0 cases",
            successRate: 100
          }
        },
        communityMetrics: {
          forumPosts: "0",
          growthLastMonth: 10
        },
        clientDemographics: {
          incomeDistribution: {
            belowPoverty: 0,
            lowIncome: 0,
            middleIncome: 0
          },
          languages: {
            english: 1,
            spanish: 0,
            chinese: 0,
            other: 8
          }
        },
        impactAssessment: {
          monetaryBenefit: {
            total: 0,
            average: 0
          },
          qualityOfLife: {
            housingStability: 0,
            familyUnity: 0,
            legalSecurity: 0
          }
        },
        npsScore: 0,
        lastUpdated: new Date().toISOString()
      };
      
      setImpactMetrics(data);
      setLastUpdated(new Date(data.lastUpdated));
      setImpactLoading(false);
    } catch (error) {
      console.error("Error fetching impact metrics:", error);
      setImpactError(error.message || "Failed to load impact metrics");
      setImpactLoading(false);
    }
  }, []);

  // Fetch external legal aid data
  const fetchExternalData = useCallback(async () => {
    try {
      // In production, uncomment this and use real API:
      // const response = await axios.get(API_ENDPOINTS.LEGAL_AID_DATA);
      // const data = response.data;
      
      // Simulated API response
      const data = {
        casesResolved: "0",
        casesByType: {
          housing: "0",
          family: "0",
          immigration: "0",
          consumer: "0"
        },
        statesCovered: "1",
        evictionData: {
          description: "3.7M households at risk of eviction nationwide",
          nationalTrends: [
            { month: "Jan", cases: 0 },
            { month: "Feb", cases: 0 },
            { month: "Mar", cases: 0 },
            { month: "Apr", cases: 0 }
          ]
        },
        immigrationData: {
          description: "1.4M case backlog in immigration courts nationwide",
          avgWaitTime: "4.2 years"
        },
        communityMetrics: {
          forumPosts: "0",
          discordMembers: "0",
          weeklyCallAttendees: "0",
          researchContributions: "0"
        },
        upcomingInitiatives: [
          {
            title: "Expanded Tenant Rights Assistance",
            startDate: "2026-06-01",
            targetBeneficiaries: 17,
            fundingRequired: 175000
          },
          {
            title: "Immigration Rapid Response Team",
            startDate: "2026-05-15",
            targetBeneficiaries: 21,
            fundingRequired: 210000
          },
          {
            title: "Family Law Clinic Expansion",
            startDate: "2026-07-10",
            targetBeneficiaries: 14,
            fundingRequired: 145000
          }
        ],
        partnerOrganizations: [
          "National Equal Justice Alliance",
          "Urban Housing Rights Coalition",
          "Immigrant Defense Project",
          "Consumer Protection Law Center"
        ]
      };
      
      setExternalData(data);
    } catch (error) {
      console.error("Error fetching external data:", error);
      // Keep any existing data if fetch fails
    }
  }, []);

  // Function to handle manual refresh of impact metrics
  const handleRefreshMetrics = async () => {
    setRefreshingMetrics(true);
    await Promise.all([
      fetchImpactMetrics(),
      fetchExternalData()
    ]);
    setRefreshingMetrics(false);
  };

  // Fetch on-chain data when component mounts or when contracts change
  useEffect(() => {
    const fetchOnChainData = async () => {
      if (!contracts || !contracts.justToken || !contracts.governance || !contracts.timelock) {
        setConnectionError(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setConnectionError(false);

      try {
        // Fetch token data
        const [maxSupply, totalSupply] = await Promise.all([
          contracts.justToken.maxTokenSupply(),
          contracts.justToken.totalSupply()
        ]);

        const currentSnapshotId = await contracts.justToken.getCurrentSnapshotId();
        
        // Get snapshot metrics
        const metrics = await contracts.justToken.getSnapshotMetrics(currentSnapshotId);
        
        setTokenData({
          maxSupply: ethers.utils.formatEther(maxSupply),
          totalSupply: ethers.utils.formatEther(totalSupply), // Keep full precision
          currentSnapshotId: currentSnapshotId.toString(),
          activeHolders: metrics[1].toString(),
          activeDelegates: metrics[2].toString(),
          totalDelegated: ethers.utils.formatEther(metrics[3]),
          percentageDelegated: (metrics[4].toNumber() / 100).toFixed(2),
          topDelegate: metrics[5],
          topDelegateTokens: ethers.utils.formatEther(metrics[6])
        });

        // Fetch governance data
        const govParams = await contracts.governance.govParams();
        
        setGovernanceData({
          votingDuration: (govParams.votingDuration.toNumber() / 86400).toFixed(1), // in days
          quorum: ethers.utils.formatEther(govParams.quorum),
          proposalCreationThreshold: ethers.utils.formatEther(govParams.proposalCreationThreshold),
          proposalStake: ethers.utils.formatEther(govParams.proposalStake),
          defeatedRefundPercentage: govParams.defeatedRefundPercentage.toString(),
          canceledRefundPercentage: govParams.canceledRefundPercentage.toString(),
          expiredRefundPercentage: govParams.expiredRefundPercentage.toString(),
          formattedDuration: `${(govParams.votingDuration.toNumber() / 86400).toFixed(1)} days (voting period)`
        });

        // Fetch timelock data
        const [lowDelay, mediumDelay, highDelay, criticalDelay, grace] = await Promise.all([
          contracts.timelock.lowThreatDelay(),
          contracts.timelock.mediumThreatDelay(),
          contracts.timelock.highThreatDelay(),
          contracts.timelock.criticalThreatDelay(),
          contracts.timelock.gracePeriod()
        ]);

        setTimelockData({
          lowThreatDelay: (lowDelay.toNumber() / 86400).toFixed(1), // in days
          mediumThreatDelay: (mediumDelay.toNumber() / 86400).toFixed(1),
          highThreatDelay: (highDelay.toNumber() / 86400).toFixed(1),
          criticalThreatDelay: (criticalDelay.toNumber() / 86400).toFixed(1),
          gracePeriod: (grace.toNumber() / 86400).toFixed(1)
        });

        // Try to get pending transactions if timelock exists
        try {
          const pendingTxs = await contracts.timelock.getPendingTransactions();
          const pendingDetails = await Promise.all(
            pendingTxs.slice(0, 3).map(async (txHash) => {
              const tx = await contracts.timelock.getTransaction(txHash);
              const status = await contracts.timelock.getTransactionStatus(txHash);
              
              return {
                hash: txHash,
                target: tx[0],
                value: tx[1].toString(),
                eta: new Date(tx[3].toNumber() * 1000).toLocaleString(),
                ready: status[5]
              };
            })
          );
          
          setPendingProposals(pendingDetails);
        } catch (error) {
          console.error("Error fetching pending transactions:", error);
          setPendingProposals([]);
        }

        // Try to get top delegates if DAOHelper exists
        if (contracts.daoHelper) {
          try {
            const delegateData = await contracts.daoHelper.getTopDelegateConcentration(5);
            const topDelegatesList = [];
            
            for (let i = 0; i < delegateData[0].length; i++) {
              topDelegatesList.push({
                address: delegateData[0][i],
                power: ethers.utils.formatEther(delegateData[1][i]),
                percentage: (delegateData[2][i].toNumber() / 100).toFixed(2)
              });
            }
            
            setTopDelegates(topDelegatesList);
          } catch (error) {
            console.error("Error fetching top delegates:", error);
            setTopDelegates([]);
          }
        }

        // Add information about threat levels
        setThreatLevelInfo({
          LOW: "Basic operations like a hard votes, creating a snapshot, and general administrative actions",
          MEDIUM: "Parameter changes including governance settings, voting periods, and quorum requirements",
          HIGH: "Role management, token minting/burning, and significant contract modifications",
          CRITICAL: "Core system changes, upgrading contracts, or critical security configurations"
        });

      } catch (error) {
        console.error("Error fetching on-chain data:", error);
        setConnectionError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch both blockchain and API data
    if (isConnected) {
      fetchOnChainData();
      fetchImpactMetrics();
      fetchExternalData();
    } else {
      setIsLoading(false);
      // Still fetch external data even if not connected
      fetchExternalData();
    }
  }, [contracts, isConnected, fetchImpactMetrics, fetchExternalData]);

  // Format addresses for display
  const formatAddress = (address) => {
    if (!address) return '-';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format dollars for display
  const formatDollars = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

 
  // Define colors based on threat level
  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
   {/* Hero Section */}
<div className="relative bg-indigo-800 dark:bg-indigo-950">
    <div className="absolute inset-0 overflow-hidden">
      <svg className="absolute left-0 transform translate-y-32 opacity-20" width="800" height="500" fill="none" viewBox="0 0 800 500">
        <path d="M400 0l400 200v400H0V200L400 0z" fill="#fff" />
      </svg>
      <svg className="absolute right-0 top-0 transform translate-x-32 opacity-20" width="800" height="500" fill="none" viewBox="0 0 800 500">
        <circle cx="400" cy="250" r="200" fill="#fff" />
      </svg>
    </div>
    <div className="relative max-w-7xl mx-auto py-14 px-4 sm:py-22 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
        JustDAO
      </h1>
      <p className="mt-6 text-xl text-white font-medium max-w-3xl">
        A decentralized governance system designed to provide transparent, secure, and efficient funding for legal aid service providers.
      </p>
      <div className="mt-10 flex space-x-4">
        {!isConnected ? (
          <button
            onClick={connectWallet}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50"
          >
            Connect Wallet
          </button>
        ) : (
          <button>
           
          </button>
        )}
        <a
          href="#how-it-works"
          onClick={() => setActiveTab('how-it-works')}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 bg-opacity-60 hover:bg-opacity-80"
        >
          Learn More
        </a>
        <button
  onClick={() => setShowDisclaimerModal(true)}
  className="inline-flex items-center px-6 py-3 text-base font-medium rounded-md text-amber-900 dark:text-white bg-amber-400 dark:bg-amber-600 hover:bg-amber-500 dark:hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 transition-colors"
>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className="h-5 w-5 mr-2" 
    viewBox="0 0 20 20" 
    fill="currentColor"
  >
    <path 
      fillRule="evenodd" 
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
      clipRule="evenodd" 
    />
  </svg>
  Legal Disclaimer
</button>
      </div>
    </div>
        {/* Legal Disclaimer Modal */}
        {showDisclaimerModal && (
 <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center p-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col w-2/3 max-h-[80vh]">
   <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
     <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Important Legal Disclaimer</h3>
        <button 
          onClick={() => setShowDisclaimerModal(false)} 
          className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-grow text-gray-800 dark:text-gray-200 space-y-4">
  <p className="text-lg font-extrabold text-red-700 dark:text-red-400">
    <strong>JustDAO</strong> is not a law firm and does not provide legal services directly.
  </p>

  <p>
    <strong className="text-indigo-600 dark:text-indigo-400">JustDAO</strong> is a <span className="italic">decentralized autonomous organization</span> that supports legal aid initiatives through <span className="font-medium">community-directed funding and governance</span>.
  </p>

  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
    Participation in <strong>JustDAO</strong> is subject to the following important limitations and risks:
  </p>

  <ol className="list-decimal pl-5 space-y-3 text-sm md:text-base">
    <li>
      <span className="font-bold text-red-700 dark:text-red-400">
        JustDAO does not establish an attorney-client relationship with token holders, voters, or other governance participants.
      </span>
    </li>
    <li>
      Legal services are provided exclusively by independent legal aid organizations selected by the DAO. <strong>JustDAO</strong> itself does not deliver or supervise these services.
    </li>
    <li>
      Participation in DAO governance <span className="font-medium">does not constitute the practice of law</span>. All governance activity must comply with relevant laws and regulations.
    </li>
    <li>
      Governance decisions may result in <span className="italic">real-world legal and policy consequences</span>.
    </li>
    <li>
      The DAO is structured to maintain a clear separation between governance decisions and the independent legal work performed by service providers.
    </li>
    <li>
      <span className="font-semibold text-red-700 dark:text-red-400">
        JustDAO provides no warranties or guarantees
      </span> regarding the quality, accuracy, or outcomes of services offered by funded providers.
    </li>
    <li>
      Regulatory frameworks affecting DAOs, digital assets, and the funding of legal services are evolving and may impact <strong>JustDAO</strong>'s ability to operate.
    </li>
    <li>
      There are technical risks inherent in DAO-based systems, including potential vulnerabilities in smart contracts, infrastructure failures, or security breaches.
    </li>
  </ol>

  <p className="font-medium text-sm md:text-base">
    By participating in <strong className="text-indigo-600 dark:text-indigo-400">JustDAO</strong>, you acknowledge and accept these risks and limitations. If you require legal advice regarding your personal situation, please consult directly with a <span className="font-bold text-red-700 dark:text-red-400">licensed attorney</span>.
  </p>
</div>

      <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <button 
          onClick={() => setShowDisclaimerModal(false)} 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
        >
          I Understand
        </button>
      </div>
    </div>
  </div>
)}
      </div>

            

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            <button
              className={`py-4 px-6 font-medium border-b-2 ${
                activeTab === 'mission' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'
              }`}
              onClick={() => setActiveTab('mission')}
            >
              Mission
            </button>
            <button
              className={`py-4 px-6 font-medium border-b-2 ${
                activeTab === 'token' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'
              }`}
              onClick={() => setActiveTab('token')}
            >
              Token
            </button>
            <button
              className={`py-4 px-6 font-medium border-b-2 ${
                activeTab === 'governance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'
              }`}
              onClick={() => setActiveTab('governance')}
            >
              Governance
            </button>
            <button
              className={`py-4 px-6 font-medium border-b-2 ${
                activeTab === 'security' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'
              }`}
              onClick={() => setActiveTab('security')}
            >
              Security
            </button>
            <button
              className={`py-4 px-6 font-medium border-b-2 ${
                activeTab === 'how-it-works' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-600'
              }`}
              onClick={() => setActiveTab('how-it-works')}
              id="how-it-works"
            >
              How It Works
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading on-chain data...</span>
          </div>
        ) : connectionError ? (
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Connection Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>Unable to connect to the blockchain. Please connect your wallet to view on-chain data.</p>
                  <button 
                    onClick={connectWallet}
                    className="mt-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Connect Wallet
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Mission Tab */}
            {activeTab === 'mission' && (
              <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Our Mission</h2>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                JustDAO's mission is to enhance access to legal aid through decentralized governance, enabling token holders to directly fund and support initiatives that make a meaningful impact.                  </p>
              </div>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-full p-3">
                        <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div className="ml-5">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Accessible Legal Aid</h3>
                      </div>
                    </div>
                    <div className="mt-4 text-gray-600 dark:text-gray-300">
                      <p>Provide access to legal resources for those who cannot afford traditional legal representation, working toward justice for all.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/50 rounded-full p-3">
                        <svg className="h-6 w-6 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="ml-5">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Community Governance</h3>
                      </div>
                    </div>
                    <div className="mt-4 text-gray-600 dark:text-gray-300">
                      <p>Funding allocation decisions are made through community voting, creating a collaborative approach to legal aid funding.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900/50 rounded-full p-3">
                        <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="ml-5">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transparency</h3>
                      </div>
                    </div>
                    <div className="mt-4 text-gray-600 dark:text-gray-300">
                      <p>All funding decisions and transactions are initiated on the blockchain, providing transparency in how funds are allocated.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Key Impact Areas</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Home className="h-5 w-5 text-rose-400 dark:text-rose-300" />
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Housing Rights</h4>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Providing legal assistance for tenants facing eviction, housing discrimination, and unsafe living conditions.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Scale className="h-5 w-5 text-green-400 dark:text-green-300" />
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Family Law</h4>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Supporting families in custody disputes, domestic violence cases, and child support arrangements.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-blue-400 dark:text-blue-300" />
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Immigration</h4>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Assisting with asylum applications, deportation defense, and visa processing for vulnerable populations.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Briefcase className="h-5 w-5 text-orange-400 dark:text-orange-300" />
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Consumer Protection</h4>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Helping individuals with debt collection defense, predatory lending cases, and bankruptcy proceedings.</p>
                  </div>
                </div>
              </div>
                
                {/* Current Status Dashboard with Multiple Sections */}
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center">
                        <BarChart4 className="mr-2 h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                        Current Status
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400"></p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {lastUpdated && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                          <Clock className="inline-block w-3 h-3 mr-1" />
                          Updated: {lastUpdated.toLocaleString()}
                        </span>
                      )}
                      <button 
                        onClick={handleRefreshMetrics}
                        disabled={refreshingMetrics}
                        className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-1 rounded-full flex items-center hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50"
                      >
                        {refreshingMetrics ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Refreshing...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Refresh Data
                          </>
                        )}
                      </button>
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full flex items-center">
                        <span className="inline-block h-2 w-2 mr-1 bg-green-500 rounded-full pulse-animation"></span>
                        Live data {isConnected ? `as of ${new Date().toLocaleTimeString()}` : "- Connect wallet to refresh"}
                      </span>
                    </div>
                  </div>
                  
                  {/* For Loading State */}
                  {!isConnected ? (
                    <div className="py-8 px-4 text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <AlertTriangle className="h-10 w-10 text-amber-500" />
                        <p>Connect your wallet to view live JustDAO metrics</p>
                        <button
                          onClick={connectWallet}
                          className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Connect Wallet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Financial & Treasury Metrics */}
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30">
                          <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 flex items-center">
                            <CircleDollarSign className="w-4 h-4 mr-1" />
                            Financial & Treasury Metrics
                          </h4>
                        </div>
                        <dl>
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Funds Distributed</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 flex items-center">
                              <span>{daoStats?.totalFundsDistributed || "0"} ETH</span>
                              {parseFloat(daoStats?.totalFundsDistributed || 0) > 0 && (
                                <div className="ml-3 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                  ~${(parseFloat(daoStats?.totalFundsDistributed || 0) * (daoStats?.ethPrice || 3500)).toLocaleString()} USD
                                </div>
                              )}
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Treasury Growth Rate</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 flex items-center">
                              <span>{daoStats?.treasuryGrowthRate || "0"}% month-over-month</span>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                parseFloat(daoStats?.treasuryGrowthChange || 0) >= 0 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" 
                                  : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              }`}>
                                {parseFloat(daoStats?.treasuryGrowthChange || 0) >= 0 ? "↑" : "↓"} {Math.abs(parseFloat(daoStats?.treasuryGrowthChange || 0))}%
                              </span>
                            </dd>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Circulation</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="flex justify-between items-center mb-1">
                                <span>Circulating: {daoStats?.circulatingSupply || "0"} JST</span>
                              </div>
                            
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                              <Network className="w-4 h-4 mr-1 text-indigo-500 dark:text-indigo-400" />
                              JST Token Contract
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 relative">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center">
                                  <span className="font-mono text-xs sm:text-sm break-all">0x051B5e728BD7d77707DE7e7Eb41D32fCd7Eb3df1</span>
                                  {/* Force the status to green by using hardcoded bg-green-500 instead of conditional styling */}
                                  <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                                </div>
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 italic flex items-center">
                                  <CoinsIcon className="w-3 h-3 mr-1" />
                                  ✨ Send ETH here to mint JST tokens - instant tokenization!
                                </div>
                              </div>
                            </dd>
                          </div>
                        </dl>
                      </div>
                      
                      {/* Governance Activity & Metrics */}
                      <div>
                        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30">
                          <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center">
                            <Landmark className="w-4 h-4 mr-1" />
                            Governance Activity & Metrics
                          </h4>
                        </div>
                        <dl>
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Legal Aid Initiatives</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="flex items-center">
                                <span className="text-lg font-medium">{daoStats?.activeInitiatives || "0"}</span>
                                <div className="ml-4 flex-1">
                                  <div className="grid grid-cols-4 gap-1 h-4">
                                    <div className="bg-blue-400 dark:bg-blue-600 rounded-l" 
                                        style={{width: `${(daoStats?.initiativeDistribution?.housing || 1) * 100 / 100}%`}}></div>
                                    <div className="bg-purple-400 dark:bg-purple-600" 
                                        style={{width: `${(daoStats?.initiativeDistribution?.family || 1) * 100 / 100}%`}}></div>
                                    <div className="bg-green-400 dark:bg-green-600" 
                                        style={{width: `${(daoStats?.initiativeDistribution?.immigration || 1) * 100 / 100}%`}}></div>
                                    <div className="bg-amber-400 dark:bg-amber-600 rounded-r" 
                                        style={{width: `${(daoStats?.initiativeDistribution?.consumer || 1) * 100 / 100}%`}}></div>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>Housing</span>
                                    <span>Family</span>
                                    <span>Immigration</span>
                                    <span>Consumer</span>
                                  </div>
                                </div>
                              </div>
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Proposal Analytics</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
                                  <div className="text-lg font-medium">{daoStats?.activeProposals || "0"}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                                  <div className="text-lg font-medium">{daoStats?.totalProposals || "0"}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                                  <div className="text-lg font-medium">{daoStats?.formattedSuccessRate || "0%"}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Avg. Execution</div>
                                  <div className="text-lg font-medium">{daoStats?.avgProposalExecutionTime || "5.2"} days</div>
                                </div>
                              </div>
                            </dd>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Voting Period</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                            {governanceData?.formattedDuration || "Loading..."}
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Governance Success Rate</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span>{daoStats?.formattedSuccessRate || "0%"} of proposals pass</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400"></span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500 dark:bg-green-400" 
                                    style={{ width: `${daoStats?.proposalSuccessRate * 100 || 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            </dd>
                          </div>
                        </dl>
                      </div>
                      
                      {/* Community & Delegation Metrics */}
                      <div>
                        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30">
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            Community & Delegation Metrics
                          </h4>
                        </div>
                        <dl>
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Community Members</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="flex items-center">
                                <span>{daoStats?.totalHolders || tokenData?.activeHolders || "0"}</span>
                                {daoStats?.newHoldersLastMonth > 0 && (
                                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                    +{daoStats?.newHoldersLastMonth || "7"} last month
                                  </span>
                                )}
                              </div>
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Distribution Equality</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="space-y-3">
                                <div className="flex items-center">
                                  <div className="w-full">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-medium">Gini Coefficient: {daoStats?.giniCoefficient || "0"}</span>
                                      <div className="flex items-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                          parseFloat(daoStats?.giniCoefficient || 0) < 0.4 
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" 
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                                        }`}>
                                          {parseFloat(daoStats?.giniCoefficient || 0) < 0.4 ? "Highly Equitable" : "Moderate Equity"}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Improved visualization showing our position */}
                                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                      <div className="absolute inset-0 flex">
                                        <div className="w-2/5 h-full bg-green-500 dark:bg-green-600 flex items-center justify-center relative">
                                          <span className="absolute top-4 text-xs">Perfect Equality (0.0)</span>
                                        </div>
                                        <div className="w-3/5 h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 dark:from-green-600 dark:via-yellow-600 dark:to-red-600"></div>
                                      </div>
                                      {/* Marker showing our position */}
                                      <div className="absolute top-0 bottom-0 w-1 bg-black dark:bg-white" 
                                          style={{ left: `${(parseFloat(daoStats?.giniCoefficient || 0.1) * 100)}%` }}>
                                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-black dark:bg-white"></div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-8">
                                      <span>0.0 (Perfect Equality)</span>
                                      <span>0.5 (Average)</span>
                                      <span>1.0 (Complete Inequality)</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Add explanation tooltip */}
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium block mb-1">What is the Gini Coefficient?</span>
                                  The Gini coefficient measures how evenly tokens are distributed among holders. 
                                  <ul className="list-disc pl-5 mt-1 space-y-1">
                                    <li><span className="font-medium">0.0:</span> Perfect equality - every holder has exactly the same amount</li>
                                    <li><span className="font-medium">0.3-0.4:</span> High equality - JustDAO aims for this range to ensure broad participation</li>
                                    <li><span className="font-medium">0.6-1.0:</span> High concentration - few holders control most tokens</li>
                                  </ul>
                                  <p className="mt-1">Lower values indicate more democratic governance where voting power is distributed more evenly.</p>
                                </div>
                              </div>
                            </dd>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Participation Rate</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>{daoStats?.formattedParticipationRate || "0%"}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500 dark:bg-indigo-400" 
                                    style={{ width: `${parseFloat(daoStats?.participationRate || 0) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </dd>
                          </div>
                          
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Delegation Stability Index</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                              <div className="space-y-1">
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{daoStats?.delegationStabilityIndex || "0"}/10</span>
                                <div className="flex flex-wrap gap-1 text-xs">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    {daoStats?.stableDelegatesPercentage || "0"}% stable delegates
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    {daoStats?.changedDelegatesPercentage || "0"}% changed in last 3 months
                                  </span>
                                </div>
                              </div>
                            </dd>
                          </div>
                        </dl>
                      </div>
                      
                      {/* Impact Metrics & External Data */}
                      <div>
                        <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30">
                          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center">
                            <Scale className="w-4 h-4 mr-1" />
                            Impact Metrics & External Data
                          </h4>
                        </div>
                        {/* Impact metrics loading states */}
                        {impactLoading ? (
                          <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                            <p className="text-gray-500 dark:text-gray-400">Loading impact metrics...</p>
                          </div>
                        ) : impactError ? (
                          <div className="p-6 text-center">
                            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                            <p className="text-red-500 dark:text-red-400">{impactError}</p>
                            <button
                              onClick={fetchImpactMetrics}
                              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                              Try Again
                            </button>
                          </div>
                        ) : (
                          <dl>
                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Legal Cases Resolved</dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {impactMetrics?.casesResolved?.total || externalData?.casesResolved || "0"} cases successfully resolved
                                    
                                    {/* Badge showing quarter over quarter change */}
                                    {impactMetrics?.casesResolved?.quarterly && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                        This quarter: {impactMetrics.casesResolved.quarterly.q3} cases
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                      {impactMetrics?.casesResolved?.byType?.housing || externalData?.casesByType?.housing || "0"} Housing
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                                      {impactMetrics?.casesResolved?.byType?.family || externalData?.casesByType?.family || "0"} Family Law
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                      {impactMetrics?.casesResolved?.byType?.immigration || externalData?.casesByType?.immigration || "0"} Immigration
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                                      {impactMetrics?.casesResolved?.byType?.consumer || externalData?.casesByType?.consumer || "0"} Consumer
                                    </span>
                                  </div>

                                  {/* Show quarterly breakdown if available */}
                                  {impactMetrics?.casesResolved?.quarterly && (
                                    <div className="mt-3">
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quarterly Breakdown</div>
                                      <div className="flex space-x-1">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-8 rounded-l-md relative overflow-hidden">
                                          <div className="absolute inset-0 bg-blue-400 dark:bg-blue-600 opacity-80" 
                                              style={{width: `${impactMetrics.casesResolved.quarterly.q1 / (impactMetrics.casesResolved.total / 4) * 100}%`}}>
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                            Q1: {impactMetrics.casesResolved.quarterly.q1}
                                          </div>
                                        </div>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-8 relative overflow-hidden">
                                          <div className="absolute inset-0 bg-green-400 dark:bg-green-600 opacity-80" 
                                              style={{width: `${impactMetrics.casesResolved.quarterly.q2 / (impactMetrics.casesResolved.total / 4) * 100}%`}}>
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                            Q2: {impactMetrics.casesResolved.quarterly.q2}
                                          </div>
                                        </div>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-8 relative overflow-hidden">
                                          <div className="absolute inset-0 bg-purple-400 dark:bg-purple-600 opacity-80" 
                                              style={{width: `${impactMetrics.casesResolved.quarterly.q3 / (impactMetrics.casesResolved.total / 4) * 100}%`}}>
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                            Q3: {impactMetrics.casesResolved.quarterly.q3}
                                          </div>
                                        </div>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-8 rounded-r-md relative overflow-hidden">
                                          <div className="absolute inset-0 bg-amber-400 dark:bg-amber-600 opacity-80" 
                                              style={{width: `${impactMetrics.casesResolved.quarterly.q4 / (impactMetrics.casesResolved.total / 4) * 100}%`}}>
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                            Q4: {impactMetrics.casesResolved.quarterly.q4}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </dd>
                            </div>
                            
                                  
                                  
                                  
                        
                            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Legal Stats</dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                <div className="space-y-3">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full overflow-hidden mr-3 bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                      <Home className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">Eviction Crisis</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {impactMetrics?.externalAnalysis?.evictionCrisis?.description || externalData?.evictionData?.description || "No data available"}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full overflow-hidden mr-3 bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                      <MapPin className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">Immigration Cases</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {impactMetrics?.externalAnalysis?.immigrationBacklog?.description || externalData?.immigrationData?.description || "No data available"}
                                      </div>
                                    </div>
                                  </div>
                                  
                                </div>
                              </dd>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Community Engagement</dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Forum Posts</div>
                                    <div className="font-medium">{impactMetrics?.communityMetrics?.forumPosts || externalData?.communityMetrics?.forumPosts || "0"}</div>
                                  </div>
                                  
                                </div>
                                
                                {impactMetrics?.communityMetrics?.growthLastMonth && (
                                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-right">
                                    Community growth: <span className="font-medium text-green-600 dark:text-green-400">+{impactMetrics.communityMetrics.growthLastMonth}%</span> last month
                                  </div>
                                )}
                              </dd>
                            </div>
                            
                            {/* New section: Economic Impact */}
                            {impactMetrics?.impactAssessment && (
                              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Economic Impact</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                  <div className="space-y-3">
                                    <div className="flex items-center">
                                      <div className="h-10 w-10 rounded-full overflow-hidden mr-3 bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                        <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium">Monetary Benefit to Clients</div>
                                        <div className="flex flex-col xs:flex-row xs:justify-between">
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Total monetary benefit: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatDollars(impactMetrics.impactAssessment.monetaryBenefit.total)}</span>
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Average per case: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatDollars(impactMetrics.impactAssessment.monetaryBenefit.average)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                  </div>
                                </dd>
                              </div>
                            )}
                            
                            {/* Upcoming Initiatives section */}
                            {externalData?.upcomingInitiatives && (
                              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming Initiatives</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                  <div className="space-y-3">
                                    {externalData.upcomingInitiatives.map((initiative, index) => (
                                      <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between">
                                          <h4 className="font-medium text-indigo-600 dark:text-indigo-400">{initiative.title}</h4>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Starting: {new Date(initiative.startDate).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="mt-2 flex justify-between text-sm">
                                          <span>Target Beneficiaries: <span className="font-medium">{initiative.targetBeneficiaries.toLocaleString()}</span></span>
                                          <span>Funding: <span className="font-medium">${initiative.fundingRequired.toLocaleString()}</span></span>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    <div className="flex justify-center mt-3">
                                      <button 
                                        onClick={() => navigateToAppSection('proposals')}
                                        className="px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
                                      >
                                        View All Upcoming Initiatives
                                      </button>
                                    </div>
                                  </div>
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Token Tab */}
            {activeTab === 'token' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">JST Token: <span className="text-indigo-600 dark:text-indigo-300">Democratizing Legal Access</span></h2>
                  <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                    The <strong>JustToken (JST)</strong> is more than a governance token—it's a <em className="text-gray-700 dark:text-gray-300">catalyst for systemic legal empowerment</em>. By participating in the JustDAO ecosystem, token holders directly contribute to breaking down barriers in legal aid, enabling community-driven justice through transparent and accountable mechanisms.
                  </p>
                </div>
                
                {/* Mint JST section */}
                <div className="bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-900 dark:to-purple-900 rounded-lg shadow-lg overflow-hidden">
                  <div className="px-6 py-8 text-gray-100 dark:text-gray-200">
                    <div className="flex items-center space-x-3">
                      <CoinsIcon className="h-10 w-10 text-yellow-300" />
                      <h3 className="text-2xl font-bold"><em>Democratize Justice, One Token at a Time</em></h3>
                    </div>
                    <div className="mt-4 space-y-4">
                      <p className="text-lg">
                        <strong>Instant Impact:</strong> Send ETH directly to our token contract and instantly mint JST tokens. Each contribution becomes a <em>powerful vehicle for legal aid</em>, supporting individuals who lack traditional access to justice.
                      </p>
                      <div className="pt-4 border-t border-white/30">
                        <h4 className="font-semibold mb-2 flex items-center">
                          <svg className="h-5 w-5 mr-2 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Transparent Minting Process:
                        </h4>
                        <ul className="ml-6 list-disc space-y-1 text-indigo-100">
                          <li><strong>Direct Contribution:</strong> Send ETH to our dedicated token contract</li>
                          <li><strong>Instant Conversion:</strong> Receive JST tokens at a transparent 1:1 ratio</li>
                          <li><strong>Zero Overhead:</strong> No gas-intensive processes, just pure impact</li>
                          <li><strong>Immediate Support:</strong> Your contribution directly funds <em>critical legal aid initiatives</em></li>
                        </ul>
                      </div>
                      <div className="pt-2">
                        <div className="font-mono text-sm bg-indigo-900/50 p-2 rounded-md flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="mr-2">Contract:</span>
                            <span className="text-yellow-200 mr-2">0x051B5e728BD7d77707DE7e7Eb41D32fCd7Eb3df1</span>
                            <button className="bg-indigo-800 p-1 rounded hover:bg-indigo-700">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-indigo-800 dark:bg-indigo-900 px-6 py-4">
                    <div className="flex justify-between items-center text-white">
                      <span className="text-sm px-2 py-1 bg-indigo-600 rounded-full">1 ETH = 1 JST</span>
                    </div>
                  </div>
                </div>
                
                {/* Existing token supply and delegation sections remain unchanged */}
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Token <strong className="text-indigo-600 dark:text-indigo-400">Ecosystem Utilities</strong></h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        <span className="text-gray-800 dark:text-gray-200 font-bold"><b>Collective Governance</b></span>
                      </h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Participate in <strong className="text-indigo-600 dark:text-indigo-400">proposal voting</strong> to directly influence fund allocation and DAO operations, embodying true decentralized decision-making.
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        <span className="text-gray-800 dark:text-gray-200"><b>Proposal Creation</b></span>
                      </h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        <em className="text-gray-700 dark:text-gray-300">Engage with systemic change</em> by creating proposals to fund legal aid initiatives with a stake of <strong className="text-indigo-600 dark:text-indigo-400">0.25 JST</strong>.
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        <span className="text-gray-800 dark:text-gray-200 font-bold"><b>Community Representation</b></span>
                      </h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Delegate your <strong className="text-indigo-600 dark:text-indigo-400">voting power</strong> to active community representatives who can advocate on your behalf.
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        <span className="text-gray-800 dark:text-gray-200 font-bold"><b>Direct Impact</b></span>
                      </h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Beyond funding—<strong className="text-indigo-600 dark:text-indigo-400">empowering individuals</strong> and communities through a transparent, accountable legal aid ecosystem.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Governance Tab */}
{activeTab === 'governance' && (
  <div className="space-y-8">
    <div>
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Governance</h2>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
        JustDAO operates through decentralized governance where token holders collectively make decisions on funding allocations, legal aid provider selection, and protocol upgrades.
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Governance Parameters</h3>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
              <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Voting Duration</dt>
              <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.votingDuration} days</dd>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
              <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Quorum</dt>
              <dd className="mt-1 text-xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.quorum} JST</dd>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
              <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Proposal Threshold</dt>
              <dd className="mt-1 text-xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.proposalCreationThreshold} JST</dd>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
              <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Proposal Stake</dt>
              <dd className="mt-1 text-xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.proposalStake} JST</dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Refund Mechanics</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            When submitting a proposal, creators stake JST tokens that may be refunded based on proposal outcome.
          </p>
          <dl className="mt-5 grid grid-cols-1 gap-5">
            <div className="bg-green-50 dark:bg-green-900/30 overflow-hidden rounded-md px-4 py-4">
              <dt className="text-sm font-medium text-green-800 dark:text-green-300">Successful Proposals</dt>
              <dd className="mt-1 text-sm text-green-700 dark:text-green-400">100% of stake returned when the proposal executes successfully</dd>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 overflow-hidden rounded-md px-4 py-4">
              <dt className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Cancelled Proposals</dt>
              <dd className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">{governanceData.canceledRefundPercentage}% of stake returned for proposals cancelled by creator</dd>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 overflow-hidden rounded-md px-4 py-4">
              <dt className="text-sm font-medium text-red-800 dark:text-red-300">Defeated Proposals</dt>
              <dd className="mt-1 text-sm text-red-700 dark:text-red-400">{governanceData.defeatedRefundPercentage}% of stake returned for proposals that fail to pass</dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 overflow-hidden rounded-md px-4 py-4">
              <dt className="text-sm font-medium text-gray-800 dark:text-gray-300">Expired Proposals</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-400">{governanceData.expiredRefundPercentage}% of stake returned for proposals not executed during grace period</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
    
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Proposal Examples</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Types of governance actions that can be proposed and voted on</p>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700">
        <dl>
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Funding Allocations</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              Proposals to allocate funds to qualified legal aid providers for specific initiatives or general operations
            </dd>
          </div>
          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider Registration</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              Proposals to add or remove approved legal aid providers who can receive funding allocations
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Parameter Changes</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              Updates to governance settings like voting duration, quorum, and proposal thresholds
            </dd>
          </div>
          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">System Upgrades</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              Contract upgrades and implementation changes to improve functionality or fix issues
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Impact Measurement</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              Adjustment of metrics and reporting requirements for funded legal aid initiatives
            </dd>
          </div>
        </dl>
      </div>
    </div>
    
    {pendingProposals.length > 0 && (
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Pending Transactions</h3>
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {pendingProposals.map((tx, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatAddress(tx.target)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{tx.value} ETH</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{tx.eta}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.ready ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                      {tx.ready ? 'Ready to Execute' : 'Waiting Timelock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Voting Power Execution</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">How voting power is calculated and utilized in the governance process</p>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700">
        <dl>
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Snapshot Mechanism</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              <p>Voting power is calculated based on token holdings at a specific block number when the proposal is created - snapshot ID: {tokenData.currentSnapshotId}</p>
            </dd>
          </div>
          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Delegation</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              <p>Token holders can delegate voting power to representatives or self-delegate for direct participation</p>
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Vote Counting</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              <p>Simple majority with quorum requirement of {governanceData.quorum} JST to ensure sufficient participation</p>
            </dd>
          </div>
          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Vote Options</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
              <div className="space-y-2">
                <p><span className="font-medium text-green-600 dark:text-green-400">FOR</span> - Support the proposal</p>
                <p><span className="font-medium text-red-600 dark:text-red-400">AGAINST</span> - Oppose the proposal</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">ABSTAIN</span> - Count toward quorum without supporting or opposing</p>
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
    
    {/* New Legal Aid Governance Boundaries Section */}
    <div className="bg-transparent border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6 my-6 shadow-sm">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-yellow-500 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-400 mb-3">
            Legal Aid Governance Boundaries
          </h3>
          <div className="space-y-2 text-gray-700 dark:text-gray-300">
            <p>
              The intersection of blockchain governance and legal aid presents unique challenges that require specific governance constraints:
            </p>
            <ul className="space-y-2 mt-3">
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>Voting on funding allocations does <strong>not create fiduciary relationships</strong> between token holders and legal aid recipients.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>Governance participants must respect <strong>attorney independence</strong> and cannot attempt to influence case strategies or decisions.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>The DAO structure <strong>intentionally prevents</strong> token holders from directing specific case activities or selecting individual clients.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>All legal services data shared with governance participants is <strong>anonymized and aggregated</strong> to protect client confidentiality.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>Token holders from jurisdictions with <strong>restrictions on legal service funding</strong> must ensure compliance with their local regulations.</span>
              </li>
             
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>The selection of legal aid providers follows strict <strong>non-discrimination principles</strong> and cannot be influenced by political motivations.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 dark:text-yellow-400 mr-2">•</span>
                <span>Governance decisions <strong>cannot override ethical obligations</strong> of attorneys or require actions contrary to professional responsibility rules.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
  </div>
)}

   
            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Security Framework</h2>
                  <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                    JustDAO implements a robust security framework to protect community funds and ensure secure governance. The system uses a tiered security model based on transaction risk levels.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Timelock Delays</h3>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Different waiting periods are enforced based on the risk level of each transaction
                      </p>
                      <div className="mt-5 space-y-4">
                        <div className={`overflow-hidden rounded-md px-4 py-3 ${getThreatLevelColor('LOW')}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">LOW Risk</span>
                            <span className="font-bold">{timelockData.lowThreatDelay} days</span>
                          </div>
                          <p className="text-xs mt-1">Basic operations like a community vote</p>
                        </div>
                        <div className={`overflow-hidden rounded-md px-4 py-3 ${getThreatLevelColor('MEDIUM')}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">MEDIUM Risk</span>
                            <span className="font-bold">{timelockData.mediumThreatDelay} days</span>
                          </div>
                          <p className="text-xs mt-1">Parameter changes and configuration updates</p>
                        </div>
                        <div className={`overflow-hidden rounded-md px-4 py-3 ${getThreatLevelColor('HIGH')}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">HIGH Risk</span>
                            <span className="font-bold">{timelockData.highThreatDelay} days</span>
                          </div>
                          <p className="text-xs mt-1">Role changes and significant system modifications</p>
                        </div>
                        <div className={`overflow-hidden rounded-md px-4 py-3 ${getThreatLevelColor('CRITICAL')}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">CRITICAL Risk</span>
                            <span className="font-bold">{timelockData.criticalThreatDelay} days</span>
                          </div>
                          <p className="text-xs mt-1">Core system changes and contract upgrades</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Security Features</h3>
                      <div className="mt-5 space-y-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-4">
                          <h4 className="font-medium text-indigo-700 dark:text-indigo-300">Role-Based Access Control</h4>
                          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">Strict permission management with role hierarchies for admin, guardian, governance and other specialized roles.</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-4">
                          <h4 className="font-medium text-indigo-700 dark:text-indigo-300">Upgradeable Contracts</h4>
                          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">All contracts use the Universal Upgradeable Proxy Standard (UUPS) pattern to allow improvements while preserving state.</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-4">
                          <h4 className="font-medium text-indigo-700 dark:text-indigo-300">Whitelisted Functions</h4>
                          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">Only approved function selectors and target addresses can be called via governance proposals.</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-4">
                          <h4 className="font-medium text-indigo-700 dark:text-indigo-300">Emergency Controls</h4>
                          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">Guardian role can pause contracts and cancel transactions in emergency situations.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Threat Level Definitions</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Different operations are categorized by risk impact</p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <dl>
                      {Object.entries(threatLevelInfo).map(([level, description], index) => (
                        <div key={level} className={index % 2 === 0 ? "bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6" : "bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"}>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{level}</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{description}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Additional Protections</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Delegation Depth Limits</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Maximum delegation depth of 8 to prevent excessive chains and potential security issues.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Delegation Cycle Prevention</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Advanced algorithms to detect and prevent delegation cycles and diamond patterns.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Grace Period</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Configurable grace period of {timelockData.gracePeriod} days for executing transactions after the delay expires.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Last Admin Protection</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Prevention of removing the last admin role to avoid contract locking.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* How It Works Tab */}
            {activeTab === 'how-it-works' && (
              
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How JustDAO Works</h2>
                  <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                    JustDAO provides a complete governance framework for decentralized legal aid funding. Here's how you can participate and how the system operates.
                  </p>
                  <div className="mt-4">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('Learn More Governance button clicked');
                        
                        // Try primary navigation method
                        if (typeof onNavigateToMain === 'function') {
                          console.log('Using onNavigateToMain to navigate to GovInfo');
                          onNavigateToMain('govinfo');
                        }
                        
                        // Add a timeout to check if primary navigation worked, then try fallbacks
                        setTimeout(() => {
                          // Look for direct tab selector
                          const govInfoTab = document.querySelector('[data-tab="govinfo"]');
                          if (govInfoTab) {
                            console.log('Using direct tab click for govinfo');
                            govInfoTab.click();
                          } else {
                            // Try other potential tab identifiers
                            const possibleTabSelectors = [
                              '[data-tab="governance-info"]',
                              '[data-tab="gov-info"]',
                              '[data-tab="governance"]',
                              'button[aria-controls="govinfo"]',
                              'a[href="#govinfo"]'
                            ];
                            
                            for (const selector of possibleTabSelectors) {
                              const tabElement = document.querySelector(selector);
                              if (tabElement) {
                                console.log(`Found tab with selector: ${selector}`);
                                tabElement.click();
                                return;
                              }
                            }
                            
                            // Last resort: try to find button or link with govinfo in text
                            const allButtons = document.querySelectorAll('button');
                            for (const button of allButtons) {
                              if (button.textContent.toLowerCase().includes('governance') || 
                                  button.textContent.toLowerCase().includes('gov info')) {
                                console.log('Found button with governance text');
                                button.click();
                                return;
                              }
                            }
                            
                            console.error('Could not find govinfo tab via any method');
                          }
                        }, 100);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Learn More About Governance
                    </button>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-gray-50 dark:bg-gray-900 text-lg font-medium text-gray-900 dark:text-white">
                      Governance Workflow
                    </span>
                  </div>
                </div>
                
                <div className="flow-root">
                  <ul className="-mb-8">
                    <li>
                      <div className="relative pb-8">
                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div className="relative px-1">
                              <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-900">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="text-lg font-medium text-gray-900 dark:text-white">1. Proposal Creation</div>
                            </div>
                            <div className="mt-2 text-gray-700 dark:text-gray-300">
                              <p>Token holders with at least {governanceData.proposalCreationThreshold} JST can create proposals. The creator stakes {governanceData.proposalStake} JST when submitting.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    <li>
                      <div className="relative pb-8">
                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div className="relative px-1">
                              <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-900">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="text-lg font-medium text-gray-900 dark:text-white">2. Voting Period</div>
                            </div>
                            <div className="mt-2 text-gray-700 dark:text-gray-300">
                              <p>Token holders vote FOR, AGAINST, or ABSTAIN during the {governanceData.votingDuration}-day voting period. A proposal succeeds if it receives more FOR than AGAINST votes and meets the quorum requirement of {governanceData.quorum} JST.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    <li>
                      <div className="relative pb-8">
                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div className="relative px-1">
                              <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-900">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="text-lg font-medium text-gray-900 dark:text-white">3. Queuing</div>
                            </div>
                            <div className="mt-2 text-gray-700 dark:text-gray-300">
                              <p>Successful proposals are queued in the timelock contract with a delay period based on the transaction's threat level (from {timelockData.lowThreatDelay} to {timelockData.criticalThreatDelay} days).</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    <li>
                      <div className="relative pb-8">
                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div className="relative px-1">
                              <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-900">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="text-lg font-medium text-gray-900 dark:text-white">4. Execution</div>
                            </div>
                            <div className="mt-2 text-gray-700 dark:text-gray-300">
                              <p>After the timelock delay, any token holder can execute the proposal. The proposer's stake is fully refunded upon successful execution.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    <li>
                      <div className="relative">
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div className="relative px-1">
                              <div className="h-10 w-10 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-900">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="text-lg font-medium text-gray-900 dark:text-white">5. Implementation</div>
                            </div>
                            <div className="mt-2 text-gray-700 dark:text-gray-300">
                              <p>Funds are allocated to legal aid initiatives according to the executed proposal. This might include direct ETH transfers, token distributions, or contract interactions.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-gray-50 dark:bg-gray-900 text-lg font-medium text-gray-900 dark:text-white">
                      Delegation System
                    </span>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Delegation Mechanics</h3>
                    <div className="mt-4 text-gray-600 dark:text-gray-300">
                      <p className="mb-4">
                        JustDAO features an advanced delegation system that allows token holders to delegate their voting power to active community representatives.
                      </p>
                      
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Token Locking</h4>
                          <p className="text-sm">When tokens are delegated, they are locked to prevent double-voting while maintaining ownership.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Secure Expertise</h4>
                          <p className="text-sm">Delegating your vote to expert community representatives ensures more informed, timely, and impactful decision-making.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Voting Power Snapshots</h4>
                          <p className="text-sm">Point-in-time snapshots of token balances and delegations for secure governance voting.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Self-Delegation Reset</h4>
                          <p className="text-sm">Token holders can reset delegation to themselves at any time to unlock tokens.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Cycle Prevention</h4>
                          <p className="text-sm">Sophisticated algorithms detect and prevent delegation cycles and diamond patterns.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Delegation Analytics</h4>
                          <p className="text-sm">Comprehensive metrics tracking delegation patterns, power concentration, and active participants.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Getting Started</h3>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div>
                      <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">For Token Holders</h4>
                      <ul className="mt-4 space-y-3 text-gray-700 dark:text-gray-300">
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Connect your wallet and acquire JST tokens</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Vote on active proposals to influence funding decisions</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Delegate your voting power if you can't actively participate</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Create proposals for legal aid initiatives (requires {governanceData.proposalCreationThreshold} JST)</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">For Legal Aid Organizations</h4>
                      <ul className="mt-4 space-y-3 text-gray-700 dark:text-gray-300">
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Register your organization through a community proposal</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Submit funding requests detailing the legal aid initiatives</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Provide regular impact reports on funded initiatives</span>
                        </li>
                        <li className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="ml-3">Engage with the community through updates and Q&A sessions</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex items-center">
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">JustDAO</div>
              <p className="ml-3 text-gray-500 dark:text-gray-400">Decentralized Legal Aid Governance</p>
            </div>
            <div className="mt-8 md:mt-0 md:flex md:space-x-6">
              <a href="#mission" onClick={() => setActiveTab('mission')} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                Mission
              </a>
              <a href="#how-it-works" onClick={() => setActiveTab('how-it-works')} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                How It Works
              </a>
              <a href="#token" onClick={() => setActiveTab('token')} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                Token
              </a>
              <a href="#governance" onClick={() => setActiveTab('governance')} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                Governance
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8 flex items-center justify-between">
            <p className="text-base text-gray-400">
            </p>
            {isConnected ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Enter App button clicked');
                  navigateToAppSection('dashboard');
                  // Direct fallback if the function doesn't work
                  const dashboardTab = document.querySelector('[data-tab="dashboard"]');
                  if (dashboardTab) {
                    setTimeout(() => {
                      if (!document.querySelector('.dashboard-content')) {
                        console.log('Direct fallback click for dashboard');
                        dashboardTab.click();
                      }
                    }, 100);
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Enter App
              </button>
            ) : (
              <button
                onClick={connectWallet}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Add a bit of CSS for the pulse animation */}
      <style jsx>{`
        .pulse-animation {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default JustDAOLandingPage;