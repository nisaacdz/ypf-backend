export function getMediaUrl(externalId: string, options: { expiration?: number } = {}): string {
    // use sdk to obtain the url from the third party storage
    const url = `https://media.example.com/${externalId}`;
    
    return url;
}