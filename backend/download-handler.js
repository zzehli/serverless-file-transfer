import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const { BUCKET_NAME } = process.env;
const EXPIRY_DEFAULT = 30 * 60;

const newS3Client = new S3Client();

//handler for download file from S3 based on HTTP address' query parameter that
//specifies file's id
export const handleEvent = async (event, context) => {
    //extract file id from URL use AWS's built in event object
    const id = event.pathParameters.id

    //create a presigned URL for that file
    const key = `shares/${id[0]}/${id[1]}/${id}`
    
    //create the download URL
    const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });

    const downloadUrl = await getSignedUrl(
        newS3Client, getCommand, {
        expiresIn: EXPIRY_DEFAULT
    });

    //return an HTTP response redirect to the presigned URL
    return {
        statusCode: 301,
        headers: {
            Location: downloadUrl
        }
    }
}