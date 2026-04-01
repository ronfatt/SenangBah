import { customAlphabet } from "nanoid";
import { get, run } from "./db.js";

const randomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);
export const REFERRER_REWARD_STARS = 3;
export const REFERRED_REWARD_STARS = 2;

function buildPrefix(name = "") {
  const cleaned = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length === 2) return `${cleaned}S`;
  if (cleaned.length === 1) return `${cleaned}SB`;
  return "SBH";
}

export async function generateUniqueReferralCode(name = "") {
  const prefix = buildPrefix(name);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${prefix}${randomCode()}`;
    const existing = await get("SELECT id FROM users WHERE referral_code = ?", [candidate]);
    if (!existing) return candidate;
  }

  throw new Error("unable_to_generate_referral_code");
}

export async function ensureUserReferralCode(userId, name = "") {
  const existing = await get("SELECT referral_code, name FROM users WHERE id = ?", [userId]);
  if (!existing) return "";
  if (existing.referral_code) return existing.referral_code;

  const referralCode = await generateUniqueReferralCode(name || existing.name || "");
  await run("UPDATE users SET referral_code = ? WHERE id = ?", [referralCode, userId]);
  return referralCode;
}

export async function grantReferralRewardForCompletedLearner(referredUserId) {
  const referral = await get(
    `SELECT id, referrer_user_id, referred_user_id, reward_status
     FROM student_referrals
     WHERE referred_user_id = ? AND reward_status = 'pending'`,
    [referredUserId]
  );

  if (!referral) return { granted: false, reason: "no_pending_referral" };

  await run("BEGIN");
  try {
    await run(
      "UPDATE users SET bonus_stars = COALESCE(bonus_stars, 0) + ? WHERE id = ?",
      [REFERRER_REWARD_STARS, referral.referrer_user_id]
    );
    await run(
      "UPDATE users SET bonus_stars = COALESCE(bonus_stars, 0) + ? WHERE id = ?",
      [REFERRED_REWARD_STARS, referral.referred_user_id]
    );
    await run(
      "UPDATE student_referrals SET reward_status = ? WHERE id = ?",
      ["granted", referral.id]
    );
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }

  return {
    granted: true,
    referrer_reward_stars: REFERRER_REWARD_STARS,
    referred_reward_stars: REFERRED_REWARD_STARS
  };
}
