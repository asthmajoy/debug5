/**
 * Enhanced BlockchainDataCache for Legal Aid DAO
 * Optimized for slow proposals and legal content with tiered expiration
 */
class BlockchainDataCache {
  constructor(options = {}) {
    // Default configuration with longer TTLs for legal applications
    this.config = {
      maxSize: options.maxSize || 200,
      defaultTtl: options.defaultTtl || 300000, // 5 minutes default
      cleanupInterval: options.cleanupInterval || 120000, // 2 minutes
      persistenceEnabled: options.persistenceEnabled || false,
      logLevel: options.logLevel || 'warn',
      priorityItems: options.priorityItems || ['proposal', 'legal', 'case']
    };
    
    // Cache storage with tiered structure
    this.cache = new Map();
    
    // Categorized TTLs for different types of data
    this.ttlTiers = {
      proposal: 3600000, // 1 hour for proposals
      legal: 7200000,    // 2 hours for legal documents
      contract: 1800000, // 30 mins for contract data
      vote: 300000,      // 5 mins for vote data
      user: 600000,      // 10 mins for user data
      default: this.config.defaultTtl
    };
    
    // Statistics for monitoring
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
      errors: 0,
      avgAccessTime: 0
    };
    
    // Memory usage tracking
    this.memoryUsage = {
      lastSample: 0,
      sampleCount: 0,
      peakSize: 0
    };
    
    // Initialize cache
    this._setupCleanupInterval();
    this._restoreFromPersistence();
    
    // Log cache initialization
    this._log('info', 'BlockchainDataCache initialized with capacity: ' + this.config.maxSize);
  }

  /**
   * Store a value in the cache with proper categorization and TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number|string} [ttlOrCategory] - TTL in seconds or category name
   * @param {Object} [options] - Additional options {priority, persist}
   */
  set(key, value, ttlOrCategory, options = {}) {
    try {
      // Track performance
      const startTime = performance.now();
      
      // Make sure there's space in the cache
      if (this.cache.size >= this.config.maxSize) {
        this._evictItems();
      }
      
      // Determine the appropriate TTL
      let ttl = this.config.defaultTtl;
      let category = 'default';
      
      if (typeof ttlOrCategory === 'number') {
        // If a number is provided, it's a custom TTL in seconds
        ttl = ttlOrCategory * 1000;
      } else if (typeof ttlOrCategory === 'string') {
        // If a string is provided, it's a category
        category = ttlOrCategory.toLowerCase();
        ttl = this.ttlTiers[category] || this.config.defaultTtl;
      } else {
        // Try to categorize based on the key
        for (const cat of Object.keys(this.ttlTiers)) {
          if (key.toLowerCase().includes(cat)) {
            category = cat;
            ttl = this.ttlTiers[cat];
            break;
          }
        }
      }
      
      // Determine item priority - higher for legal/proposal content
      const isPriority = options.priority || 
                        this.config.priorityItems.some(term => 
                          key.toLowerCase().includes(term));
      
      // Create the cache item
      const expires = Date.now() + ttl;
      const cacheItem = {
        value,
        expires,
        created: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        category,
        priority: isPriority ? 10 : 1,
        size: this._estimateSize(value)
      };
      
      // Store in cache
      this.cache.set(key, cacheItem);
      
      // Update stats
      this.stats.size = this.cache.size;
      this._trackMemoryUsage();
      
      // Save to localStorage if configured and the item should persist
      if ((this.config.persistenceEnabled || options.persist) && 
           typeof value !== 'function' && value !== undefined) {
        this._persistItem(key, cacheItem);
      }
      
      // Performance tracking
      const endTime = performance.now();
      this._log('debug', `Set ${key} (${category}): ${endTime - startTime}ms`);
      
      return true;
    } catch (error) {
      this.stats.errors++;
      this._log('error', `Error setting cache key '${key}': ${error.message}`);
      return false;
    }
  }

  /**
   * Get a value from the cache with advanced features
   * @param {string} key - Cache key
   * @param {Function} [fallbackFn] - Optional function to call if cache miss
   * @returns {any} Cached value or fallback result
   */
  get(key, fallbackFn = null) {
    try {
      const startTime = performance.now();
      const item = this.cache.get(key);
      
      // Cache miss
      if (!item) {
        this.stats.misses++;
        const result = fallbackFn ? this._executeFallback(key, fallbackFn) : null;
        
        const endTime = performance.now();
        this._log('debug', `Cache miss for ${key}: ${endTime - startTime}ms`);
        
        return result;
      }
      
      // Check expiration
      if (item.expires < Date.now()) {
        this.cache.delete(key);
        this.stats.size = this.cache.size;
        this.stats.misses++;
        
        const result = fallbackFn ? this._executeFallback(key, fallbackFn) : null;
        
        const endTime = performance.now();
        this._log('debug', `Cache expired for ${key}: ${endTime - startTime}ms`);
        
        return result;
      }
      
      // Cache hit - update access info
      item.lastAccessed = Date.now();
      item.accessCount++;
      this.stats.hits++;
      
      // For frequently accessed items, extend their TTL
      if (item.accessCount > 5) {
        const extension = Math.min(item.accessCount * 60000, 3600000); // Max 1 hour extension
        item.expires = Math.max(item.expires, Date.now() + extension);
      }
      
      const endTime = performance.now();
      this.stats.avgAccessTime = (this.stats.avgAccessTime * (this.stats.hits - 1) + (endTime - startTime)) / this.stats.hits;
      
      return item.value;
    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      this._log('error', `Error retrieving cache key '${key}': ${error.message}`);
      return fallbackFn ? this._executeFallback(key, fallbackFn) : null;
    }
  }

  /**
   * Get or compute a value with automatic caching
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute the value if not cached
   * @param {number|string} [ttlOrCategory] - TTL or category
   * @param {Object} [options] - Additional options
   * @returns {Promise<any>} The cached or computed value
   */
  async getOrCompute(key, computeFn, ttlOrCategory, options = {}) {
    const cachedValue = this.get(key);
    
    if (cachedValue !== null && cachedValue !== undefined) {
      return cachedValue;
    }
    
    try {
      // Start timer for performance tracking
      const startTime = performance.now();
      this._log('debug', `Computing value for ${key}`);
      
      // Compute the value
      const computedValue = await computeFn();
      
      // Store in cache if value is valid
      if (computedValue !== null && computedValue !== undefined) {
        this.set(key, computedValue, ttlOrCategory, options);
      }
      
      // Performance tracking
      const endTime = performance.now();
      this._log('debug', `Computed ${key}: ${endTime - startTime}ms`);
      
      return computedValue;
    } catch (error) {
      this.stats.errors++;
      this._log('error', `Error computing value for '${key}': ${error.message}`);
      
      // For legal DAO operations, we might want to retry on failure
      if (options.retry && (!options.retryCount || options.retryCount < 3)) {
        this._log('warn', `Retrying computation for ${key} (attempt ${(options.retryCount || 0) + 1})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retry with incremented counter
        return this.getOrCompute(key, computeFn, ttlOrCategory, {
          ...options,
          retryCount: (options.retryCount || 0) + 1
        });
      }
      
      throw error;
    }
  }

  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   * @returns {boolean} Success indicator
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.stats.size = this.cache.size;
      
      // Also remove from persistent storage if enabled
      if (this.config.persistenceEnabled && typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(`legal-dao-cache:${key}`);
        } catch (e) {
          // Silent fail for localStorage issues
        }
      }
    }
    
    return deleted;
  }

  /**
   * Check if a key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check expiration
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }
    
    return true;
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions = 0;
    
    // Clear persistent storage if enabled
    if (this.config.persistenceEnabled && typeof localStorage !== 'undefined') {
      try {
        // Only clear our cache items, not all localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('legal-dao-cache:')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        this._log('error', `Error clearing persistent cache: ${e.message}`);
      }
    }
    
    this._log('info', 'Cache cleared');
  }

  /**
   * Get detailed cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    // Calculate category distribution
    const categoryStats = {};
    for (const item of this.cache.values()) {
      categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
    }
    
    // Enhance stats with additional metrics
    const enhancedStats = {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0,
      categories: categoryStats,
      memoryUsage: this.memoryUsage,
      averageAge: this._calculateAverageAge()
    };
    
    return enhancedStats;
  }

  /**
   * Refresh an item's TTL in the cache
   * @param {string} key - Cache key
   * @param {number} [customTtl] - Custom TTL in milliseconds
   * @returns {boolean} Success status
   */
  refresh(key, customTtl) {
    const item = this.cache.get(key);
    
    if (item) {
      const ttl = customTtl || this.ttlTiers[item.category] || this.config.defaultTtl;
      item.expires = Date.now() + ttl;
      item.lastAccessed = Date.now();
      return true;
    }
    
    return false;
  }

  /**
   * Updates a cached value without changing its metadata
   * @param {string} key - Cache key
   * @param {Function} updateFn - Function that receives old value and returns new value
   * @returns {boolean} Success status
   */
  update(key, updateFn) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    try {
      // Update the value using the provided function
      item.value = updateFn(item.value);
      item.lastAccessed = Date.now();
      return true;
    } catch (error) {
      this.stats.errors++;
      this._log('error', `Error updating cache key '${key}': ${error.message}`);
      return false;
    }
  }

  /**
   * Cleanup and destroy the cache
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
    
    this.clear();
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._handleUnload);
    }
    
    this._log('info', 'Cache destroyed');
  }

  /**
   * Set up a cleanup interval to remove expired items
   * @private
   */
  _setupCleanupInterval() {
    // Clean old entries periodically
    this._cleanupInterval = setInterval(() => {
      this._cleanExpiredEntries();
    }, this.config.cleanupInterval);
    
    // Also set up unload handler to save state
    if (typeof window !== 'undefined') {
      this._handleUnload = () => this._saveState();
      window.addEventListener('beforeunload', this._handleUnload);
    }
  }

  /**
   * Clean expired entries from the cache
   * @private
   */
  _cleanExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // Skip high-priority items in legal contexts to prevent data loss
      // during critical operations
      if (item.priority > 5 && now - item.expires < 3600000) { // 1 hour grace period for important items
        continue;
      }
      
      if (item.expires < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this._log('debug', `Cleaned ${cleaned} expired cache entries`);
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Evict items based on priority, access time, and size
   * @private
   */
  _evictItems() {
    // Calculate how many items to evict - at least 10% of cache
    const entriesToEvict = Math.max(1, Math.floor(this.cache.size * 0.1));
    
    // Sort by priority (ascending), then by last access time (ascending)
    // This ensures we keep high-priority and recently accessed items
    const entries = [...this.cache.entries()]
      .sort((a, b) => {
        // First by priority (lower priority gets evicted first)
        if (a[1].priority !== b[1].priority) {
          return a[1].priority - b[1].priority;
        }
        
        // Then by last access time (older gets evicted first)
        return a[1].lastAccessed - b[1].lastAccessed;
      })
      .slice(0, entriesToEvict);
    
    // Evict the selected entries
    for (const [key] of entries) {
      this.cache.delete(key);
      this.stats.evictions++;
    }
    
    this._log('debug', `Evicted ${entries.length} cache entries`);
    this.stats.size = this.cache.size;
  }

  /**
   * Execute a fallback function safely
   * @private
   */
  async _executeFallback(key, fallbackFn) {
    try {
      const result = await fallbackFn();
      
      // If the function succeeded, cache the result
      if (result !== undefined && result !== null) {
        this.set(key, result);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      this._log('error', `Fallback function failed for key '${key}': ${error.message}`);
      return null;
    }
  }

  /**
   * Track memory usage of the cache
   * @private
   */
  _trackMemoryUsage() {
    this.memoryUsage.sampleCount++;
    this.memoryUsage.lastSample = this.cache.size;
    this.memoryUsage.peakSize = Math.max(this.memoryUsage.peakSize, this.cache.size);
    
    // Track estimated memory size if performance API is available
    if (typeof performance !== 'undefined' && performance.memory) {
      this.memoryUsage.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
      this.memoryUsage.totalJSHeapSize = performance.memory.totalJSHeapSize;
      this.memoryUsage.usedJSHeapSize = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Calculate the average age of cache items
   * @private
   */
  _calculateAverageAge() {
    if (this.cache.size === 0) return 0;
    
    const now = Date.now();
    let totalAge = 0;
    
    for (const item of this.cache.values()) {
      totalAge += (now - item.created);
    }
    
    return totalAge / this.cache.size;
  }

  /**
   * Persist a cache item to localStorage
   * @private
   */
  _persistItem(key, item) {
    if (typeof localStorage === 'undefined') return;
    
    try {
      // Don't persist functions, DOM nodes, or other non-serializable things
      if (typeof item.value === 'function' || 
          (typeof item.value === 'object' && item.value instanceof Node)) {
        return;
      }
      
      const serialized = JSON.stringify({
        value: item.value,
        expires: item.expires,
        category: item.category,
        priority: item.priority
      });
      
      localStorage.setItem(`legal-dao-cache:${key}`, serialized);
    } catch (e) {
      // Silent fail for localStorage issues (like quota exceeded)
    }
  }

  /**
   * Restore cache items from localStorage
   * @private
   */
  _restoreFromPersistence() {
    if (!this.config.persistenceEnabled || typeof localStorage === 'undefined') return;
    
    try {
      const now = Date.now();
      let restored = 0;
      
      // Find all cache items in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        
        if (storageKey && storageKey.startsWith('legal-dao-cache:')) {
          const key = storageKey.replace('legal-dao-cache:', '');
          
          try {
            const item = JSON.parse(localStorage.getItem(storageKey));
            
            // Only restore non-expired items
            if (item && item.expires > now) {
              this.cache.set(key, {
                ...item,
                created: item.created || now - 86400000, // Default to 1 day old if missing
                lastAccessed: now,
                accessCount: 0,
                size: this._estimateSize(item.value)
              });
              
              restored++;
            } else {
              // Clean up expired items
              localStorage.removeItem(storageKey);
            }
          } catch (parseError) {
            // Remove invalid items
            localStorage.removeItem(storageKey);
          }
        }
      }
      
      if (restored > 0) {
        this.stats.size = this.cache.size;
        this._log('info', `Restored ${restored} items from persistent storage`);
      }
    } catch (e) {
      this._log('error', `Error restoring from persistent storage: ${e.message}`);
    }
  }

  /**
   * Save current cache state before unload
   * @private
   */
  _saveState() {
    if (!this.config.persistenceEnabled || typeof localStorage === 'undefined') return;
    
    try {
      // Only save high-priority items on unload to avoid localStorage bloat
      for (const [key, item] of this.cache.entries()) {
        if (item.priority >= 5) {
          this._persistItem(key, item);
        }
      }
    } catch (e) {
      // Silent fail for unload events
    }
  }

  /**
   * Estimate the memory size of a value
   * @param {any} value - The value to measure
   * @returns {number} Estimated size in bytes
   * @private
   */
  _estimateSize(value) {
    if (value === null || value === undefined) return 0;
    
    try {
      // Quick estimate for simple types
      if (typeof value === 'boolean') return 4;
      if (typeof value === 'number') return 8;
      if (typeof value === 'string') return value.length * 2;
      
      // Use JSON stringification for objects with a size limit
      if (typeof value === 'object') {
        try {
          const json = JSON.stringify(value);
          return json.length * 2; // UTF-16 characters are 2 bytes
        } catch (e) {
          return 1000; // Default size for non-serializable objects
        }
      }
      
      return 8; // Default size
    } catch (e) {
      return 100; // Fallback size
    }
  }

  /**
   * Log based on configured log level
   * @private
   */
  _log(level, message) {
    const levels = {
      'error': 0,
      'warn': 1,
      'info': 2,
      'debug': 3
    };
    
    if (levels[level] <= levels[this.config.logLevel]) {
      const prefix = '[LegalDAO Cache]';
      
      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'debug':
          console.debug(prefix, message);
          break;
      }
    }
  }
}

// Create a singleton instance optimized for legal aid DAOs with slow proposals
const blockchainDataCache = new BlockchainDataCache({
  maxSize: 250,               // Store more items for legal contexts
  defaultTtl: 600000,         // 10 minutes default TTL
  cleanupInterval: 300000,    // 5 minutes cleanup interval
  persistenceEnabled: true,   // Enable persistence for important data
  logLevel: 'warn',           // Only log warnings and errors by default
  priorityItems: [
    'proposal', 
    'legal', 
    'case', 
    'document', 
    'contract', 
    'vote'
  ]
});

// Add window event listener to destroy cache on unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    blockchainDataCache.destroy();
  });
}

export default blockchainDataCache;