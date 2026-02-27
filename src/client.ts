import type {
  QPayConfig,
  CreateInvoiceInput,
  QPayInvoiceResponse,
  QPayInvoiceGetResponse,
  QPayPaymentCheckResponse,
  QPayPaymentRow,
  QPayLoginResponseWire,
  QPayInvoiceRequestWire,
  QPayInvoiceResponseWire,
  QPayInvoiceGetResponseWire,
  QPayPaymentCheckRequestWire,
  QPayPaymentCheckResponseWire,
  QPayPaymentRowWire,
  QPayPaymentCancelRequestWire,
} from "./types.js";
import { QPayError } from "./errors.js";

/** Options for checking payment status */
export interface CheckPaymentOptions {
  /** Invoice ID to check */
  invoiceId: string;
  /** Page number (default: 1) */
  pageNumber?: number;
  /** Page limit (default: 100) */
  pageLimit?: number;
}

/** Options for cancelling a payment */
export interface CancelPaymentOptions {
  /** Callback URL override */
  callbackUrl?: string;
  /** Note/reason for cancellation */
  note?: string;
}

/**
 * QPay V2 API client.
 *
 * Handles authentication (login + token refresh), invoice management,
 * and payment operations.
 *
 * @example
 * ```ts
 * import { QPayClient } from "@mongolian-payment/qpay";
 *
 * const client = new QPayClient({
 *   username: "MY_USERNAME",
 *   password: "MY_PASSWORD",
 *   endpoint: "https://merchant.qpay.mn/v2",
 *   callback: "https://example.com/callback",
 *   invoiceCode: "MY_INVOICE_CODE",
 *   merchantId: "MY_MERCHANT_ID",
 * });
 *
 * const invoice = await client.createInvoice({
 *   senderCode: "SENDER",
 *   senderBranchCode: "BRANCH",
 *   receiverCode: "RECEIVER",
 *   description: "Test payment",
 *   amount: 1000,
 * });
 * ```
 */
export class QPayClient {
  private readonly config: QPayConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private refreshExpiresAt: number = 0;

  constructor(config: QPayConfig) {
    this.config = config;
  }

  // ==========================================================================
  // Authentication (private)
  // ==========================================================================

  /**
   * Ensures we have a valid access token.
   * - If no token exists, performs a fresh login.
   * - If the access token is expired but the refresh token is still valid, refreshes.
   * - If both are expired, performs a fresh login.
   */
  private async auth(): Promise<string> {
    const now = Date.now();

    // Token still valid
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Access token expired but refresh token still valid
    if (this.refreshToken && now < this.refreshExpiresAt) {
      return this.refresh();
    }

    // No token or both expired - do a fresh login
    return this.login();
  }

  /** Perform Basic Auth login to obtain tokens */
  private async login(): Promise<string> {
    const credentials = btoa(
      `${this.config.username}:${this.config.password}`,
    );

    const res = await fetch(`${this.config.endpoint}/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new QPayError(
        `QPay login failed (${res.status})`,
        res.status,
        body,
      );
    }

    const data = (await res.json()) as QPayLoginResponseWire;
    this.setTokens(data);
    return this.accessToken!;
  }

  /** Refresh the access token using the refresh token */
  private async refresh(): Promise<string> {
    const res = await fetch(`${this.config.endpoint}/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.refreshToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // If refresh fails, fall back to a fresh login
      return this.login();
    }

    const data = (await res.json()) as QPayLoginResponseWire;
    this.setTokens(data);
    return this.accessToken!;
  }

  /** Store tokens and calculate expiry timestamps */
  private setTokens(data: QPayLoginResponseWire): void {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    const now = Date.now();
    // Subtract 60 seconds as a safety margin to avoid using an almost-expired token
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;
    this.refreshExpiresAt = now + (data.refresh_expires_in - 60) * 1000;
  }

  // ==========================================================================
  // HTTP helper
  // ==========================================================================

  /** Make an authenticated request to the QPay API */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.auth();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = { method, headers };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const url = `${this.config.endpoint}${path}`;
    const res = await fetch(url, options);

    // For DELETE endpoints that return 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    let responseBody: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      responseBody = await res.json();
    } else {
      responseBody = await res.text();
    }

    if (!res.ok) {
      throw new QPayError(
        `QPay API error: ${method} ${path} (${res.status})`,
        res.status,
        responseBody,
      );
    }

    return responseBody as T;
  }

  // ==========================================================================
  // Invoice Operations
  // ==========================================================================

  /**
   * Create a new invoice.
   *
   * @param input - Invoice creation parameters
   * @returns The created invoice with QR code and deep links
   */
  async createInvoice(input: CreateInvoiceInput): Promise<QPayInvoiceResponse> {
    let callbackUrl = this.config.callback;
    if (input.callbackParam) {
      const params = new URLSearchParams(input.callbackParam);
      callbackUrl = `${callbackUrl}?${params.toString()}`;
    }

    const wireBody: QPayInvoiceRequestWire = {
      invoice_code: this.config.invoiceCode,
      sender_invoice_no: input.senderCode,
      sender_branch_code: input.senderBranchCode,
      invoice_receiver_code: input.receiverCode,
      invoice_description: input.description,
      amount: input.amount,
      callback_url: callbackUrl,
    };

    const wire = await this.request<QPayInvoiceResponseWire>(
      "POST",
      "/invoice",
      wireBody,
    );

    return this.mapInvoiceResponse(wire);
  }

  /**
   * Get invoice details by ID.
   *
   * @param invoiceId - The invoice ID
   * @returns Invoice details
   */
  async getInvoice(invoiceId: string): Promise<QPayInvoiceGetResponse> {
    const wire = await this.request<QPayInvoiceGetResponseWire>(
      "GET",
      `/invoice/${encodeURIComponent(invoiceId)}`,
    );

    return this.mapInvoiceGetResponse(wire);
  }

  /**
   * Cancel an invoice by ID.
   *
   * @param invoiceId - The invoice ID to cancel
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/invoice/${encodeURIComponent(invoiceId)}`,
    );
  }

  // ==========================================================================
  // Payment Operations
  // ==========================================================================

  /**
   * Get payment details by ID.
   *
   * @param paymentId - The payment ID
   * @returns Payment details
   */
  async getPayment(paymentId: string): Promise<QPayPaymentRow> {
    const wire = await this.request<QPayPaymentRowWire>(
      "GET",
      `/payment/get/${encodeURIComponent(paymentId)}`,
    );

    return this.mapPaymentRow(wire);
  }

  /**
   * Check payment status for an invoice.
   *
   * @param options - Check payment options including invoiceId and pagination
   * @returns Payment check response with count, paid amount, and payment rows
   */
  async checkPayment(
    options: CheckPaymentOptions,
  ): Promise<QPayPaymentCheckResponse> {
    const wireBody: QPayPaymentCheckRequestWire = {
      object_id: options.invoiceId,
      object_type: "INVOICE",
      offset: {
        page_number: options.pageNumber ?? 1,
        page_limit: options.pageLimit ?? 100,
      },
    };

    const wire = await this.request<QPayPaymentCheckResponseWire>(
      "POST",
      "/payment/check",
      wireBody,
    );

    return this.mapPaymentCheckResponse(wire);
  }

  /**
   * Cancel a payment.
   *
   * @param options - Cancel payment options
   */
  async cancelPayment(options?: CancelPaymentOptions): Promise<void> {
    const wireBody: QPayPaymentCancelRequestWire = {
      callback_url: options?.callbackUrl ?? this.config.callback,
      note: options?.note ?? "",
    };

    await this.request<void>("DELETE", "/payment/cancel", wireBody);
  }

  /**
   * Refund a payment by ID.
   *
   * @param paymentId - The payment ID to refund
   */
  async refundPayment(paymentId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/payment/refund/${encodeURIComponent(paymentId)}`,
    );
  }

  // ==========================================================================
  // Wire → SDK type mappers
  // ==========================================================================

  private mapInvoiceResponse(wire: QPayInvoiceResponseWire): QPayInvoiceResponse {
    return {
      invoiceId: wire.invoice_id,
      qPayShortUrl: wire.qPay_shortUrl,
      qrText: wire.qr_text,
      qrImage: wire.qr_image,
      urls: wire.urls.map((u) => ({
        name: u.name,
        description: u.description,
        logo: u.logo,
        link: u.link,
      })),
    };
  }

  private mapInvoiceGetResponse(wire: QPayInvoiceGetResponseWire): QPayInvoiceGetResponse {
    return {
      allowExceed: wire.allow_exceed,
      allowPartial: wire.allow_partial,
      callbackUrl: wire.callback_url,
      discountAmount: wire.discount_amount,
      enableExpiry: wire.enable_expiry,
      expiryDate: wire.expiry_date,
      grossAmount: wire.gross_amount,
      invoiceDescription: wire.invoice_description,
      invoiceDueDate: wire.invoice_due_date,
      invoiceId: wire.invoice_id,
      invoiceStatus: wire.invoice_status,
      maximumAmount: wire.maximum_amount,
      minimumAmount: wire.minimum_amount,
      note: wire.note,
      senderBranchCode: wire.sender_branch_code,
      senderBranchData: wire.sender_branch_data,
      senderInvoiceNo: wire.sender_invoice_no,
      surchargeAmount: wire.surcharge_amount,
      taxAmount: wire.tax_amount,
      totalAmount: wire.total_amount,
    };
  }

  private mapPaymentCheckResponse(wire: QPayPaymentCheckResponseWire): QPayPaymentCheckResponse {
    return {
      count: wire.count,
      paidAmount: wire.paid_amount,
      rows: wire.rows.map((r) => this.mapPaymentRow(r)),
    };
  }

  private mapPaymentRow(wire: QPayPaymentRowWire): QPayPaymentRow {
    return {
      paymentId: wire.payment_id,
      paymentStatus: wire.payment_status,
      paymentDate: wire.payment_date,
      paymentFee: wire.payment_fee,
      paymentAmount: wire.payment_amount,
      paymentCurrency: wire.payment_currency,
      paymentWallet: wire.payemnt_wallet, // note: intentional typo from API
      transactionType: wire.transaction_type,
    };
  }
}
