import * as Minio from 'minio'

export const BUCKET = process.env.MINIO_BUCKET || 'scholarship-docs'

// Internal client — used for upload/download operations within Docker network
export const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

// Public client — used only for generating presigned URLs with public hostname
const publicUrl = process.env.MINIO_PUBLIC_URL  // e.g. http://alb-dns:9000
const publicEndpoint = publicUrl
  ? new URL(publicUrl).hostname
  : (process.env.MINIO_ENDPOINT || 'localhost')
const publicPort = publicUrl
  ? parseInt(new URL(publicUrl).port || '9000')
  : parseInt(process.env.MINIO_PORT || '9000')

export const minioPublicClient = new Minio.Client({
  endPoint:  publicEndpoint,
  port:      publicPort,
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

/** Ensure the bucket exists (call once at startup) */
export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET, process.env.MINIO_REGION || 'ap-south-1')
  }
}
