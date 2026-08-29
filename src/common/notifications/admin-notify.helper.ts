import * as nodemailer from "nodemailer";

// Falls back to a real address so this works out of the box in dev, but
// ADMIN_NOTIFICATION_EMAIL in .env is the actual config knob — set it
// there rather than editing this file if the reviewing inbox changes.
const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || "banelengubane107@gmail.com";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

// The admin page itself handles "not logged in" by showing a login form
// rather than a dead end, so a link into it works whether or not the
// clicker has a session yet.
const ADMIN_PAGE_URL = `${FRONTEND_URL}/admin/listings`;

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

export type ReviewableListingType = "room" | "business" | "gig";

interface NotifyListingNeedsReviewParams {
  listingType: ReviewableListingType;
  listingId: number;
  listingName: string;
  reason: string;
}

// Fire-and-forget by design (see callsites: always `.catch(() => {})`'d) —
// a flaky SMTP send should never be the reason a listing fails to save or
// a report fails to submit. Worst case the admin just checks the panel
// directly instead of getting pinged.
export async function notifyAdminListingNeedsReview({
  listingType,
  listingId,
  listingName,
  reason,
}: NotifyListingNeedsReviewParams) {
  // No public deep-link to a single listing exists yet — the admin panel
  // is a flat pending-review queue, not per-listing routes — so this
  // points at the filtered queue rather than the specific row. Good
  // enough to get someone there in one click; worth a real deep link if
  // review volume ever grows past "just open the queue."
  const reviewUrl = `${ADMIN_PAGE_URL}?tab=listings`;

  await getTransporter().sendMail({
    from: `"SouthSpot" <${process.env.EMAIL_USERNAME}>`,
    to: ADMIN_EMAIL,
    subject: `Review needed: ${listingName}`,
    html: `
      <h2>A listing needs review</h2>
      <p><strong>${listingName}</strong> (${listingType} #${listingId}) was just flagged for review.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><a href="${reviewUrl}">Open the review queue</a> to approve it back to active or suspend it.</p>
    `,
  });
}

interface NotifyReviewNeedsApprovalParams {
  roomId: number;
  roomName: string;
  reviewerName: string;
  rating: number;
  comment: string;
}

export async function notifyAdminReviewNeedsApproval({
  roomId,
  roomName,
  reviewerName,
  rating,
  comment,
}: NotifyReviewNeedsApprovalParams) {
  const reviewUrl = `${ADMIN_PAGE_URL}?tab=reviews`;

  await getTransporter().sendMail({
    from: `"SouthSpot" <${process.env.EMAIL_USERNAME}>`,
    to: ADMIN_EMAIL,
    subject: `New review awaiting approval: ${roomName}`,
    html: `
      <h2>A new review needs approval</h2>
      <p><strong>${reviewerName}</strong> left a ${rating}/5 review on <strong>${roomName}</strong> (room #${roomId}):</p>
      <blockquote style="margin:0;padding:10px 16px;border-left:3px solid #7c3aed;color:#374151;">${comment}</blockquote>
      <p style="margin-top:16px;"><a href="${reviewUrl}">Open the review queue</a> to approve or reject it.</p>
    `,
  });
}
