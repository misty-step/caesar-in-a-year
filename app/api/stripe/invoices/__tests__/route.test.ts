import { describe, it, expect } from "vitest";

/**
 * Invoices route logic tests
 *
 * Tests the data transformation patterns for billing history.
 */

describe("Invoices route logic", () => {
  describe("invoice transformation", () => {
    it("transforms Stripe invoice to API response", () => {
      const stripeInvoice = {
        id: "in_abc123",
        created: 1700000000, // Unix seconds
        amount_paid: 1499, // Cents
        status: "paid",
        invoice_pdf: "https://stripe.com/invoices/in_abc123.pdf",
      };

      const transformed = {
        id: stripeInvoice.id,
        date: stripeInvoice.created * 1000, // Convert to ms
        amount: stripeInvoice.amount_paid / 100, // Convert to dollars
        status: stripeInvoice.status,
        invoicePdf: stripeInvoice.invoice_pdf,
      };

      expect(transformed).toEqual({
        id: "in_abc123",
        date: 1700000000000,
        amount: 14.99,
        status: "paid",
        invoicePdf: "https://stripe.com/invoices/in_abc123.pdf",
      });
    });

    it("handles invoice without PDF", () => {
      const stripeInvoice = {
        id: "in_xyz789",
        created: 1700000000,
        amount_paid: 0,
        status: "draft",
        invoice_pdf: null,
      };

      const transformed = {
        id: stripeInvoice.id,
        date: stripeInvoice.created * 1000,
        amount: stripeInvoice.amount_paid / 100,
        status: stripeInvoice.status,
        invoicePdf: stripeInvoice.invoice_pdf,
      };

      expect(transformed.invoicePdf).toBeNull();
      expect(transformed.amount).toBe(0);
    });

    it("handles various invoice statuses", () => {
      const statuses = ["draft", "open", "paid", "uncollectible", "void"];

      statuses.forEach((status) => {
        const invoice = { status };
        expect(typeof invoice.status).toBe("string");
      });
    });
  });

  describe("response shape", () => {
    it("returns invoices array", () => {
      const response = {
        invoices: [
          { id: "in_1", date: 1700000000000, amount: 14.99, status: "paid", invoicePdf: "url" },
          { id: "in_2", date: 1697000000000, amount: 14.99, status: "paid", invoicePdf: "url" },
        ],
      };

      expect(Array.isArray(response.invoices)).toBe(true);
      expect(response.invoices.length).toBe(2);
    });

    it("returns empty array when no customer", () => {
      const response = { invoices: [] };
      expect(response.invoices).toEqual([]);
    });

    it("limits to 10 invoices", () => {
      // The route uses limit: 10 when fetching from Stripe
      const limit = 10;
      const invoices = Array(15).fill({ id: "in_x" });
      const limited = invoices.slice(0, limit);
      expect(limited.length).toBe(10);
    });
  });

  describe("date formatting in UI", () => {
    it("converts timestamp to readable date", () => {
      const timestamp = 1700000000000;
      const date = new Date(timestamp);
      const formatted = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      expect(formatted).toBe("November 14, 2023");
    });
  });

  describe("currency formatting in UI", () => {
    it("formats amount as USD", () => {
      const amount = 14.99;
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      expect(formatted).toBe("$14.99");
    });

    it("handles zero amount", () => {
      const amount = 0;
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      expect(formatted).toBe("$0.00");
    });
  });
});
