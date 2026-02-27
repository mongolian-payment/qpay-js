import type { QPayConfig } from "./types.js";

/**
 * Loads QPay configuration from environment variables.
 *
 * Expected environment variables:
 * - `QPAY_USERNAME` - QPay API username
 * - `QPAY_PASSWORD` - QPay API password
 * - `QPAY_ENDPOINT` - QPay API base URL (e.g. https://merchant.qpay.mn/v2)
 * - `QPAY_CALLBACK` - Callback URL for payment notifications
 * - `QPAY_INVOICE_CODE` - Invoice code assigned by QPay
 * - `QPAY_MERCHANT_ID` - Merchant ID assigned by QPay
 *
 * @throws {Error} If any required environment variable is missing
 */
export function loadConfigFromEnv(): QPayConfig {
  const required: Array<[keyof QPayConfig, string]> = [
    ["username", "QPAY_USERNAME"],
    ["password", "QPAY_PASSWORD"],
    ["endpoint", "QPAY_ENDPOINT"],
    ["callback", "QPAY_CALLBACK"],
    ["invoiceCode", "QPAY_INVOICE_CODE"],
    ["merchantId", "QPAY_MERCHANT_ID"],
  ];

  const config: Record<string, string> = {};

  const missing: string[] = [];
  for (const [key, envVar] of required) {
    const value = process.env[envVar];
    if (!value) {
      missing.push(envVar);
    } else {
      config[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return config as unknown as QPayConfig;
}
