import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { formatTokenAmount } from '../utils/tokenFormatters';
import { ethers } from 'ethers';

// Custom components and hooks
const JustDAOLandingPage = ({ onNavigateToMain }) => {
  
  // Function to navigate to specific app section
  const navigateToAppSection = (section) => {
    console.log(`Navigating to section: ${section}`);
    if (typeof onNavigateToMain === 'function') {
      onNavigateToMain(section);
    } else {
      console.error("Navigation function is not available");
      // Fallback navigation using tab data attributes
      const tabElement = document.querySelector(`[data-tab="${section}"]`);
      if (tabElement) {
        console.log(`Using fallback navigation to ${section}`);
        tabElement.click();
      } else {
        console.error(`Could not find tab element for ${section}`);
      }
    }
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

  // Get web3 context for blockchain connection
  const { account, isConnected, connectWallet, disconnectWallet, contracts } = useWeb3();
  const { userData, daoStats, refreshData } = useBlockchainData();

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
          expiredRefundPercentage: govParams.expiredRefundPercentage.toString()
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

    if (isConnected) {
      fetchOnChainData();
    } else {
      setIsLoading(false);
    }
  }, [contracts, isConnected]);

  // Format addresses for display
  const formatAddress = (address) => {
    if (!address) return '-';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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

  // Disclaimer modal component
  const LegalDisclaimerModal = () => (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl mx-4 p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Important Legal Disclaimer</h3>
          <button 
            onClick={() => setShowDisclaimerModal(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 16L16 5M5 4l8 8" />
            </svg>
          </button>
        </div>
        <div className="text-gray-700 dark:text-gray-300 space-y-4">
          <p className="font-bold">JustDAO is not a law firm and does not provide legal services directly.</p>
          
          <p>JustDAO is a decentralized autonomous organization that facilitates funding for legal aid initiatives through community governance. Participation in JustDAO involves several important risks and considerations:</p>
          
          <ol className="list-decimal pl-5 space-y-2">
            <li>JustDAO does not establish attorney-client relationships with token holders or governance participants.</li>
            <li>Legal services are provided exclusively by the selected legal aid providers, not by JustDAO.</li>
            <li>Participation in governance does not constitute practicing law and governance decisions must respect all applicable legal regulations.</li>
            <li>Token holders should be aware that governance decisions may have real-world policy and legal implications.</li>
            <li>The DAOs governance model is designed to maintain separation between governance actions and legal service providers along with the clients they serve.</li>
            <li>JustDAO makes no guarantees regarding the quality, effectiveness, or outcomes of services provided by selected legal aid providers.</li>
            <li>Legal and regulatory frameworks concerning DAOs, cryptocurrencies, and legal service funding may change, potentially affecting JustDAO operations.</li>
            <li>Smart contract vulnerabilities, technical failures, or security breaches may impact DAO funds or operations.</li>
          </ol>
          
          <p className="font-medium">By participating in JustDAO, you acknowledge these risks and limitations. If you need legal advice, please consult with a licensed attorney directly.</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowDisclaimerModal(false)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Show disclaimer modal if active */}
      {showDisclaimerModal && <LegalDisclaimerModal />}
      
      {/* Hero Section */}
      <div className="relative bg-indigo-700 dark:bg-indigo-900">
        <div className="absolute inset-0 overflow-hidden">
          <svg className="absolute left-0 transform translate-y-32 opacity-20" width="800" height="500" fill="none" viewBox="0 0 800 500">
            <path d="M400 0l400 200v400H0V200L400 0z" fill="#fff" />
          </svg>
          <svg className="absolute right-0 top-0 transform translate-x-32 opacity-20" width="800" height="500" fill="none" viewBox="0 0 800 500">
            <circle cx="400" cy="250" r="200" fill="#fff" />
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            JustDAO
          </h1>
          <p className="mt-6 text-xl text-white font-medium max-w-3xl">
            A decentralized governance system designed to provide transparent, secure, and efficient funding for legal aid organizations.
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
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-500 bg-opacity-70 hover:bg-opacity-100"
            >
              Learn More
            </a>
            <button
              onClick={() => setShowDisclaimerModal(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-orange-600 bg-opacity-60 hover:bg-opacity-80"
            >
              Legal Disclaimer
            </button>
          </div>
        </div>
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
                    JustDAO was created to transform how legal aid is funded and distributed in our society. Through community governance, token holders can participate in selecting which legal aid initiatives receive funding and which service providers are approved to meet community needs.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-100 dark:bg-indigo-900 rounded-full p-3">
                          <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <div className="flex-shrink-0 bg-indigo-100 dark:bg-indigo-900 rounded-full p-3">
                          <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Community Governance</h3>
                        </div>
                      </div>
                      <div className="mt-4 text-gray-600 dark:text-gray-300">
                        <p>Funding allocation decisions are made transparently through community voting, creating a collaborative approach to legal aid funding.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-100 dark:bg-indigo-900 rounded-full p-3">
                          <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transparency & Security</h3>
                        </div>
                      </div>
                      <div className="mt-4 text-gray-600 dark:text-gray-300">
                        <p>All funding decisions and transactions are recorded on the blockchain, providing transparency and security in how funds are allocated.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Key Impact Areas</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Housing Rights</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Providing legal assistance for tenants facing eviction, housing discrimination, and unsafe living conditions.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Family Law</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Supporting families in custody disputes, domestic violence cases, and child support arrangements.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Immigration</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Assisting with asylum applications, deportation defense, and visa processing for vulnerable populations.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Consumer Protection</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Helping individuals with debt collection defense, predatory lending cases, and bankruptcy proceedings.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Current Status</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Key metrics for JustDAO operations</p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <dl>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Funds Distributed</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                          {isConnected ? `${daoStats?.totalFundsDistributed || "0"} ETH` : "Connect wallet to view"}
                        </dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Legal Aid Initiatives</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                          {isConnected ? daoStats?.activeInitiatives || "0" : "Connect wallet to view"}
                        </dd>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Community Members</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                          {isConnected ? tokenData?.activeHolders || "0" : "Connect wallet to view"}
                        </dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Participation Rate</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                          {isConnected ? `${tokenData?.percentageDelegated || "0"}%` : "Connect wallet to view"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {/* Token Tab */}
            {activeTab === 'token' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">JST Token</h2>
                  <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                    The JustToken (JST) serves as both a governance token and a unit of account within the JustDAO ecosystem. Token holders can participate in governance by voting directly or delegating their voting power to community representatives.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Token Supply</h3>
                      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Max Supply</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{tokenData.maxSupply}</dd>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Current Supply</dt>
                          <dd className="mt-1 text-xl font-semibold text-indigo-900 dark:text-indigo-100 overflow-hidden text-ellipsis">{tokenData.totalSupply}</dd>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300">
                                Supply Usage
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold inline-block text-indigo-600 dark:text-indigo-300">
                                {((parseFloat(tokenData.totalSupply) / parseFloat(tokenData.maxSupply)) * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200 dark:bg-indigo-900">
                            <div style={{ width: `${((parseFloat(tokenData.totalSupply) / parseFloat(tokenData.maxSupply)) * 100).toFixed(2)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delegation Statistics</h3>
                      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Active Holders</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{tokenData.activeHolders}</dd>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900 overflow-hidden rounded-md px-4 py-5">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Active Delegates</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{tokenData.activeDelegates}</dd>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Delegation Rate</h4>
                        <div className="mt-2 relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300">
                                {tokenData.percentageDelegated}% Delegated
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold inline-block text-indigo-600 dark:text-indigo-300">
                                {tokenData.totalDelegated} JST
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200 dark:bg-indigo-900">
                            <div style={{ width: `${tokenData.percentageDelegated}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {topDelegates.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Top Delegates</h3>
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Delegate</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Voting Power</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {topDelegates.map((delegate, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatAddress(delegate.address)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{delegate.power} JST</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{delegate.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Token Utilities</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Governance Voting</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Participate in proposal voting to influence how funds are allocated and how the DAO operates.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Proposal Creation</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Create proposals to fund legal aid initiatives with a stake of {governanceData.proposalStake} JST.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Delegation</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Delegate your voting power to active community representatives who can vote on your behalf.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">Helping Others</h4>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Empowering individuals and communities through meaningful support is what JST was built for.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Governance Tab */}
            {activeTab === 'governance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Governance Framework</h2>
                  <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                    JustDAO uses a comprehensive governance system that allows token holders to create proposals, vote on initiatives, and execute approved changes through a secure timelock mechanism.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Core Parameters</h3>
                      <dl className="mt-5 grid grid-cols-1 gap-5">
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Voting Duration</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.votingDuration} days</dd>
                        </div>
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Quorum Requirement</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.quorum} JST</dd>
                        </div>
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Proposal Threshold</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.proposalCreationThreshold} JST</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Proposal Economics</h3>
                      <dl className="mt-5 grid grid-cols-1 gap-5">
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Proposal Stake</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.proposalStake} JST</dd>
                        </div>
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Defeated Refund</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.defeatedRefundPercentage}%</dd>
                        </div>
                        <div className="overflow-hidden rounded-md px-4 py-5 bg-indigo-50 dark:bg-indigo-900">
                          <dt className="text-sm font-medium text-indigo-500 dark:text-indigo-300 truncate">Canceled Refund</dt>
                          <dd className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{governanceData.canceledRefundPercentage}%</dd>
                        </div>
                      </dl>
                    </div>
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Executable After</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {pendingProposals.map((proposal, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatAddress(proposal.target)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{proposal.eta}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${proposal.ready ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                  {proposal.ready ? 'Ready for Execution' : 'Waiting for Delay'}
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
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Proposal Types</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">JustDAO supports multiple proposal types for different governance actions</p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <dl>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Contract Interaction</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Execute arbitrary function calls to whitelisted contracts</dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ETH Withdrawal</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Transfer ETH from the DAO to a specified recipient</dd>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Treasury Transfer</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Transfer governance tokens from the DAO</dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Governance Parameter Update</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Update governance parameters like voting duration or quorum</dd>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">External Token Transfer</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Transfer other ERC20 tokens held by the DAO</dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Issuance</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Create new governance tokens for distribution</dd>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Consolidation</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Destroy existing governance tokens</dd>
                      </div>
                      <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Binding Community Vote</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">Binding votes on specific topics with full execution protocol</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                
                {/* ADDED: Governance Overview Section */}
                <div className="container mx-auto px-0 py-6 max-w-full">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold dark:text-white">Governance Overview</h2>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                      Learn about how JustDAO's governance system works to fund legal aid initiatives while maintaining regulatory compliance.
                    </p>
                  </div>
                  
                  {/* Elect Model Explanation */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
                    <div className="p-5">
                      <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Governance: The Selection Process</h2>
                      <p className="text-gray-600 mb-5 dark:text-gray-300">
                        JustDAO's governance process empowers our community to select qualified legal aid providers 
                        for both organizational funding and individual client representation, while maintaining proper regulatory separation.
                      </p>
                      
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/2">
                          <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
                            <h3 className="font-semibold text-lg mb-3 dark:text-white">The Two-Layer Approach</h3>
                            <div className="space-y-5">
                              <div className="bg-white p-4 rounded shadow-sm dark:bg-gray-700">
                                <div className="flex items-center mb-2">
                                  <div className="bg-indigo-100 rounded-full p-2 mr-3 dark:bg-indigo-800">
                                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                  </div>
                                  <h4 className="font-medium dark:text-white">Governance Layer (DAO members)</h4>
                                </div>
                                <p className="text-gray-600 text-sm pl-9 dark:text-gray-300">
                                  Makes high-level funding decisions and selects trusted entities through proposals and voting
                                </p>
                              </div>
                              
                              <div className="flex justify-center">
                                <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                              </div>
                              
                              <div className="bg-white p-4 rounded shadow-sm dark:bg-gray-700">
                                <div className="flex items-center mb-2">
                                  <div className="bg-indigo-100 rounded-full p-2 mr-3 dark:bg-indigo-800">
                                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <h4 className="font-medium dark:text-white">Implementation Layer (Elected providers)</h4>
                                </div>
                                <p className="text-gray-600 text-sm pl-9 dark:text-gray-300">
                                  Handles direct service provision including both organizational services and individual client representation
                                </p>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-500 italic dark:text-gray-400">
                              This separation prevents unauthorized practice of law while ensuring funds are directed by community priorities.
                            </p>
                          </div>
                        </div>
                        
                        <div className="md:w-1/2">
                          <h3 className="font-semibold text-lg mb-3 dark:text-white">How Provider Election Works:</h3>
                          <ol className="space-y-3">
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                1
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Qualification</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">Legal aid organizations apply with credentials and service proposals</p>
                              </div>
                            </li>
                            
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                2
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Due Diligence</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">DAO members evaluate applications against established criteria</p>
                              </div>
                            </li>
                            
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                3
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Formal Proposal</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">Qualified candidates are presented to the community</p>
                              </div>
                            </li>
                            
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                4
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Community Vote</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">Token holders decide which providers to fund</p>
                              </div>
                            </li>
                            
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                5
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Grant Allocation</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">Approved providers receive funding through smart contract execution</p>
                              </div>
                            </li>
                            
                            <li className="flex">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                                6
                              </div>
                              <div>
                                <h4 className="font-medium dark:text-white">Performance Tracking</h4>
                                <p className="text-gray-600 text-sm dark:text-gray-300">Elected providers submit regular impact reports on both organizational initiatives and individual cases</p>
                              </div>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Individual Client Representation Section */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
                    <div className="p-5">
                      <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Individual Client Representation</h2>
                      <p className="text-gray-600 mb-4 dark:text-gray-300">
                        JustDAO's elect model enables individual client representation while maintaining all legal and ethical boundaries.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
                          <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Governance Role</h3>
                          <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                            <li>Set eligibility criteria for individual representation</li>
                            <li>Approve funding allocations for client pools</li>
                            <li>Review anonymized outcome metrics</li>
                            <li>Establish ethical guidelines for representation</li>
                            <li>Vote on provider selection and renewal</li>
                          </ul>
                        </div>
                        
                        <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
                          <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Provider Role</h3>
                          <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                            <li>Identify and screen eligible clients</li>
                            <li>Establish direct attorney-client relationships</li>
                            <li>Manage case strategy and execution</li>
                            <li>Maintain strict client confidentiality</li>
                            <li>Report anonymized outcome data to DAO</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        <p className="italic">
                          This clear separation ensures proper attorney-client privilege while allowing community-driven funding to reach individuals in need.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Legal Compliance Alert */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border-l-4 border-yellow-400 dark:border-yellow-500 dark:shadow-gray-700/20">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Legal Compliance Notice</h3>
                        <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-200">
                          <p>
                            JustDAO's elect model ensures compliance with legal regulations by maintaining separation between
                            governance decisions and direct legal services. When participating in governance:
                          </p>
                          <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Focus on provider qualifications and performance metrics</li>
                            <li>Avoid directing specific case handling or legal strategy</li>
                            <li>Remember that only licensed attorneys can provide legal advice</li>
                            <li>Understand that participation in governance does not establish attorney-client relationships</li>
                            <li>Be aware that all governance actions must comply with applicable legal regulations</li>
                            <li>Respect that client confidentiality must be maintained by legal service providers</li>
                          </ul>
                          <p className="mt-2 font-medium">
                            JustDAO is not a law firm and does not provide legal services directly. All legal services are provided 
                            exclusively by the approved legal aid providers.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  
                  {/* Call to Action */}
                  <div className="bg-indigo-600 dark:bg-indigo-700 rounded-lg shadow overflow-hidden mb-6">
                    <div className="px-6 py-8 sm:p-10 sm:pb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        <div className="md:col-span-2">
                          <h3 className="text-xl font-semibold text-white">Ready to participate in governance?</h3>
                          <p className="mt-2 text-indigo-100">
                            Join JustDAO by donating to help fund legal aid initiatives and shape the future of legal access for underserved communities.
                          </p>
                        </div>
                        <div className="text-center md:text-right">
                          <button
                            onClick={() => navigateToAppSection('proposals')}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50"
                          >
                            Get Started
                          </button>
                        </div>
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
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Chain Depth Management</h4>
                          <p className="text-sm">Maximum delegation depth of 8 to prevent circular or excessively deep delegation chains.</p>
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
              <button 
                onClick={() => setShowDisclaimerModal(true)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                Legal Disclaimer
              </button>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8 flex items-center justify-between">
            <p className="text-base text-gray-400">
              &copy; {new Date().getFullYear()} JustDAO. All rights reserved.
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
    </div>
  );
};

export default JustDAOLandingPage;