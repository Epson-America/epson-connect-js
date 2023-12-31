// Scanner.js

const { AuthContext } = require('./Authenticate.js');

/**
 * Represents a Scanner that works with the given authentication context.
 */
class Scanner {
  
  /**
   * Create a Scanner instance.
   * @param {AuthContext} authContext - The authentication context required for the scanner.
   * @throws {ScannerError} Throws an error if authContext is not an instance of AuthContext.
   */
  constructor(authContext) {
    if (!(authContext instanceof AuthContext)) {
      throw new ScannerError('AuthContext instance required');
    }
    
    this._authContext = authContext;
    this._path = `/api/1/scanning/scanners/${this._authContext.deviceId}/destinations`;
    this._destination_cache = {};
    
    /**
     * @constant {Set<string>}
     * @description Set of valid destination types.
     */
    this.VALID_DESTINATION_TYPES = new Set([
      'mail',
      'url',
    ]);
  }

  /**
   * List the current set of destinations.
   * @returns {Promise<Object>} Returns the response from the server.
   */
  async list() {
    const response = await this._authContext.send('get', this._path);
    return response;
  }

  /**
   * Add a new destination.
   * @param {string} name - Name/alias for the destination.
   * @param {string} destination - Actual destination address.
   * @param {string} [type_='mail'] - Type of destination. Defaults to 'mail'.
   * @returns {Promise<Object>} Returns the response from the server.
   * @throws {ScannerError} Throws an error for invalid input values.
   */
  async add(name, destination, type_ = 'mail') {
    this._validateDestination(name, destination, type_);
    const data = {
      alias_name: name,
      type: type_,
      destination: destination,
    };
    const resp = await this._authContext.send('post', this._path, data);
    this._destination_cache[resp.id] = resp;
    return resp;
  }

  /**
   * Update an existing destination.
   * @param {number} id_ - ID of the destination to be updated.
   * @param {string} [name=null] - New name for the destination. 
   * @param {string} [destination=null] - New destination address.
   * @param {string} [type_=null] - New type of destination.
   * @returns {Promise<Object>} Returns the response from the server.
   * @throws {ScannerError} Throws an error for invalid input values or if destination is not registered.
   */
  async update(id_, name = null, destination = null, type_ = null) {
    const destCache = this._destination_cache[id_];
    if (!destCache) {
      throw new ScannerError('Scan destination is not yet registered.');
    }
    this._validateDestination(name, destination, type_);
    const data = {
      id: id_,
      alias_name: name || destCache.alias_name,
      type: type_ || destCache.type,
      destination: destination || destCache.destination,
    };
    const resp = await this._authContext.send('post', this._path, data);
    this._destination_cache[id_] = resp;
    return resp;
  }

  /**
   * Remove an existing destination.
   * @param {number} id_ - ID of the destination to be removed.
   * @returns {Promise<void>}
   */
  async remove(id_) {
    const data = { id: id_ };
    await this._authContext.send('delete', this._path, data);
    delete this._destination_cache[id_];
  }

  /**
   * Validate the provided destination parameters.
   * @param {string} name - Name of the destination.
   * @param {string} destination - Actual destination address.
   * @param {string} type_ - Type of the destination.
   * @private
   * @throws {ScannerError} Throws an error for invalid input values.
   */
  _validateDestination(name, destination, type_) {
    if (name.length < 1 || name.length > 32) {
      throw new ScannerError('Scan destination name too long.');
    }
    if (destination.length < 4 || destination.length > 544) {
      throw new ScannerError('Scan destination too long.');
    }
    if (!this.VALID_DESTINATION_TYPES.has(type_)) {
      throw new ScannerError(`Invalid scan destination type ${type_}.`);
    }
  }
}

/**
 * Custom error class for Scanner-related issues.
 */
class ScannerError extends Error {}

module.exports = { Scanner, ScannerError };
