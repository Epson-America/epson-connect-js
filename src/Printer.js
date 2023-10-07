// Printer.js

const { URL, URLSearchParams } = require('url');
const fs = require('fs');
const axios = require('axios');
const { AuthContext } = require('./Authenticate.js');
const { mergeWithDefaultSettings, validateSettings } = require('./PrinterSettings');

/**
 * Represents a Printer with various capabilities and operations.
 */
class Printer {
  
  /**
   * Create a Printer instance.
   * @param {AuthContext} authContext - The authentication context for the printer.
   * @throws {PrinterError} Throws an error if the provided authContext is not an instance of AuthContext.
   */
  constructor(authContext) {
    if (!(authContext instanceof AuthContext)) {
      throw new PrinterError('AuthContext instance required');
    }
    
    this._authContext = authContext;
    
    this.VALID_EXTENSIONS = new Set([
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'pdf',
      'jpeg',
      'jpg',
      'bmp',
      'gif',
      'png',
      'tiff',
    ]);
    
    this.VALID_OPERATORS = new Set([
      'user',
      'operator',
    ]);
  }
  
  /**
   * @property {string} deviceId - Device ID of the printer.
   */
  get deviceId() {
    return this._authContext.deviceId;
  }
  
  /**
   * Fetches the capabilities of the printer based on the mode.
   * @param {string} mode - Mode of operation.
   * @returns {Promise<Object>} Returns the printer's capabilities for the given mode.
   */  
  async capabilities(mode) {
    const path = `/api/1/printing/printers/${this.deviceId}/capability/${mode}`;
    const response = await this._authContext.send('get', path);

    return response;
  }
  
  /**
   * Handles the print settings for the printer.
   * @param {Object} settings - Print settings.
   * @returns {Promise<Object>} Returns the printer's response to the provided settings.
   */
  async printSetting(settings) {
    settings = mergeWithDefaultSettings(settings);
    validateSettings(settings);
    const path = `/api/1/printing/printers/${this.deviceId}/jobs`;
    const response = await this._authContext.send('post', path, settings);

    // Add settings object to the response
    response.settings = settings;

    return response;
  }
  
  /**
   * Uploads a file to the printer.
   * @param {string} uploadUri - URI for uploading the file.
   * @param {string} filePath - Path to the file being uploaded.
   * @param {string} printMode - Mode in which the file should be printed.
   * @returns {Promise<Object>} Returns the printer's response after the file upload.
   * @throws {PrinterError} Throws an error if the file extension is invalid.
   */
  async uploadFile(uploadUri, filePath, printMode) {
    const extension = filePath.split('.').pop().toLowerCase();
    if (!this.VALID_EXTENSIONS.has(extension)) {
      throw new PrinterError(`${extension} is not a valid printing extension.`);
    }
    
    const urlObj = new URL(uploadUri);
    const qDict = Object.fromEntries(urlObj.searchParams.entries());
    qDict.Key = qDict.Key;
    qDict.File = `1.${extension}`;
    urlObj.search = new URLSearchParams(qDict).toString();
    const path = urlObj.pathname + urlObj.search;
    
    const contentType = printMode === 'photo' ? 'image/jpeg' : 'application/octet-stream';
    
    let data;
    
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Use axios to fetch the file data as an arraybuffer
      const response = await axios.get(filePath, { responseType: 'arraybuffer' });
      data = Buffer.from(response.data, 'binary');
    } else {
      // It's a local file path, read the file using fs
      data = await fs.promises.readFile(filePath);
    }
  
    const uploadResponse = await this._authContext.send('post', path, data, { 'Content-Type': contentType, 'Content-Length': data.length.toString() });
    
    return uploadResponse;
  }

  /**
   * Initiates the print job for a file.
   * @param {string} jobId - ID of the print job.
   * @returns {Promise<Object>} Returns the printer's response for the print job execution.
   */
  async executePrint(jobId) {
    const path = `/api/1/printing/printers/${this.deviceId}/jobs/${jobId}/print`;
    const response = await this._authContext.send('post', path);

    return response;
  }

  /**
   * Combines print settings, file upload, and print job execution to print a file.
   * @param {string} filePath - Path to the file to be printed.
   * @param {Object} [settings={}] - Print settings.
   * @returns {Promise<string>} Returns the ID of the print job.
   */
  async print(filePath, settings = {}) {
    const jobData = await this.printSetting(settings);
    await this.uploadFile(jobData.upload_uri, filePath, jobData.settings.print_mode);
    await this.executePrint(jobData.id);
    return jobData.id;
  }

  /**
   * Cancels a pending print job.
   * @param {string} jobId - ID of the print job to be canceled.
   * @param {string} [operatedBy='user'] - Identifier for who is canceling the job.
   * @returns {Promise<Object>} Returns the printer's response after canceling the print job.
   * @throws {PrinterError} Throws an error if invalid operator is provided or the job status does not allow cancelation.
   */
  async cancelPrint(jobId, operatedBy = 'user') {
    if (!this.VALID_OPERATORS.has(operatedBy)) {
      throw new PrinterError(`Invalid "operated_by" value ${operatedBy}`);
    }
    
    const jobStatus = (await this.jobInfo(jobId)).status;
    if (!['pending', 'pending_held'].includes(jobStatus)) {
      throw new PrinterError(`Can not cancel job with status ${jobStatus}`);
    }
    
    const path = `/api/1/printing/printers/${this.deviceId}/jobs/${jobId}/cancel`;
    const response = await this._authContext.send('post', path, { operated_by: operatedBy });

    return response;
  }

  /**
   * Retrieves information about a specific print job.
   * @param {string} jobId - ID of the print job.
   * @returns {Promise<Object>} Returns detailed information about the print job.
   */
  async jobInfo(jobId) {
    const path = `/api/1/printing/printers/${this.deviceId}/jobs/${jobId}`;
    const response = await this._authContext.send('get', path);

    return response;
  }

  /**
   * Retrieves information about the printer.
   * @returns {Promise<Object>} Returns detailed information about the printer.
   */
  async info() {
    const path = `/api/1/printing/printers/${this.deviceId}`;
    const response = await this._authContext.send('get', path);

    return response;
  }

  /**
   * Handles printer notifications.
   * @param {string} callbackUri - URI for receiving callbacks.
   * @param {boolean} [enabled=true] - Whether to enable or disable notifications.
   * @returns {Promise<Object>} Returns the printer's response for the notification settings.
   */
  async notification(callbackUri, enabled = true) {
    const path = `/api/1/printing/printers/${this.deviceId}/settings/notifications`;
    const response = await this._authContext.send('post', path, { notification: enabled, callback_uri: callbackUri });

    return response;
  }
}


/**
 * Custom error class for Printer-related issues.
 */
class PrinterError extends Error {}

module.exports = { Printer, PrinterError };
