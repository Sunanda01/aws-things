/*
* For a YouTube-like application with 5–10 GB videos, 
* you'd typically use presigned URLs, but more specifically S3 Multipart Upload with presigned URLs.
*                     
* 1. Request upload
* React ──────────────────────────────→ Express* 
                                        │
                                        │ Create Multipart Upload
                                        ▼
                                       S3
                                        │
                                        │ return uploadId
                                        ▼
* React ←────────────────────────────── Express


* 2. Upload chunks directly

* React ───── Part 1 ──────────────────→ S3
* React ───── Part 2 ──────────────────→ S3
* React ───── Part 3 ──────────────────→ S3
* React ───── Part 4 ──────────────────→ S3
*                  ...
* React ───── Part N ──────────────────→ S3


* 3. Complete upload

* React ──────────────────────────────→ Express
*                                         │
*                                         ▼
*                                    Complete S3
*                                    Multipart Upload
*/

// Frotnend Code
import React, { useState } from "react";
const API_URL = "http://localhost:3000";
const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB

export default function VideoUpload() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert("Select a video first");
      return;
    }

    setUploading(true);

    try {
      // --------------------------------
      // STEP 1: INITIATE MULTIPART UPLOAD
      // --------------------------------

      const initResponse = await fetch(`${API_URL}/upload/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      const {
        uploadId,
        key,
      } = await initResponse.json();


      // --------------------------------
      // STEP 2: CALCULATE PARTS
      // --------------------------------

      const totalParts = Math.ceil(
        file.size / CHUNK_SIZE
      );

      const parts = [];


      // --------------------------------
      // STEP 3: UPLOAD EACH PART
      // --------------------------------

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {

        const start =
          (partNumber - 1) * CHUNK_SIZE;

        const end =
          Math.min(start + CHUNK_SIZE, file.size);

        const chunk =
          file.slice(start, end);


        // Get presigned URL

        const urlResponse = await fetch(
          `${API_URL}/upload/presigned-url`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              uploadId,
              key,
              partNumber,
            }),
          }
        );

        const { url } =
          await urlResponse.json();


        // Upload directly to S3

        const uploadResponse = await fetch(
          url,
          {
            method: "PUT",
            body: chunk,
          }
        );


        if (!uploadResponse.ok) {
          throw new Error(
            `Part ${partNumber} failed`
          );
        }


        // Get ETag

        const etag =
          uploadResponse.headers.get("ETag");


        parts.push({
          PartNumber: partNumber,
          ETag: etag,
        });


        // Progress

        const percentage =
          (partNumber / totalParts) * 100;

        setProgress(
          Math.round(percentage)
        );
      }


      // --------------------------------
      // STEP 4: COMPLETE UPLOAD
      // --------------------------------

      const completeResponse =
        await fetch(
          `${API_URL}/upload/complete`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              uploadId,
              key,
              parts,
            }),
          }
        );


      const result =
        await completeResponse.json();

      console.log(
        "Upload completed:",
        result
      );

      alert("Video uploaded successfully!");

    } catch (error) {

      console.error(error);

      alert("Upload failed");

    } finally {

      setUploading(false);
    }
  };


  return (
    <div>

      <input
        type="file"
        accept="video/*"
        onChange={(e) =>
          setFile(e.target.files[0])
        }
      />

      <button
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading
          ? `Uploading ${progress}%`
          : "Upload Video"}
      </button>

      {uploading && (
        <div>
          Progress: {progress}%
        </div>
      )}

    </div>
  );
}

















//Backend Code
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  UploadPartCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();

app.use(cors());
app.use(express.json());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


// 1. INITIATE MULTIPART UPLOAD
app.post("/upload/init", async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    const key = `videos/${Date.now()}-${fileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const result = await s3.send(command);

    res.json({
      uploadId: result.UploadId,
      key,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to initialize upload",
    });
  }
});


// 2. GENERATE PRESIGNED URL FOR A PART
app.post("/upload/presigned-url", async (req, res) => {
  try {
    const {
      uploadId,
      key,
      partNumber,
    } = req.body;

    const command = new UploadPartCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    res.json({
      url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to generate presigned URL",
    });
  }
});


// 3. COMPLETE MULTIPART UPLOAD
app.post("/upload/complete", async (req, res) => {
  try {
    const {
      uploadId,
      key,
      parts,
    } = req.body;

    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,

      MultipartUpload: {
        Parts: parts,
      },
    });

    const result = await s3.send(command);

    res.json({
      message: "Upload completed",
      location: result.Location,
      key,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to complete upload",
    });
  }
});


// 4. ABORT UPLOAD
app.post("/upload/abort", async (req, res) => {
  try {
    const {
      uploadId,
      key,
    } = req.body;

    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    });

    await s3.send(command);

    res.json({
      message: "Upload aborted",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to abort upload",
    });
  }
});


app.listen(3000, () => {
  console.log("Server running on port 3000");
});