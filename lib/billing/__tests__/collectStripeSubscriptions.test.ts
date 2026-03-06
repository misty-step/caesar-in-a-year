import { describe, expect, it, vi } from "vitest";
import { collectStripeSubscriptions } from "../collectStripeSubscriptions";

describe("collectStripeSubscriptions", () => {
  it("collects paginated Stripe snapshots until hasMore=false", async () => {
    const fetchPage = vi
      .fn<
        (startingAfter?: string) => Promise<{ data: Array<{ id: string; customerId: string; status: string; created: number }>; hasMore: boolean }>
      >()
      .mockResolvedValueOnce({
        data: [
          { id: "sub_1", customerId: "cus_1", status: "active", created: 1 },
          { id: "sub_2", customerId: "cus_2", status: "active", created: 2 },
        ],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        data: [
          { id: "sub_3", customerId: "cus_3", status: "past_due", created: 3 },
        ],
        hasMore: false,
      });

    const result = await collectStripeSubscriptions(fetchPage);

    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "sub_2");
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual(["sub_1", "sub_2", "sub_3"]);
  });

  it("throws when hasMore=true but no cursor is available", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [],
      hasMore: true,
    });

    await expect(collectStripeSubscriptions(fetchPage)).rejects.toThrow(
      "no cursor"
    );
  });

  it("continues pagination using lastRawId when filtered data is empty", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [],
        hasMore: true,
        lastRawId: "sub_filtered_out",
      })
      .mockResolvedValueOnce({
        data: [
          { id: "sub_1", customerId: "cus_1", status: "active", created: 1 },
        ],
        hasMore: false,
      });

    const result = await collectStripeSubscriptions(fetchPage);

    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "sub_filtered_out");
    expect(result).toHaveLength(1);
  });
});
