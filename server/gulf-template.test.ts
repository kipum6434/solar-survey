import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-owner",
    email: "owner@example.com",
    name: "Test Owner",
    avatarUrl: null,
    role: "admin",
    createdAt: new Date(),
  };
  return {
    user,
    req: {} as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Gulf Template CRUD", () => {
  const caller = appRouter.createCaller(createAdminContext());

  let templateId: number;
  let fieldId1: number;
  let fieldId2: number;
  let fieldId3: number;

  it("should create a survey template", async () => {
    const result = await caller.surveyTemplate.create({
      name: "Gulf SSR Test",
      sourceId: null,
      pdfHeaderTitle: "ปันอาทิตย์ by GULF",
      pdfHeaderSubtitle: "Site Survey Report",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    templateId = result.id;
  });

  it("should list templates", async () => {
    const list = await caller.surveyTemplate.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    const found = list.find((t: any) => t.id === templateId);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Gulf SSR Test");
  });

  it("should get template by ID with fields", async () => {
    const result = await caller.surveyTemplate.getById({ id: templateId });
    expect(result).toBeDefined();
    expect(result!.name).toBe("Gulf SSR Test");
    expect(result!.pdfHeaderTitle).toBe("ปันอาทิตย์ by GULF");
    expect(result!.fields).toBeDefined();
    expect(Array.isArray(result!.fields)).toBe(true);
  });

  it("should add a checkbox field to the template", async () => {
    const result = await caller.surveyTemplate.addField({
      templateId,
      fieldName: "installation_capacity",
      fieldLabel: "Installation Capacity",
      fieldType: "checkbox_group",
      fieldOptions: JSON.stringify(["3 kW 1P", "5 kW 1P", "5 kW 3P", "10 kW 1P", "10 kW 3P"]),
      hasOtherOption: true,
      required: true,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    fieldId1 = result.id;
  });

  it("should add a text field", async () => {
    const result = await caller.surveyTemplate.addField({
      templateId,
      fieldName: "battery",
      fieldLabel: "Battery",
      fieldType: "text",
      required: false,
    });
    expect(result).toBeDefined();
    fieldId2 = result.id;
  });

  it("should add a select field", async () => {
    const result = await caller.surveyTemplate.addField({
      templateId,
      fieldName: "price_type",
      fieldLabel: "Price Type",
      fieldType: "select",
      fieldOptions: JSON.stringify(["Standard", "Additional"]),
      required: false,
    });
    expect(result).toBeDefined();
    fieldId3 = result.id;
  });

  it("should get template with 3 fields", async () => {
    const result = await caller.surveyTemplate.getById({ id: templateId });
    expect(result).toBeDefined();
    expect(result!.fields.length).toBe(3);
  });

  it("should update a field", async () => {
    await caller.surveyTemplate.updateField({
      id: fieldId1,
      fieldLabel: "Installation Capacity (kW)",
      fieldOptions: JSON.stringify(["3 kW 1P", "5 kW 1P", "5 kW 3P", "10 kW 1P", "10 kW 3P", "อื่นๆ"]),
    });

    const updated = await caller.surveyTemplate.getById({ id: templateId });
    const updatedField = updated!.fields.find((f: any) => f.id === fieldId1);
    expect(updatedField!.fieldLabel).toBe("Installation Capacity (kW)");
  });

  it("should update the template", async () => {
    await caller.surveyTemplate.update({
      id: templateId,
      name: "Gulf SSR Updated",
      pdfHeaderTitle: "ปันอาทิตย์ by GULF1",
      pdfHeaderSubtitle: "Site Survey Report v2",
    });

    const result = await caller.surveyTemplate.getById({ id: templateId });
    expect(result!.name).toBe("Gulf SSR Updated");
    expect(result!.pdfHeaderTitle).toBe("ปันอาทิตย์ by GULF1");
  });

  it("should reorder fields", async () => {
    // Reverse the order: fieldId3, fieldId2, fieldId1
    await caller.surveyTemplate.reorderFields({
      templateId,
      fieldIds: [fieldId3, fieldId2, fieldId1],
    });

    const updated = await caller.surveyTemplate.getById({ id: templateId });
    // After reorder, first field should be Price Type (fieldId3)
    expect(updated!.fields[0].id).toBe(fieldId3);
    expect(updated!.fields[2].id).toBe(fieldId1);
  });

  it("should delete a field", async () => {
    await caller.surveyTemplate.deleteField({ id: fieldId2 });

    const updated = await caller.surveyTemplate.getById({ id: templateId });
    expect(updated!.fields.length).toBe(2);
    expect(updated!.fields.find((f: any) => f.id === fieldId2)).toBeUndefined();
  });

  it("should delete the template", async () => {
    await caller.surveyTemplate.delete({ id: templateId });

    const list = await caller.surveyTemplate.list();
    const found = list.find((t: any) => t.id === templateId);
    expect(found).toBeUndefined();
  });
});

describe("Gulf Template Data (save/load)", () => {
  const caller = appRouter.createCaller(createAdminContext());
  let templateId: number;
  let fieldId1: number;
  let fieldId2: number;

  it("should create template and fields for data test", async () => {
    const template = await caller.surveyTemplate.create({
      name: "Gulf Data Test",
      sourceId: null,
      pdfHeaderTitle: "Test",
      pdfHeaderSubtitle: "Test",
    });
    templateId = template.id;

    const f1 = await caller.surveyTemplate.addField({
      templateId,
      fieldName: "capacity",
      fieldLabel: "Capacity",
      fieldType: "checkbox_group",
      fieldOptions: JSON.stringify(["3kW", "5kW", "10kW"]),
      required: false,
    });
    fieldId1 = f1.id;

    const f2 = await caller.surveyTemplate.addField({
      templateId,
      fieldName: "notes",
      fieldLabel: "Notes",
      fieldType: "text",
      required: false,
    });
    fieldId2 = f2.id;
  });

  it("should save template data for a survey", async () => {
    const result = await caller.surveyTemplate.saveData({
      surveyId: 1,
      templateId,
      entries: [
        { fieldId: fieldId1, value: JSON.stringify(["5kW", "__other__"]), otherValue: "7kW custom" },
        { fieldId: fieldId2, value: "Test notes here", otherValue: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should load template data for a survey", async () => {
    const data = await caller.surveyTemplate.getData({ surveyId: 1 });
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);

    const d1 = data.find((d: any) => d.fieldId === fieldId1);
    expect(d1).toBeDefined();
    expect(JSON.parse(d1!.value!)).toEqual(["5kW", "__other__"]);
    expect(d1!.otherValue).toBe("7kW custom");

    const d2 = data.find((d: any) => d.fieldId === fieldId2);
    expect(d2).toBeDefined();
    expect(d2!.value).toBe("Test notes here");
  });

  it("should update template data (overwrite)", async () => {
    await caller.surveyTemplate.saveData({
      surveyId: 1,
      templateId,
      entries: [
        { fieldId: fieldId1, value: JSON.stringify(["10kW"]), otherValue: null },
        { fieldId: fieldId2, value: "Updated notes", otherValue: null },
      ],
    });

    const data = await caller.surveyTemplate.getData({ surveyId: 1 });
    const d1 = data.find((d: any) => d.fieldId === fieldId1);
    expect(JSON.parse(d1!.value!)).toEqual(["10kW"]);
    expect(d1!.otherValue).toBeNull();
  });

  it("should clean up test template", async () => {
    await caller.surveyTemplate.delete({ id: templateId });
  });
});

describe("Photo Caption", () => {
  const caller = appRouter.createCaller(createAdminContext());

  it("should have updateCaption mutation available", () => {
    expect(caller.photo.updateCaption).toBeDefined();
    expect(typeof caller.photo.updateCaption).toBe("function");
  });
});
