import sharp from "sharp";

export async function generateThumbnail(
  imageBuffer: Buffer,
  width = 300,
  height = 300
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(width, height, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MySpy/1.0" },
  });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
