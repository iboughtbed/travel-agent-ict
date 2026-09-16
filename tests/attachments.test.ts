import { describe, expect, test } from "bun:test";
import {
  MAX_ATTACHMENT_BYTES,
  validateDraftFiles,
  validateMessageAttachments,
} from "@/lib/attachments";

describe("attachment validation", () => {
  test("accepts a supported image", () => {
    const file = new File(["image"], "map.png", { type: "image/png" });
    expect(validateDraftFiles([file])).toBeNull();
  });

  test("rejects executable files", () => {
    const file = new File(["binary"], "trip.exe", {
      type: "application/x-msdownload",
    });
    expect(validateDraftFiles([file])).toContain("not a supported file type");
  });

  test("rejects an oversized server-side data URL", () => {
    const encoded = "a".repeat(Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 16);
    expect(() =>
      validateMessageAttachments([
        {
          id: "message-1",
          role: "user",
          parts: [
            {
              type: "file",
              mediaType: "image/png",
              filename: "large.png",
              url: `data:image/png;base64,${encoded}`,
            },
          ],
        },
      ]),
    ).toThrow("larger than 5 MB");
  });
});
