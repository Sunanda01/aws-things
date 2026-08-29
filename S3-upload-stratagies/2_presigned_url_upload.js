/*
* Yes. With a presigned URL, your Express server doesn't receive the file. 
* It only generates a temporary S3 URL, and React uploads directly to S3.
* One thing you need to configure on S3 is CORS so your React app is allowed to PUT to the bucket.
* React ──→ Express
*         │
*         │ generate presigned URL
*         ▼
*       React ─────────→ S3
*                        ↑
*                   actual file
*/
//Forntnend
// 1. get the url
const file = event.target.files[0];
const response = await fetch(`http://localhost:3000/upload-url?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`);
const { uploadUrl, key } = await response.json();

//2. Upload the file 
await fetch(uploadUrl, { 
  method: "PUT",
  headers: { "Content-Type": file.type, },
  body: file,
});

console.log("Uploaded:", key);


//Backend (npm install express @aws-sdk/client-s3 @aws-sdk/s3-request-presigner)
const express = require("express");
const { S3Client, PutObjectCommand, } = require("@aws-sdk/client-s3");
const { getSignedUrl, } = require("@aws-sdk/s3-request-presigner");
const app = express();
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.get("/upload-url", async (req, res) => {
  try {
    const { fileName, fileType } = req.query;

    const key = `uploads/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60, // URL valid for 60 seconds
    });

    res.json({
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to generate URL" });
  }
});

app.listen(3000);

