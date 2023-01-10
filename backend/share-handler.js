import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto';

const { BUCKET_NAME, BASE_URL } = process.env;
const EXPIRY_DEFAULT = 24 * 60 * 60;

const newS3Client = new S3Client();

//handler is evaluated every time it is evoked
//interact with S3, generate a upload URL and retrieval URL
export const handleEvent = async (event, context) => {

  //create a identifier (file name)  
  const id = randomUUID();
  const key = `shares/${id[0]}/$id{id[1]}/${id}`
  // new Date().toISOString().slice(0,10)

  const downloadUrl = `${BASE_URL}/share/${id}`;

  //create the upload URL
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  })

  //S3 presigned URLs
  //https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
  const uploadUrl = await getSignedUrl(
    newS3Client, putCommand, {
    expiresIn: EXPIRY_DEFAULT
  }
  )

  return {
    statusCode: 201,
    body:
      `Upload with: curl -X PUT -T <filename> ${uploadUrl}
      Download with: curl ${downloadUrl}
      `
  }
}