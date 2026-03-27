import * as functions from "firebase-functions";

/**
 * Structured logger wrapping firebase-functions.logger.
 * Provides consistent structured logging across all Cloud Functions.
 *
 * Usage:
 *   logger.info('Delivery created', { deliveryId, senderId, status });
 *   logger.error('Failed to send notification', { userId, error: err.message });
 */
export const logger = {
  info: (message: string, data?: Record<string, unknown>) =>
    functions.logger.info(message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    functions.logger.warn(message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    functions.logger.error(message, data),
  debug: (message: string, data?: Record<string, unknown>) =>
    functions.logger.debug(message, data),
};
