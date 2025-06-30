export const formatMediaFlowUrl = (mp4Url: string, mfpUrl: string, mfpPassword: string): string => {
  const encodedUrl = encodeURIComponent(mp4Url);
  const filename = extractFilename(mp4Url);
  
  return `${mfpUrl}/proxy/stream/${filename}?d=${encodedUrl}&api_password=${mfpPassword}`;
};

const extractFilename = (url: string): string => {
  const match = url.match(/filename=([^&]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  
  const urlPath = new URL(url).pathname;
  return urlPath.split('/').pop() || 'video.mp4';
};
