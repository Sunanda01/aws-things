/*
React
  │
  │ multipart/form-data
  ▼
Express
  │
  │ AWS SDK PutObject / Upload
  ▼
Amazon S3
*/


// Frontend
const formData = new FormData();
formData.append("image", file);

await fetch("http://localhost:3000/upload", {
  method: "POST",
  body: formData,
});

// Backend
const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;

    const key = `uploads/${Date.now()}-${file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    res.json({
      message: "Uploaded successfully",
      key,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
});

app.listen(3000);