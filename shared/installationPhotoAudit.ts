export function buildPublicInstallationPhotoDeletionDetails(input: {
  surveyId: number;
  shareLinkId: number;
  photoId: number;
  fileKey: string;
  fileName: string | null;
}): string {
  const fileLabel = input.fileName ?? input.fileKey.split("/").pop() ?? "unknown-file";
  return `ลบรูปติดตั้งผ่านลิงก์สาธารณะ | surveyId=${input.surveyId} | shareLinkId=${input.shareLinkId} | photoId=${input.photoId} | file=${fileLabel} | fileKey=${input.fileKey}`;
}
