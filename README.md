# @mongolian-payment/qpay

QPay V2 payment SDK for Node.js — create invoices, check payments, manage refunds.

[![npm version](https://img.shields.io/npm/v/@mongolian-payment/qpay.svg)](https://www.npmjs.com/package/@mongolian-payment/qpay)
[![license](https://img.shields.io/npm/l/@mongolian-payment/qpay.svg)](./LICENSE)

> Part of the **[mongolian-payment](https://github.com/mongolian-payment)** SDK suite.
> Also available for Python: **[mongolian-payment-qpay](https://pypi.org/project/mongolian-payment-qpay/)** ([source](https://github.com/mongolian-payment/qpay-py)).

## Requirements

- Node.js >= 18.0.0 (uses native `fetch`)

## Installation

```bash
npm install @mongolian-payment/qpay
```

## Quick Start

```typescript
import { QPayClient } from "@mongolian-payment/qpay";

const client = new QPayClient({
  username: "YOUR_USERNAME",
  password: "YOUR_PASSWORD",
  endpoint: "https://merchant.qpay.mn/v2",
  callback: "https://yourapp.com/payment/callback",
  invoiceCode: "YOUR_INVOICE_CODE",
  merchantId: "YOUR_MERCHANT_ID",
});

// Create an invoice
const invoice = await client.createInvoice({
  senderCode: "SENDER_001",
  senderBranchCode: "BRANCH_001",
  receiverCode: "RECEIVER_001",
  description: "Order #12345",
  amount: 50000,
});

console.log(invoice.qrText);       // QR code content
console.log(invoice.qPayShortUrl); // Short URL for payment
console.log(invoice.urls);         // Deep links for bank apps

// Check payment status
const payment = await client.checkPayment({ invoiceId: invoice.invoiceId });
if (payment.paidAmount > 0) {
  console.log("Payment received!");
}
```

## Configuration from Environment Variables

```typescript
import { QPayClient, loadConfigFromEnv } from "@mongolian-payment/qpay";

const client = new QPayClient(loadConfigFromEnv());
```

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `QPAY_USERNAME`     | QPay API username                 |
| `QPAY_PASSWORD`     | QPay API password                 |
| `QPAY_ENDPOINT`     | API base URL                      |
| `QPAY_CALLBACK`     | Payment notification callback URL |
| `QPAY_INVOICE_CODE` | Invoice code assigned by QPay     |
| `QPAY_MERCHANT_ID`  | Merchant ID assigned by QPay      |

> Never hard-code credentials — load them from the environment or a secrets vault.

## API Reference

Authentication is automatic — the client logs in on the first request and refreshes
the token when it expires.

| Method | Description |
|--------|-------------|
| `createInvoice(input)` | Create a payment invoice → `{ invoiceId, qPayShortUrl, qrText, qrImage, urls }` |
| `getInvoice(invoiceId)` | Get invoice details |
| `cancelInvoice(invoiceId)` | Cancel an invoice |
| `checkPayment(options)` | Check payment status for an invoice |
| `getPayment(paymentId)` | Get details for a specific payment |
| `cancelPayment(options?)` | Cancel a payment |
| `refundPayment(paymentId)` | Refund a payment |

```typescript
// createInvoice accepts optional query params appended to the callback URL
const invoice = await client.createInvoice({
  senderCode: "SENDER_001",
  senderBranchCode: "BRANCH_001",
  receiverCode: "RECEIVER_001",
  description: "Payment for order",
  amount: 10000,
  callbackParam: { orderId: "abc123" },
});

const details = await client.getInvoice(invoice.invoiceId);
console.log(details.invoiceStatus, details.totalAmount);

const result = await client.checkPayment({
  invoiceId: invoice.invoiceId,
  pageNumber: 1,  // optional, default 1
  pageLimit: 100, // optional, default 100
});
console.log(result.count, result.paidAmount, result.rows);
```

## Error Handling

All API errors throw `QPayError`, which includes the HTTP status code and response body:

```typescript
import { QPayError } from "@mongolian-payment/qpay";

try {
  await client.getInvoice("invalid_id");
} catch (err) {
  if (err instanceof QPayError) {
    console.error(err.message);    // Human-readable message
    console.error(err.statusCode); // HTTP status code (e.g. 404)
    console.error(err.response);   // Raw response body
  }
}
```

## License

MIT
