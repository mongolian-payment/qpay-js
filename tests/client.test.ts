import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QPayClient } from "../src/client.js";
import { QPayError } from "../src/errors.js";
import type { QPayConfig } from "../src/types.js";

const TEST_CONFIG: QPayConfig = {
  username: "test_user",
  password: "test_pass",
  endpoint: "https://merchant.qpay.mn/v2",
  callback: "https://example.com/callback",
  invoiceCode: "TEST_INVOICE_CODE",
  merchantId: "TEST_MERCHANT_ID",
};

const MOCK_LOGIN_RESPONSE = {
  token_type: "Bearer",
  refresh_token: "mock_refresh_token",
  refresh_expires_in: 43200,
  access_token: "mock_access_token",
  expires_in: 3600,
  scope: "default",
  "not-before-policy": "0",
  session_state: "mock_session",
};

const MOCK_INVOICE_RESPONSE = {
  invoice_id: "inv_123",
  qPay_shortUrl: "https://qpay.mn/i/123",
  qr_text: "qr_text_content",
  qr_image: "base64_qr_image",
  urls: [
    {
      name: "Khan Bank",
      description: "Khan Bank app",
      logo: "https://example.com/logo.png",
      link: "khanbank://pay?id=123",
    },
  ],
};

const MOCK_INVOICE_GET_RESPONSE = {
  allow_exceed: false,
  allow_partial: false,
  callback_url: "https://example.com/callback",
  discount_amount: 0,
  enable_expiry: true,
  expiry_date: "2026-03-01T00:00:00Z",
  gross_amount: 1000,
  invoice_description: "Test invoice",
  invoice_due_date: null,
  invoice_id: "inv_123",
  invoice_status: "OPEN",
  maximum_amount: 1000,
  minimum_amount: 1000,
  note: "",
  sender_branch_code: "BRANCH",
  sender_branch_data: "",
  sender_invoice_no: "SENDER",
  surcharge_amount: 0,
  tax_amount: 0,
  total_amount: 1000,
};

const MOCK_PAYMENT_CHECK_RESPONSE = {
  count: 1,
  paid_amount: 1000,
  rows: [
    {
      payment_id: "pay_123",
      payment_status: "PAID",
      payment_date: "2026-02-27T10:00:00Z",
      payment_fee: "0",
      payment_amount: "1000",
      payment_currency: "MNT",
      payemnt_wallet: "Khan Bank", // intentional typo matching API
      transaction_type: "P2P",
    },
  ],
};

const MOCK_PAYMENT_ROW = {
  payment_id: "pay_456",
  payment_status: "PAID",
  payment_date: "2026-02-27T12:00:00Z",
  payment_fee: "10",
  payment_amount: "5000",
  payment_currency: "MNT",
  payemnt_wallet: "Golomt Bank",
  transaction_type: "P2P",
};

// Helper: create a mock fetch response
function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function mockFetchNoContent(): Response {
  return {
    ok: true,
    status: 204,
    headers: new Headers({}),
    json: () => Promise.reject(new Error("No content")),
    text: () => Promise.resolve(""),
  } as Response;
}

describe("QPayClient", () => {
  let client: QPayClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new QPayClient(TEST_CONFIG);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication", () => {
    it("should login with Basic Auth on first request", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_GET_RESPONSE));

      await client.getInvoice("inv_123");

      // First call should be login
      const loginCall = fetchMock.mock.calls[0];
      expect(loginCall[0]).toBe("https://merchant.qpay.mn/v2/auth/token");
      expect(loginCall[1].method).toBe("POST");
      expect(loginCall[1].headers.Authorization).toBe(
        `Basic ${btoa("test_user:test_pass")}`,
      );

      // Second call should use Bearer token
      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[1].headers.Authorization).toBe(
        "Bearer mock_access_token",
      );
    });

    it("should reuse cached token for subsequent requests", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_GET_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_GET_RESPONSE));

      await client.getInvoice("inv_123");
      await client.getInvoice("inv_456");

      // Should only have 1 login call + 2 API calls = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("should throw QPayError on login failure", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ error: "unauthorized" }, 401),
      );

      await expect(client.getInvoice("inv_123")).rejects.toThrow(QPayError);
    });
  });

  describe("createInvoice", () => {
    it("should create an invoice with correct wire format", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_RESPONSE));

      const result = await client.createInvoice({
        senderCode: "SENDER",
        senderBranchCode: "BRANCH",
        receiverCode: "RECEIVER",
        description: "Test payment",
        amount: 1000,
      });

      // Verify wire format sent to API
      const apiCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody).toEqual({
        invoice_code: "TEST_INVOICE_CODE",
        sender_invoice_no: "SENDER",
        sender_branch_code: "BRANCH",
        invoice_receiver_code: "RECEIVER",
        invoice_description: "Test payment",
        amount: 1000,
        callback_url: "https://example.com/callback",
      });

      // Verify camelCase response
      expect(result.invoiceId).toBe("inv_123");
      expect(result.qPayShortUrl).toBe("https://qpay.mn/i/123");
      expect(result.qrText).toBe("qr_text_content");
      expect(result.qrImage).toBe("base64_qr_image");
      expect(result.urls).toHaveLength(1);
      expect(result.urls[0].name).toBe("Khan Bank");
    });

    it("should append callback params to URL", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_RESPONSE));

      await client.createInvoice({
        senderCode: "SENDER",
        senderBranchCode: "BRANCH",
        receiverCode: "RECEIVER",
        description: "Test",
        amount: 500,
        callbackParam: { orderId: "abc123", type: "purchase" },
      });

      const apiCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody.callback_url).toContain("orderId=abc123");
      expect(sentBody.callback_url).toContain("type=purchase");
    });
  });

  describe("getInvoice", () => {
    it("should get invoice and map to camelCase", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_INVOICE_GET_RESPONSE));

      const result = await client.getInvoice("inv_123");

      expect(result.invoiceId).toBe("inv_123");
      expect(result.invoiceStatus).toBe("OPEN");
      expect(result.totalAmount).toBe(1000);
      expect(result.allowExceed).toBe(false);
      expect(result.enableExpiry).toBe(true);

      // Verify correct URL
      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[0]).toBe(
        "https://merchant.qpay.mn/v2/invoice/inv_123",
      );
    });
  });

  describe("cancelInvoice", () => {
    it("should send DELETE request to correct URL", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchNoContent());

      await client.cancelInvoice("inv_123");

      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[0]).toBe(
        "https://merchant.qpay.mn/v2/invoice/inv_123",
      );
      expect(apiCall[1].method).toBe("DELETE");
    });
  });

  describe("getPayment", () => {
    it("should get payment and map to camelCase", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_PAYMENT_ROW));

      const result = await client.getPayment("pay_456");

      expect(result.paymentId).toBe("pay_456");
      expect(result.paymentStatus).toBe("PAID");
      expect(result.paymentAmount).toBe("5000");
      expect(result.paymentWallet).toBe("Golomt Bank");

      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[0]).toBe(
        "https://merchant.qpay.mn/v2/payment/get/pay_456",
      );
    });
  });

  describe("checkPayment", () => {
    it("should check payment with correct wire format", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse(MOCK_PAYMENT_CHECK_RESPONSE),
        );

      const result = await client.checkPayment({
        invoiceId: "inv_123",
        pageNumber: 1,
        pageLimit: 50,
      });

      // Verify wire format
      const apiCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody).toEqual({
        object_id: "inv_123",
        object_type: "INVOICE",
        offset: { page_number: 1, page_limit: 50 },
      });

      // Verify camelCase response
      expect(result.count).toBe(1);
      expect(result.paidAmount).toBe(1000);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].paymentId).toBe("pay_123");
      expect(result.rows[0].paymentStatus).toBe("PAID");
      expect(result.rows[0].paymentWallet).toBe("Khan Bank");
    });

    it("should use default pagination values", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse(MOCK_PAYMENT_CHECK_RESPONSE),
        );

      await client.checkPayment({ invoiceId: "inv_123" });

      const apiCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody.offset).toEqual({
        page_number: 1,
        page_limit: 100,
      });
    });
  });

  describe("cancelPayment", () => {
    it("should send DELETE with cancel body", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchNoContent());

      await client.cancelPayment({
        callbackUrl: "https://example.com/cancel-callback",
        note: "Customer requested",
      });

      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[0]).toBe(
        "https://merchant.qpay.mn/v2/payment/cancel",
      );
      expect(apiCall[1].method).toBe("DELETE");
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody).toEqual({
        callback_url: "https://example.com/cancel-callback",
        note: "Customer requested",
      });
    });

    it("should use default callback when no options provided", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchNoContent());

      await client.cancelPayment();

      const apiCall = fetchMock.mock.calls[1];
      const sentBody = JSON.parse(apiCall[1].body);
      expect(sentBody.callback_url).toBe("https://example.com/callback");
      expect(sentBody.note).toBe("");
    });
  });

  describe("refundPayment", () => {
    it("should send DELETE to correct URL", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(mockFetchNoContent());

      await client.refundPayment("pay_789");

      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[0]).toBe(
        "https://merchant.qpay.mn/v2/payment/refund/pay_789",
      );
      expect(apiCall[1].method).toBe("DELETE");
    });
  });

  describe("error handling", () => {
    it("should throw QPayError with status code on API error", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LOGIN_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "not found" }, 404),
        );

      try {
        await client.getInvoice("nonexistent");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(QPayError);
        const qpayErr = err as QPayError;
        expect(qpayErr.statusCode).toBe(404);
        expect(qpayErr.response).toEqual({ error: "not found" });
      }
    });
  });
});

describe("loadConfigFromEnv", () => {
  it("should load config from environment variables", async () => {
    const { loadConfigFromEnv } = await import("../src/config.js");

    process.env.QPAY_USERNAME = "user";
    process.env.QPAY_PASSWORD = "pass";
    process.env.QPAY_ENDPOINT = "https://merchant.qpay.mn/v2";
    process.env.QPAY_CALLBACK = "https://example.com/cb";
    process.env.QPAY_INVOICE_CODE = "INV";
    process.env.QPAY_MERCHANT_ID = "MER";

    const config = loadConfigFromEnv();
    expect(config.username).toBe("user");
    expect(config.password).toBe("pass");
    expect(config.endpoint).toBe("https://merchant.qpay.mn/v2");
    expect(config.callback).toBe("https://example.com/cb");
    expect(config.invoiceCode).toBe("INV");
    expect(config.merchantId).toBe("MER");

    // Cleanup
    delete process.env.QPAY_USERNAME;
    delete process.env.QPAY_PASSWORD;
    delete process.env.QPAY_ENDPOINT;
    delete process.env.QPAY_CALLBACK;
    delete process.env.QPAY_INVOICE_CODE;
    delete process.env.QPAY_MERCHANT_ID;
  });

  it("should throw if required env vars are missing", async () => {
    const { loadConfigFromEnv } = await import("../src/config.js");

    // Make sure none are set
    delete process.env.QPAY_USERNAME;
    delete process.env.QPAY_PASSWORD;
    delete process.env.QPAY_ENDPOINT;
    delete process.env.QPAY_CALLBACK;
    delete process.env.QPAY_INVOICE_CODE;
    delete process.env.QPAY_MERCHANT_ID;

    expect(() => loadConfigFromEnv()).toThrow(
      "Missing required environment variables",
    );
  });
});
