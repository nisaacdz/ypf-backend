import { BlobServiceClient } from "@azure/storage-blob";
import variables from "../env";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  variables.services.azure.connectionString,
);

export const containerName = "media";

export default blobServiceClient;
