import type { UIMessage } from "ai";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;

export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/pdf",
] as const;

export function validateDraftFiles(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) {
    return `Attach up to ${MAX_ATTACHMENTS} files at a time.`;
  }

  for (const file of files) {
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type as never)) {
      return `${file.name} is not a supported file type.`;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return `${file.name} is larger than 5 MB.`;
    }
  }

  return null;
}

export function validateMessageAttachments(messages: unknown[]) {
  let attachmentCount = 0;

  for (const message of messages as UIMessage[]) {
    if (!Array.isArray(message.parts)) continue;

    for (const part of message.parts) {
      if (part.type !== "file") continue;
      attachmentCount += 1;

      if (attachmentCount > 24) {
        throw new Error("The conversation contains too many attachments.");
      }

      if (!ACCEPTED_ATTACHMENT_TYPES.includes(part.mediaType as never)) {
        throw new Error("The conversation contains an unsupported attachment.");
      }

      if (!part.url.startsWith(`data:${part.mediaType};base64,`)) {
        throw new Error("An attachment has an invalid data URL.");
      }

      const encoded = part.url.split(",", 2)[1] ?? "";
      const approximateBytes = Math.ceil((encoded.length * 3) / 4);
      if (approximateBytes > MAX_ATTACHMENT_BYTES) {
        throw new Error("An attachment is larger than 5 MB.");
      }
    }
  }
}
