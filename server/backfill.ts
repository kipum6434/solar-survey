import { getWonSurveysWithoutPayment, createPayment } from "./db";

/**
 * Backfill payments for surveys that have installationStatus set (or status 'won')
 * but don't yet have a payment record.
 * This runs once on server startup to catch any surveys that were created
 * before the auto-create payment logic was added.
 */
export async function backfillPayments() {
  try {
    // Get all surveys without payment (status won OR installationStatus set)
    const surveys = await getWonSurveysWithoutPayment({});
    
    if (surveys.length === 0) {
      console.log("[Backfill] No surveys need payment backfill.");
      return;
    }

    console.log(`[Backfill] Found ${surveys.length} surveys without payment records. Creating...`);
    
    let created = 0;
    let failed = 0;

    for (const survey of surveys) {
      try {
        const contractVal = survey.quotedPrice || 0;
        await createPayment({
          surveyId: survey.id,
          customerId: survey.customerId,
          contractValue: contractVal,
          collectedAmount: 0,
          notes: "สร้างอัตโนมัติ (backfill)",
        });
        created++;
      } catch (err) {
        failed++;
        console.error(`[Backfill] Failed to create payment for survey ${survey.id}:`, err);
      }
    }

    console.log(`[Backfill] Done. Created: ${created}, Failed: ${failed}`);
  } catch (err) {
    console.error("[Backfill] Error during backfill:", err);
  }
}
