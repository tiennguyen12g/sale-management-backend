// services/facebook.service.ts
import axios from "axios";

export async function fetchFacebookProfile(pagenoAuthToken: string, senderId: string) {
  // -- Issue: Currently it can only fetch proflie info from these account that have role in the page
  try {
    const v = process.env.FB_API_VERSION || "v24.0";
    const url = `https://graph.facebook.com/${v}/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pagenoAuthToken}`;
    const resp = await axios.get(url, {
      timeout: 10_000,
    });
    // console.log('fetchFacebookProfile resp', resp.data);
    return resp.data;
    // example:
    //{
    //  "first_name": "Quynh",
    //  "last_name": "Ly",
    //  "profile_pic": "https://platform-lookaside.fbsbx.com/platform/profilepic/?eai=Aavom06FpXDGHExUX8UACdbmxnw-T0jrn15Hj2D04ktMZNZoqntR1PpseztHDcME8yPhlDMxhEMAuw&psid=24720039160957983&width=1024&ext=1763471063&hash=AT-ueSSL0H9ud6VAkfxKwTqC",
    //  "id": "24720039160957983"
    //}

  } catch (err: any) {
    console.warn("fetchFacebookProfile failed", err?.message || err);
    return null;
  }
}

export async function sendFacebookMessage(pageAccessToken: string, recipientId: string, messageObj: any) {
  // messageObj shape depends on API: { text: "..." } or { attachment: { type, payload: { url } } }
  try {
    const v = process.env.FB_API_VERSION || "v24.0";
    const url = `https://graph.facebook.com/${v}/me/messages`;
    const resp = await axios.post(
      url,
      {
        recipient: { id: recipientId },
        message: messageObj,
      },
      { params: { access_token: pageAccessToken }, timeout: 10_000 }
    );
    return resp.data;
  } catch (err: any) {
    console.error("sendFacebookMessage failed", err?.response?.data || err.message || err);
    throw err;
  }
}
