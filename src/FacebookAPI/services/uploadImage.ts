import FormData from "form-data";
import fs from "fs";
import axios from "axios";

export async function uploadImageToFacebook(pageAccessToken: string, localFilePath: string) {
  const formData = new FormData();
  formData.append(
    "message",
    JSON.stringify({
      attachment: { type: "image", payload: { is_reusable: true } },
    })
  );
  formData.append("filedata", fs.createReadStream(localFilePath));

  const url = `https://graph.facebook.com/v24.0/me/message_attachments`;
  const res = await axios.post(url, formData, {
    params: { access_token: pageAccessToken },
    headers: formData.getHeaders(),
  });

  return res.data.attachment_id; // ✅ e.g., "1745504518999123"
}
