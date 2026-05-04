import * as Minio from 'minio'

export const BUCKET = process.env.MINIO_BUCKET || 'scholarship-docs'

<<<<<<< HEAD
=======
// Internal client — used for upload/download operations within Docker network
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
export const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

<<<<<<< HEAD
/** Ensure the bucket exists (call once at startup) */
=======
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

>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET, process.env.MINIO_REGION || 'ap-south-1')
  }
}
