import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: "eu-central-003",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
});

const BUCKET = process.env.B2_BUCKET_NAME || "myspy-media";

export async function uploadToB2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  return `https://${BUCKET}.${process.env.B2_ENDPOINT}/${key}`;
}

export async function downloadFromB2(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  const stream = res.Body;
  if (!stream) throw new Error("Empty response from B2");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromB2(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export function buildKey(folder: string, filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${folder}/${year}/${month}/${filename}`;
}
