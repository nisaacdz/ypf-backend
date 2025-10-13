export function generateMediaUrl(
  externalId: string,
  options: { expiration: number; resolution: number } = {
    expiration: 24 * 60 * 60,
    resolution: 1080,
  },
): string {
  // use sdk to obtain the url from the third party storage
  console.log(options);
  const url = `https://media.example.com/${externalId}?expiration=${options.expiration}&resolution=${options.resolution}`;

  return url;
}
