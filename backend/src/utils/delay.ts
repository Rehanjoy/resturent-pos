/**
 * Resolves after `ms` milliseconds — used to pace batched external-API
 * calls (`marketing-campaign.service.ts`'s campaign send loop) so this app
 * never fires hundreds of requests at Meta's Graph API instantly. See that
 * file's doc comment for the batch size/delay values chosen and why.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
