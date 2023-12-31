// Client.js

const { AuthContext } = require('./Authenticate.js');
const { Printer } = require('./Printer.js');
const { Scanner } = require('./Scanner.js');

/**
 * Represents a Client that interacts with the API using the provided authentication context.
 */
class Client {
  
  /**
   * Create a Client instance.
   * @param {string} [printerEmail=''] - Email of the printer.
   * @param {string} [clientId=''] - Client ID for API access.
   * @param {string} [clientSecret=''] - Client Secret for API access.
   * @param {string} [baseUrl='https://api.epsonconnect.com'] - Base URL of the API.
   * @throws {ClientError} Throws an error if mandatory parameters are missing.
   */
  constructor(printerEmail = '', clientId = '', clientSecret = '', baseUrl = 'https://api.epsonconnect.com') {
    printerEmail = printerEmail || process.env.EPSON_CONNECT_API_PRINTER_EMAIL;
    if (!printerEmail) {
      throw new ClientError('Printer Email can not be empty');
    }

    clientId = clientId || process.env.EPSON_CONNECT_API_CLIENT_ID;
    if (!clientId) {
      throw new ClientError('Client ID can not be empty');
    }

    clientSecret = clientSecret || process.env.EPSON_CONNECT_API_CLIENT_SECRET;
    if (!clientSecret) {
      throw new ClientError('Client Secret can not be empty');
    }

    this.authContext = new AuthContext(baseUrl, printerEmail, clientId, clientSecret);
  }

  /**
   * Initializes the client's authentication context.
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.authContext._initialize();
  }

  /**
   * Deauthenticates the client's authentication context.
   * @returns {Promise<void>}
   */
  async deauthenticate() {
    await this.authContext._deauthenticate();
  }

  /**
   * @property {Printer} printer - Returns an instance of the Printer class.
   */
  get printer() {
    return new Printer(this.authContext);
  }

  /**
   * @property {Scanner} scanner - Returns an instance of the Scanner class.
   */
  get scanner() {
    return new Scanner(this.authContext);
  }
}

/**
 * Custom error class for Client-related issues.
 */
class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClientError';
  }
}

module.exports = { Client, ClientError };
