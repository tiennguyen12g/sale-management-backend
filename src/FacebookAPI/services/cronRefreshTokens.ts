import cron from "node-cron";
import { PageInfo } from "../../models/PageInfo.js";
import { refreshFacebookToken } from "./facebookToken.js";

/**
 * Schedule cron job to check every day at 2:00 AM
 * You can adjust schedule later
 */
export function startTokenRefreshCron() {
  cron.schedule("0 2 * * *", async () => {
    console.log("🕑 Running Facebook token refresh check...");

    try {
      const appId = process.env.FB_APP_ID!;
      const appSecret = process.env.FB_APP_SECRET!;

      // Fetch all FB pages
      const pages = await PageInfo.find({ platform: "facebook" });

      for (const page of pages) {
        const expiresAt = new Date(page.refeshTokenAt).getTime() + 60 * 24 * 60 * 60 * 1000; // 60 days from last update
        const remaining = expiresAt - Date.now();
        const remainingDays = remaining / (1000 * 60 * 60 * 24);

        if (remainingDays <= 3) {
          console.log(`🔄 Refreshing token for page ${page.pageName} (${page.pageId}) ...`);

          try {
            const data = await refreshFacebookToken(page.pageAccessToken, appId, appSecret);
            const newToken = data.access_token;

            page.pageAccessToken = newToken;
            page.refeshTokenAt = Date.now().toString();
            await page.save();

            console.log(`✅ Token refreshed for ${page.pageName}`);
          } catch (error) {
            console.error(`❌ Failed to refresh token for ${page.pageName}:`, error);
          }
        }
      }

      console.log("✅ Token refresh job completed");
    } catch (err) {
      console.error("❌ Cron error:", err);
    }
  });
}
