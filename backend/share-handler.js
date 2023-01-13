import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Metrics, logMetrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';

const { BUCKET_NAME, BASE_URL } = process.env;
const EXPIRY_DEFAULT = 24 * 60 * 60;

const tracer = new Tracer()
const logger = new Logger()
const metrics = new Metrics()

const newS3Client = new S3Client();

//handler is evaluated every time it is evoked
//interact with S3, generate a upload URL and retrieval URL
async function handler (event, context) {

  //create a identifier (file name)  
  const id = randomUUID();
  const key = `shares/${id[0]}/${id[1]}/${id}`
  // new Date().toISOString().slice(0,10)

  //since lambda functions runs when upload is already completed, it has no access
  //to the original filename, we need to put the filename in the queryParam of the the http
  const filename = event ?.queryStringParameters?.filename;
  const contentDisposition = filename && `attachment; filename="${filename}"`;
  const contentDispositionHeader = contentDisposition && `content-disposition: ${contentDisposition}`;

    //logging keys 
  logger.info('Create file sharing', {id, key, filename, contentDispositionHeader});
  metrics.addMetric(`createShare`, MetricUnits.Count, 1)

  const downloadUrl = `${BASE_URL}/share/${id}`;

  //create the upload URL
  //with filename in the contentDisposition https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentDisposition: contentDisposition
  })

  const signableHeaders = new Set()
  if (contentDisposition) {
    signableHeaders.add(contentDispositionHeader)
  }

  //S3 presigned URLs
  //https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
  const uploadUrl = await getSignedUrl(
    newS3Client, putCommand, {
    expiresIn: EXPIRY_DEFAULT,
    signableHeaders
  }
  )

  return {
    statusCode: 201,
    body:
`Upload with: curl -X PUT -T ${filename || `<FILENAME>`} ${contentDispositionHeader ? `-H '${contentDispositionHeader}'`: ''} '${uploadUrl}'
Download with: curl ${downloadUrl} --output '${filename}'
`
  }
}

//middy wraps around the lambda handler so one can use middlewares
export const handleEvent = middy(handler)
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(logMetrics(metrics))
  .use(captureLambdaHandler(tracer))