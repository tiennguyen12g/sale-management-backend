import axios from "axios";
import dotenv from "dotenv";
/**
 * Refresh a long-lived user access token.
 * @param oldToken - Current long-lived token
 * @param appId - Your Facebook App ID
 * @param appSecret - Your Facebook App Secret
 */
dotenv.config({ path: "./src/.env" });

export async function refreshFacebookToken(oldToken: string, appId: string, appSecret: string) {
  const facebookVersion = process.env.FB_API_VERSION || "v24.0";
  try {
    const url = `https://graph.facebook.com/${facebookVersion}/oauth/access_token`;
    const params = {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: oldToken,
    };

    const { data } = await axios.get(url, { params });
    /**
     * Example response:
     * {
     *   access_token: 'EAAG...',
     *   token_type: 'bearer',
     *   expires_in: 5183944
     * }
     */
    return data;
  } catch (err: any) {
    console.error("❌ Error refreshing token:", err.response?.data || err.message);
    throw err;
  }
}
export async function checkTokenInfo(token: string, appId: string, appSecret: string) {
  try {
    const url = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;

    const { data } = await axios.get(url);
    return data.data;
  } catch (error) {
    console.log("error", error);
  }
}

const appID = process.env.FB_APP_ID;
const appSecret = process.env.FB_APP_SECRET;
// (async () => {
//   console.log("app", appID);
//   if (!appID || !appSecret) return console.log("no access token");
//   const info = await checkTokenInfo(
//     "EAAdJYD73NYYBPqH8vEJqEgdB1ZCdM7IrYXddm38kGxSZB6QVsMjAGBqzFI7LhuhMGu7iwn6ZCtxRZAzHkBQeFgFWxGfzeCvSZCPUcxlrck0CTRCm3bD2A0MwBup7l2zo4HH9XOfq1P7kqLcbfuJqGlVHsjytXzCXIHgBC3zpZBFCUGKnitHzZAZBaZC9uLjMAAwKq0gBbTZAew5sJEJLBu1cfVU4EXUH0wUyLfllEZBJp9qUEbcjOoUR1abrOeU",
//     appID,
//     appSecret
//   );
//   console.log("Token info:", info);
//   console.log("Expires at:", new Date(info.expires_at * 1000).toISOString());
// })();
