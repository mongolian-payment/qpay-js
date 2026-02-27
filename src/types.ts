// ============================================================================
// SDK Input/Output Types (camelCase for developer ergonomics)
// ============================================================================

/** Configuration for the QPayClient */
export interface QPayConfig {
  /** QPay API username */
  username: string;
  /** QPay API password */
  password: string;
  /** QPay API base endpoint (e.g. https://merchant.qpay.mn/v2) */
  endpoint: string;
  /** Callback URL that QPay will call after payment */
  callback: string;
  /** Invoice code assigned by QPay */
  invoiceCode: string;
  /** Merchant ID assigned by QPay */
  merchantId: string;
}

/** Input for creating an invoice (SDK-facing, camelCase) */
export interface CreateInvoiceInput {
  /** Sender code identifier */
  senderCode: string;
  /** Sender branch code */
  senderBranchCode: string;
  /** Receiver code identifier */
  receiverCode: string;
  /** Invoice description */
  description: string;
  /** Invoice amount */
  amount: number;
  /** Optional callback query parameters */
  callbackParam?: Record<string, string>;
}

/** Deeplink for a bank/wallet app */
export interface QPayDeeplink {
  /** Bank/wallet name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Logo URL */
  logo: string;
  /** Deep link URL */
  link: string;
}

/** Response from creating an invoice */
export interface QPayInvoiceResponse {
  /** Invoice ID */
  invoiceId: string;
  /** Short URL for the invoice */
  qPayShortUrl: string;
  /** QR code text content */
  qrText: string;
  /** Base64-encoded QR image */
  qrImage: string;
  /** Array of bank/wallet deep links */
  urls: QPayDeeplink[];
}

/** Response from getting invoice details */
export interface QPayInvoiceGetResponse {
  /** Whether amount can be exceeded */
  allowExceed: boolean;
  /** Whether partial payment is allowed */
  allowPartial: boolean;
  /** Callback URL */
  callbackUrl: string;
  /** Discount amount */
  discountAmount: number;
  /** Whether expiry is enabled */
  enableExpiry: boolean;
  /** Expiry date */
  expiryDate: string;
  /** Gross amount */
  grossAmount: number;
  /** Invoice description */
  invoiceDescription: string;
  /** Invoice due date */
  invoiceDueDate: unknown;
  /** Invoice ID */
  invoiceId: string;
  /** Invoice status */
  invoiceStatus: string;
  /** Maximum allowed amount */
  maximumAmount: number;
  /** Minimum allowed amount */
  minimumAmount: number;
  /** Note */
  note: string;
  /** Sender branch code */
  senderBranchCode: string;
  /** Sender branch data */
  senderBranchData: string;
  /** Sender invoice number */
  senderInvoiceNo: string;
  /** Surcharge amount */
  surchargeAmount: number;
  /** Tax amount */
  taxAmount: number;
  /** Total amount */
  totalAmount: number;
}

/** A single payment row */
export interface QPayPaymentRow {
  /** Payment ID */
  paymentId: string;
  /** Payment status: NEW, FAILED, PAID, REFUNDED */
  paymentStatus: string;
  /** Payment date */
  paymentDate: unknown;
  /** Payment fee */
  paymentFee: string;
  /** Payment amount */
  paymentAmount: string;
  /** Payment currency */
  paymentCurrency: string;
  /** Payment wallet (note: API returns "payemnt_wallet" - intentional typo) */
  paymentWallet: string;
  /** Transaction type */
  transactionType: string;
}

/** Response from checking payment status */
export interface QPayPaymentCheckResponse {
  /** Total number of matching payments */
  count: number;
  /** Total paid amount */
  paidAmount: number;
  /** Payment rows */
  rows: QPayPaymentRow[];
}

// ============================================================================
// Wire Format Types (snake_case, matching QPay API JSON exactly)
// ============================================================================

/** @internal Login response from QPay API */
export interface QPayLoginResponseWire {
  token_type: string;
  refresh_token: string;
  refresh_expires_in: number;
  access_token: string;
  expires_in: number;
  scope: string;
  "not-before-policy": string;
  session_state: string;
}

/** @internal Invoice creation request body */
export interface QPayInvoiceRequestWire {
  invoice_code: string;
  sender_invoice_no: string;
  sender_branch_code: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: number;
  callback_url: string;
}

/** @internal Invoice creation response from API */
export interface QPayInvoiceResponseWire {
  invoice_id: string;
  qPay_shortUrl: string;
  qr_text: string;
  qr_image: string;
  urls: QPayDeeplinkWire[];
}

/** @internal Deeplink from API */
export interface QPayDeeplinkWire {
  name: string;
  description: string;
  logo: string;
  link: string;
}

/** @internal Invoice get response from API */
export interface QPayInvoiceGetResponseWire {
  allow_exceed: boolean;
  allow_partial: boolean;
  callback_url: string;
  discount_amount: number;
  enable_expiry: boolean;
  expiry_date: string;
  gross_amount: number;
  invoice_description: string;
  invoice_due_date: unknown;
  invoice_id: string;
  invoice_status: string;
  maximum_amount: number;
  minimum_amount: number;
  note: string;
  sender_branch_code: string;
  sender_branch_data: string;
  sender_invoice_no: string;
  surcharge_amount: number;
  tax_amount: number;
  total_amount: number;
}

/** @internal Payment check request body */
export interface QPayPaymentCheckRequestWire {
  object_id: string;
  object_type: string;
  offset: {
    page_number: number;
    page_limit: number;
  };
}

/** @internal Payment check response from API */
export interface QPayPaymentCheckResponseWire {
  count: number;
  paid_amount: number;
  rows: QPayPaymentRowWire[];
}

/** @internal Payment row from API */
export interface QPayPaymentRowWire {
  payment_id: string;
  payment_status: string;
  payment_date: unknown;
  payment_fee: string;
  payment_amount: string;
  payment_currency: string;
  payemnt_wallet: string; // note: intentional typo from API
  transaction_type: string;
}

/** @internal Payment cancel request body */
export interface QPayPaymentCancelRequestWire {
  callback_url: string;
  note: string;
}
