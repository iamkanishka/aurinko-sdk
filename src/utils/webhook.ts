/**
 * Webhook Signature Verification
 */

import { createHmac, timingSafeEqual } from "crypto";
import { WebhookVerificationError } from "../errors";
import type { WebhookVerificationRequest } from "../types/index";

/**
 * Verifies the authenticity of a webhook notification from Aurinko
 * using HMAC-SHA256 signature verification.
 *
 * @throws WebhookVerificationError if the signature is invalid or timestamp is stale
 *
 * @example
 * import { verifyWebhookSignature } from 'aurinko-sdk';
 *
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     verifyWebhookSignature(
 *       {
 *         rawBody: req.body.toString(),
 *         signature: req.headers['x-aurinko-signature'] as string,
 *         timestamp: req.headers['x-aurinko-timestamp'] as string,
 *       },
 *       process.env.AURINKO_WEBHOOK_SECRET!
 *     );
 *     res.status(200).send('OK');
 *   } catch (e) {
 *     res.status(401).send('Unauthorized');
 *   }
 * });
 */
export function verifyWebhookSignature(
  request: WebhookVerificationRequest,
  signingSecret: string,
  /** Max allowed age of the webhook in seconds. Default: 300 (5 minutes) */
  maxAgeSeconds = 300
): void {
  const { rawBody, signature, timestamp } = request;

  if (!signingSecret) {
    throw new WebhookVerificationError("Webhook signing secret is not configured.");
  }

  if (!signature) {
    throw new WebhookVerificationError("Missing X-Aurinko-Signature header.");
  }

  if (!timestamp) {
    throw new WebhookVerificationError("Missing X-Aurinko-Timestamp header.");
  }

  // Check timestamp freshness to prevent replay attacks
  const tsSeconds = parseInt(timestamp, 10);
  if (isNaN(tsSeconds)) {
    throw new WebhookVerificationError("Invalid X-Aurinko-Timestamp header.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > maxAgeSeconds) {
    throw new WebhookVerificationError(
      `Webhook timestamp is stale (age: ${Math.abs(nowSeconds - tsSeconds)}s, max: ${maxAgeSeconds}s). Possible replay attack.`
    );
  }

  // Build the signed payload: timestamp + "." + body
  const signedPayload = `${timestamp}.${rawBody}`;

  // Compute expected signature
  const expected = createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("hex");

  // Compare using timing-safe equal to prevent timing attacks
  const expectedBuffer = Buffer.from(expected, "utf-8");
  const actualBuffer = Buffer.from(signature, "utf-8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new WebhookVerificationError("Webhook signature verification failed.");
  }
}

/**
 * Safe version of verifyWebhookSignature that returns a boolean
 * instead of throwing.
 */
export function isValidWebhookSignature(
  request: WebhookVerificationRequest,
  signingSecret: string,
  maxAgeSeconds = 300
): boolean {
  try {
    verifyWebhookSignature(request, signingSecret, maxAgeSeconds);
    return true;
  } catch {
    return false;
  }
}
