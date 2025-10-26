### Docs
https://developers.facebook.com/docs/messenger-platform/send-messages/
### Install ngrok
npm i -g ngrok

Logging page
http://127.0.0.1:4040/inspect/http

## Register Facebook API.

## Have to register app with live mode (develop mode does not work)
### Use Graph API Explorer to subscribe your page manually

url: https://developers.facebook.com/tools/explorer/

Then follow these steps carefully:

1️⃣ Select your app from the dropdown (top-right corner)
2️⃣ In the access token field → click “Get Token → Get Page Access Token”

Choose the same Page you want to connect

Grant all message permissions (e.g. pages_messaging, pages_manage_metadata, pages_read_engagement, etc.)

3️⃣ In the Request URL field, enter:
POST https://graph.facebook.com/v21.0/me/subscribed_apps

Params:
✅ Correct subscribed_fields for v24+ Messenger Webhooks

Key: subscribed_fields

Use only the supported fields:
messages,message_reactions,message_deliveries,message_reads,messaging_postbacks,messaging_optins,messaging_referrals


4️⃣ Then click “Submit”

If everything is good, you’ll get a response:

{
  "success": true
}


✅ That means your Page is now subscribed to your app’s webhook.


#### Graph API
1. Check user profile (your facebook account)
GET https://graph.facebook.com/v24.0/me/accounts?access_token={USER_ACCESS_TOKEN}

2. Check page profile (your own)
GET https://graph.facebook.com/v24.0/me/accounts?access_token={PAGE_ACCESS_TOKEN}

3. Get list conversations of the page
GET https://graph.facebook.com/v24.0/PAGE_ID/conversations?fields=participants,messages{id,message,from}&access_token=PAGE_ACCESS_TOKEN

4. Get Sender profile (name + avatar + ID). Issue: currently get only for your tester and developer of the app.
PSID = Page Scoped ID = Sender ID
GET https://graph.facebook.com/v24.0/PSID?fields=first_name,last_name,profile_pic&access_token=PAGE_ACCESS_TOKEN

5. Check Page permission
GET https://graph.facebook.com/v24.0/me/permissions?access_token={USER_ACCESS_TOKEN}

6. Get List Page Info from the owner
GET https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,picture{url}&access_token={USER_ACCESS_TOKEN}

7. Get image url and info in message

GET https://graph.facebook.com/v24.0/m_BbfBJmUZaczMuZa7lrYawLYjYiqyfW036aQF0GaXe4s1XXuR-MDF5_qyFNn4udJHyudptlfxMqDNdR7aI5MtzQ/attachments

GET https://graph.facebook.com/v24.0/messageID/attachments


8. Check valid/expired token Page Access token and App facebook 
app_id|app_secret=2051002559051142|1c6d65517120c1875933869e1d0f11a6
GET https://graph.facebook.com/debug_token?input_token={PAGE_ACCESS_TOKEN}&access_token=2051002559051142|1c6d65517120c1875933869e1d0f11a6

or this web
https://developers.facebook.com/tools/debug/accesstoken/?access_token=
9. Page upload image
curl -X POST "https://graph.facebook.com/v24.0/me/message_attachments?access_token=EAAdJYD73NYYBPh5SqPkOi4PIoUuvgkZBQHB8D3Lx6VYFDWjJFWUc1ZAUGSAz29scXmSyhR6LlhXLQXQ1H4aIX0IpZC6EYWBcUXesMVrreTuvZBKBqcmAl8ZC98oOyBJOurfuMvgWCX6fvK6wrvb5hR8ehFy2vo4d3nShAc9CHunCDR61JoiH4GJckSfeIMmuAGiuVu3jXw9y7sXvcY7oINpuo4VUROgjR1IQPvwQHBpZC7ls2SriYUkxTT5PQZD" ^
  -F "message={\"attachment\":{\"type\":\"image\",\"payload\":{\"url\":\"https://marceline-goadlike-pseudoprosperously.ngrok-free.dev/uploads/facebook/653a0b5a-db4e-4104-856d-fa65a5b59112.jpg\",\"is_reusable\":true}}}"

10. Exchange to long-live token
