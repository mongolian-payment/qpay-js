# @mongolian-payment/qpay

QPay V2 payment SDK for Node.js. Create invoices, check payments, manage refunds.

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

console.log(invoice.qrText);      // QR code content
console.log(invoice.qPayShortUrl); // Short URL for payment
console.log(invoice.urls);         // Deep links for bank apps

// Check payment status
const payment = await client.checkPayment({
  invoiceId: invoice.invoiceId,
});

if (payment.paidAmount > 0) {
  console.log("Payment received!");
}
```

## Environment Variable Configuration

You can load configuration from environment variables:

```typescript
import { QPayClient, loadConfigFromEnv } from "@mongolian-payment/qpay";

const client = new QPayClient(loadConfigFromEnv());
```

Set the following environment variables:

| Variable            | Description                          |
| ------------------- | ------------------------------------ |
| `QPAY_USERNAME`     | QPay API username                    |
| `QPAY_PASSWORD`     | QPay API password                    |
| `QPAY_ENDPOINT`     | API base URL                         |
| `QPAY_CALLBACK`     | Payment notification callback URL    |
| `QPAY_INVOICE_CODE` | Invoice code assigned by QPay        |
| `QPAY_MERCHANT_ID`  | Merchant ID assigned by QPay         |

## API Reference

### `new QPayClient(config)`

Creates a new QPay client. Authentication is handled automatically -- the client logs in on the first request and refreshes the token when it expires.

### Invoice Methods

#### `client.createInvoice(input)`

Create a new payment invoice.

```typescript
const invoice = await client.createInvoice({
  senderCode: "SENDER_001",
  senderBranchCode: "BRANCH_001",
  receiverCode: "RECEIVER_001",
  description: "Payment for order",
  amount: 10000,
  callbackParam: { orderId: "abc123" }, // optional query params appended to callback URL
});
```

Returns: `QPayInvoiceResponse` with `invoiceId`, `qPayShortUrl`, `qrText`, `qrImage`, and `urls` (deep links).

#### `client.getInvoice(invoiceId)`

Get invoice details.

```typescript
const details = await client.getInvoice("invoice_id_here");
console.log(details.invoiceStatus); // "OPEN", "CLOSED", etc.
console.log(details.totalAmount);
```

#### `client.cancelInvoice(invoiceId)`

Cancel an invoice.

```typescript
await client.cancelInvoice("invoice_id_here");
```

### Payment Methods

#### `client.checkPayment(options)`

Check payment status for an invoice.

```typescript
const result = await client.checkPayment({
  invoiceId: "invoice_id_here",
  pageNumber: 1,  // optional, default: 1
  pageLimit: 100,  // optional, default: 100
});

console.log(result.count);      // number of payments
console.log(result.paidAmount); // total paid
console.log(result.rows);      // individual payment rows
```

#### `client.getPayment(paymentId)`

Get details for a specific payment.

```typescript
const payment = await client.getPayment("payment_id_here");
console.log(payment.paymentStatus); // "NEW", "PAID", "FAILED", "REFUNDED"
```

#### `client.cancelPayment(options?)`

Cancel a payment.

```typescript
await client.cancelPayment({
  callbackUrl: "https://yourapp.com/cancel-callback", // optional
  note: "Customer requested cancellation",             // optional
});
```

#### `client.refundPayment(paymentId)`

Refund a payment.

```typescript
await client.refundPayment("payment_id_here");
```

## Error Handling

All API errors throw `QPayError` which includes the HTTP status code and response body:

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
