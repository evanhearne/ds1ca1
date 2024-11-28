import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM, and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });

export const handler: SQSHandler = async (event) => {
    for (const record of event.Records) {
        try {
        const recordBody = JSON.parse(record.body);        // Parse SQS message
            const srcKey = decodeURIComponent(recordBody.srcKey);
  
            // Prepare email details
            const { name, email, message }: ContactDetails = {
              name: "ERROR - The Photo Album",
              email: SES_EMAIL_FROM,
              message: `The image ${srcKey} is not of type JPEG nor PNG and therefore cannot be processed. Please try again with a different file.`,
            };
  
            const params = sendEmailParams({ name, email, message });
  
            // Send email using SES
            await client.send(new SendEmailCommand(params));
          } catch (error) {
        console.error("Error processing SNS message: ", error);
      }
    }
  };
  
  function sendEmailParams({ name, email, message }: ContactDetails) {
    const parameters: SendEmailCommandInput = {
      Destination: {
        ToAddresses: [SES_EMAIL_TO],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: getHtmlContent({ name, email, message }),
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: `Error with New Image Upload`,
        },
      },
      Source: SES_EMAIL_FROM,
    };
    return parameters;
  }
  
  function getHtmlContent({ name, email, message }: ContactDetails) {
    return `
      <html>
        <body>
          <h2>Sent from: </h2>
          <ul>
            <li style="font-size:18px">👤 <b>${name}</b></li>
            <li style="font-size:18px">✉️ <b>${email}</b></li>
          </ul>
          <p style="font-size:18px">${message}</p>
        </body>
      </html> 
    `;
  }
  
  // For demo purposes - not used here.
  function getTextContent({ name, email, message }: ContactDetails) {
    return `
      Received an Email. 📬
      Sent from:
          👤 ${name}
          ✉️ ${email}
      ${message}
    `;
  }