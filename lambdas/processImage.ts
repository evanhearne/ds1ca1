/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput
} from '@aws-sdk/client-sqs'

import {PutItemCommand, PutItemCommandInput, DynamoDBClient} from '@aws-sdk/client-dynamodb'

const s3 = new S3Client();
const sqs = new SQSClient();
const dynamodbClient = new DynamoDBClient();

// Replace with your actual DLQ URL
const DLQ_URL = process.env.DLQ_URL; 

const IMAGE_TABLE_NAME = process.env.IMAGE_TABLE_NAME

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        let origimage = null;
        try {
          // Download the image from the S3 source bucket.
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          origimage = await s3.send(new GetObjectCommand(params));
          // Process the image ......
          // if srcKey i.e. filename does not contain .jpeg or .png 
          if (!srcKey.endsWith('.jpeg') && !srcKey.endsWith('.png')) {
            // pass message to dlq
            console.log(`Unsupported file type: ${srcKey}`);

            // Send a message to the DLQ
            const dlqMessageParams: SendMessageCommandInput = {
              QueueUrl: DLQ_URL, // Dead Letter Queue URL
              MessageBody: JSON.stringify({
                error: "Unsupported file type",
                srcBucket,
                srcKey,
              }),
            };
            await sqs.send(new SendMessageCommand(dlqMessageParams));
            console.log(`Message sent to DLQ for file: ${srcKey}`);
          } else {
            // Add image file to ImageTable in DynamoDB as entry
            const imageTableRequestParams: PutItemCommandInput = {
              TableName: IMAGE_TABLE_NAME,
              Item: {
                ImageName: { S : srcKey }
              }
            }
            await dynamodbClient.send(new PutItemCommand(imageTableRequestParams))
            console.log(`File ${srcKey} has been added to ${IMAGE_TABLE_NAME}`)
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};