// src/utils/blockchainDataCache.js
const blockchainDataCache = {
  data: new Map(),
  
  /**
   * Set data in cache with TTL and category for better management
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (default: 300)
   * @param {string} category - Category for grouped invalidation (default: 'general')
   */
  set(key, value, ttlSeconds = 300, category = 'general') {
    console.log(`Cache set: ${key} (category: ${category}, TTL: ${ttlSeconds}s)`);
    this.data.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000),
      category
    });
  },
  
  /**
   * Get data from cache with expiration check
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.data.delete(key);
      console.log(`Cache expired: ${key}`);
      return null;
    }
    
    console.log(`Cache hit: ${key}`);
    return entry.value;
  },
  
  /**
   * Invalidate all entries in a specific category
   * @param {string} category - Category to invalidate
   * @returns {number} Count of invalidated entries
   */
  invalidateCategory(category) {
    let count = 0;
    for (const [key, entry] of this.data.entries()) {
      if (entry.category === category) {
        this.data.delete(key);
        count++;
      }
    }
    console.log(`Invalidated ${count} entries in category: ${category}`);
    return count;
  },
  
  /**
   * Clear all cache entries
   * @returns {number} Count of cleared entries
   */
  clear() {
    const count = this.data.size;
    this.data.clear();
    console.log(`Cleared all cache (${count} entries)`);
    return count;
  },
  
  /**
   * Get information about the current cache state
   * @returns {Object} Cache statistics
   */
  getStats() {
    const categories = {};
    let totalSize = 0;
    
    for (const [key, entry] of this.data.entries()) {
      const category = entry.category || 'general';
      if (!categories[category]) {
        categories[category] = { count: 0, keys: [] };
      }
      categories[category].count++;
      categories[category].keys.push(key);
      totalSize++;
    }
    
    return { totalSize, categories };
  }
};

export default blockchainDataCache;