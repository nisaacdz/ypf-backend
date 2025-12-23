import { BlobServiceClient } from "@azure/storage-blob";
import variables from "../env";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  variables.services.azure.connectionString,
);

export const containerNames = {
  media: "media",
  docs: "docs",
};

export default blobServiceClient;
