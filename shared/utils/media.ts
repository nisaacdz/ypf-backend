export function generateMediaUrl(
  externalId: string,
  options: { expiration: number; resolution?: number } = {
    expiration: 24 * 60 * 60,
    resolution: 1080,
  },
): string {
  // use sdk to obtain the url from the third party storage
  console.log(options);
  const url = `https://media.example.com/${externalId}?expiration=${options.expiration}&resolution=${options.resolution}`;

  return url;
}

export async function storeMediumFile(file: Express.Multer.File) {
  // Simulate file upload and return metadata
  console.log("Uploading file to storage server...", file.originalname);

  await new Promise((resolve) => setTimeout(resolve, 1000)); // simulate delay

  return {
    externalId: "generated-external-id",
    type: "VIDEO" as const,
    dimensions: {
      width: 1920,
      height: 1080,
    },
    sizeInBytes: file.size,
  };
}

export async function deleteMediumFile(externalId: string) {
  // Simulate file deletion
  console.log("Deleting file from storage server...", externalId);
  return true;
}
