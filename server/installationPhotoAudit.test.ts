import { describe, expect, it } from "vitest";
import { buildPublicInstallationPhotoDeletionDetails } from "../shared/installationPhotoAudit";

describe("installation photo audit details", () => {
  it("records enough context for public deletion without recording the share token", () => {
    const details = buildPublicInstallationPhotoDeletionDetails({
      surveyId: 2100003,
      shareLinkId: 44,
      photoId: 123,
      fileKey: "installations/2100003/photos/example_abc.jpg",
      fileName: "roof.jpg",
    });

    expect(details).toContain("surveyId=2100003");
    expect(details).toContain("shareLinkId=44");
    expect(details).toContain("photoId=123");
    expect(details).toContain("file=roof.jpg");
    expect(details).not.toContain("token");
  });
});
