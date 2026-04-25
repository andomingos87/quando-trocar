import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string;
}) {
  if (!input.signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const received = input.signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", input.appSecret).update(input.rawBody).digest("hex");

  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
