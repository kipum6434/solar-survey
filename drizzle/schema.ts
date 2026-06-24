import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 100 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin", "warehouse"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== CUSTOMERS ====================
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  province: varchar("province", { length: 100 }),
  district: varchar("district", { length: 100 }),
  subDistrict: varchar("subDistrict", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  source: varchar("source", { length: 255 }).default("other"),
  electricityBill: text("electricityBill"),
  roofType: varchar("roofType", { length: 100 }),
  roofArea: decimal("roofArea", { precision: 10, scale: 2 }),
  phaseType: mysqlEnum("phaseType", ["single", "three"]),
  meterSize: varchar("meterSize", { length: 50 }),
  fullAddress: text("fullAddress"),
  statusId: int("statusId"),
  facebookName: varchar("facebookName", { length: 255 }),
  notes: text("notes"),
  surveyorId: int("surveyorId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ==================== SURVEYS ====================
export const surveys = mysqlTable("surveys", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "scheduled",
    "in_progress",
    "surveyed",
    "follow_up",
    "quoted",
    "negotiating",
    "won",
    "lost",
    "cancelled",
    "postponed"
  ]).default("pending").notNull(),
  scheduledDate: bigint("scheduledDate", { mode: "number" }),
  scheduledTime: varchar("scheduledTime", { length: 10 }),
  assignedTo: int("assignedTo"),
  adminSenderId: int("adminSenderId"),
  closerId: int("closerId"),
  surveyNotes: text("surveyNotes"),
  systemSize: decimal("systemSize", { precision: 10, scale: 2 }),
  panelCount: int("panelCount"),
  inverterModel: varchar("inverterModel", { length: 255 }),
  estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }),
  quotedPrice: decimal("quotedPrice", { precision: 12, scale: 2 }),
  panelBrand: varchar("panelBrand", { length: 255 }),
  needBattery: varchar("needBattery", { length: 500 }),
  needOptimizer: varchar("needOptimizer", { length: 500 }),
  systemType: mysqlEnum("systemType", ["string", "micro", "both", "hybrid"]),
  statusId: int("statusId"),
  installationDate: bigint("installationDate", { mode: "number" }),
  installationStatus: mysqlEnum("installationStatus", ["waiting", "in_progress", "completed", "delivered", "postponed", "cancelled"]),
  completedAt: bigint("completedAt", { mode: "number" }),
  installationCompletedAt: bigint("installationCompletedAt", { mode: "number" }),
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "submitted", "approved", "rejected"]).default("pending"),
  deliverySubmittedAt: bigint("deliverySubmittedAt", { mode: "number" }),
  deliverySubmittedBy: int("deliverySubmittedBy"),
  deliveryApprovedAt: bigint("deliveryApprovedAt", { mode: "number" }),
  deliveryApprovedBy: int("deliveryApprovedBy"),
  deliveryRejectionReason: text("deliveryRejectionReason"),
  installerTeamId: int("installerTeamId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = typeof surveys.$inferInsert;

// ==================== TEAM MEMBERS ====================
export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["admin_sender", "surveyor", "closer"]).notNull(),
  roles: varchar("roles", { length: 500 }), // JSON array of roles e.g. '["admin_sender","surveyor","closer"]'
  isActive: boolean("isActive").default(true).notNull(),
  linkedUserId: int("linkedUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ==================== SOURCES (Auto-suggest) ====================
export const sources = mysqlTable("sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 100 }),
  usageCount: int("usageCount").default(0).notNull(),
  groupName: varchar("groupName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

// ==================== SOURCE GROUPS ====================
export const sourceGroups = mysqlTable("source_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SourceGroup = typeof sourceGroups.$inferSelect;
export type InsertSourceGroup = typeof sourceGroups.$inferInsert;

// ==================== SURVEY ASSIGNMENTS (Multi-assign) ====================
export const surveyAssignments = mysqlTable("survey_assignments", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin_sender", "surveyor", "closer"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyAssignment = typeof surveyAssignments.$inferSelect;
export type InsertSurveyAssignment = typeof surveyAssignments.$inferInsert;

// ==================== SURVEY PHOTOS ====================
export const surveyPhotos = mysqlTable("survey_photos", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  customerId: int("customerId").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  category: varchar("category", { length: 100 }).default("other"),
  fileSize: int("fileSize"),
  caption: text("caption"),
  sortOrder: int("sortOrder").default(0).notNull(),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyPhoto = typeof surveyPhotos.$inferSelect;
export type InsertSurveyPhoto = typeof surveyPhotos.$inferInsert;

// ==================== SURVEY DOCUMENTS ====================
export const surveyDocuments = mysqlTable("survey_documents", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  customerId: int("customerId").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 100 }).default("other"),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyDocument = typeof surveyDocuments.$inferSelect;
export type InsertSurveyDocument = typeof surveyDocuments.$inferInsert;

// ==================== FOLLOW UPS ====================
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  customerId: int("customerId").notNull(),
  round: int("round").default(1).notNull(),
  dueDate: bigint("dueDate", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "overdue", "cancelled"]).default("pending").notNull(),
  method: mysqlEnum("method", ["phone", "line", "visit", "email", "other"]).default("phone"),
  notes: text("notes"),
  result: text("result"),
  completedAt: bigint("completedAt", { mode: "number" }),
  assignedTo: int("assignedTo"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

// ==================== SHARE LINKS ====================
export const shareLinks = mysqlTable("share_links", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  linkType: varchar("linkType", { length: 32 }).default("installation").notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }),
  isActive: boolean("isActive").default(true).notNull(),
  allowPhotos: boolean("allowPhotos").default(true).notNull(),
  allowDocuments: boolean("allowDocuments").default(true).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;

// ==================== NOTIFICATIONS ====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "follow_up_due",
    "status_changed",
    "new_assignment",
    "new_survey",
    "document_uploaded",
    "general"
  ]).default("general").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedSurveyId: int("relatedSurveyId"),
  relatedCustomerId: int("relatedCustomerId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==================== ACTIVITY LOG ====================
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// ==================== CUSTOM STATUSES ====================
export const customStatuses = mysqlTable("custom_statuses", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["customer", "survey"]).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  color: varchar("color", { length: 50 }).default("#6b7280").notNull(),
  bgColor: varchar("bgColor", { length: 50 }).default("#f3f4f6").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomStatus = typeof customStatuses.$inferSelect;
export type InsertCustomStatus = typeof customStatuses.$inferInsert;
// ==================== PHOTO CATEGORIES ====================
export const photoCategories = mysqlTable("photo_categories", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PhotoCategory = typeof photoCategories.$inferSelect;
export type InsertPhotoCategory = typeof photoCategories.$inferInsert;

// ==================== DOCUMENT CATEGORIES ====================
export const documentCategories = mysqlTable("document_categories", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = typeof documentCategories.$inferInsert;

// ==================== INSTALLER TEAMS ====================
export const installerTeams = mysqlTable("installer_teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  note: text("note"),
  color: varchar("color", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InstallerTeam = typeof installerTeams.$inferSelect;
export type InsertInstallerTeam = typeof installerTeams.$inferInsert;

// ==================== INSTALLATION PHOTO CATEGORIES ====================
export const installationPhotoCategories = mysqlTable("installation_photo_categories", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isRequired: boolean("isRequired").default(false).notNull(),
  isConditional: boolean("isConditional").default(false).notNull(),
  conditionNote: varchar("conditionNote", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InstallationPhotoCategory = typeof installationPhotoCategories.$inferSelect;
export type InsertInstallationPhotoCategory = typeof installationPhotoCategories.$inferInsert;

// ==================== INSTALLATION PHOTOS ====================
export const installationPhotos = mysqlTable("installation_photos", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  category: varchar("category", { length: 100 }).default("other"),
  fileSize: int("fileSize"),
  caption: text("caption"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InstallationPhoto = typeof installationPhotos.$inferSelect;
export type InsertInstallationPhoto = typeof installationPhotos.$inferInsert;

// ==================== DELIVERY COMMENTS ====================
export const deliveryComments = mysqlTable("delivery_comments", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeliveryComment = typeof deliveryComments.$inferSelect;
export type InsertDeliveryComment = typeof deliveryComments.$inferInsert;

// ==================== LINE MESSAGING ====================
export const lineGroups = mysqlTable("line_groups", {
  id: int("id").autoincrement().primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull().unique(),
  groupName: varchar("groupName", { length: 255 }),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});
export type LineGroup = typeof lineGroups.$inferSelect;
export type InsertLineGroup = typeof lineGroups.$inferInsert;

export const lineNotificationTargets = mysqlTable("line_notification_targets", {
  id: int("id").autoincrement().primaryKey(),
  targetType: mysqlEnum("targetType", ["user", "group"]).notNull(),
  targetId: varchar("targetId", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LineNotificationTarget = typeof lineNotificationTargets.$inferSelect;
export type InsertLineNotificationTarget = typeof lineNotificationTargets.$inferInsert;

// ==================== COMPANY SETTINGS ====================
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }),
  phone: varchar("phone", { length: 100 }),
  address: text("address"),
  logoUrl: text("logoUrl"),
  logoFileKey: varchar("logoFileKey", { length: 500 }),
  photoBorderColor: varchar("photoBorderColor", { length: 20 }).default("#d4d4d4"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

// ==================== POSTPONE / CANCEL LOGS ====================
export const postponeCancelLogs = mysqlTable("postpone_cancel_logs", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  action: mysqlEnum("action", ["postpone_survey", "cancel_survey", "postpone_install", "cancel_install"]).notNull(),
  reason: text("reason").notNull(),
  newDate: bigint("newDate", { mode: "number" }),
  previousDate: bigint("previousDate", { mode: "number" }),
  actionBy: varchar("actionBy", { length: 255 }).notNull(),
  actionByRole: mysqlEnum("actionByRole", ["admin", "surveyor", "installer"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PostponeCancelLog = typeof postponeCancelLogs.$inferSelect;
export type InsertPostponeCancelLog = typeof postponeCancelLogs.$inferInsert;


// ==================== DELIVERY FORMS ====================
export const deliveryForms = mysqlTable("delivery_forms", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  customerId: int("customerId").notNull(),
  checklistTemplateId: int("checklistTemplateId"),
  checklistData: text("checklistData"), // JSON: [{label, checked}]
  customerSignatureUrl: text("customerSignatureUrl"),
  customerSignatureKey: varchar("customerSignatureKey", { length: 512 }),
  technicianSignatureUrl: text("technicianSignatureUrl"),
  technicianSignatureKey: varchar("technicianSignatureKey", { length: 512 }),
  technicianName: varchar("technicianName", { length: 255 }),
  notes: text("notes"),
  pdfUrl: text("pdfUrl"),
  pdfFileKey: varchar("pdfFileKey", { length: 512 }),
  status: mysqlEnum("status", ["draft", "signed", "completed"]).notNull().default("draft"),
  signedAt: bigint("signedAt", { mode: "number" }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeliveryForm = typeof deliveryForms.$inferSelect;
export type InsertDeliveryForm = typeof deliveryForms.$inferInsert;

// ==================== DELIVERY CHECKLIST TEMPLATES ====================
export const deliveryChecklistTemplates = mysqlTable("delivery_checklist_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  items: text("items").notNull(), // JSON array of checklist item strings
  isDefault: boolean("isDefault").default(false).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeliveryChecklistTemplate = typeof deliveryChecklistTemplates.$inferSelect;
export type InsertDeliveryChecklistTemplate = typeof deliveryChecklistTemplates.$inferInsert;

// ==================== PAYMENTS ====================
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  customerId: int("customerId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  paymentDate: bigint("paymentDate", { mode: "number" }),
  slipUrl: text("slipUrl"),
  slipFileKey: varchar("slipFileKey", { length: 512 }),
  status: mysqlEnum("status", ["pending", "partial", "paid", "overdue"]).notNull().default("pending"),
  paymentMethod: varchar("paymentMethod", { length: 100 }),
  notes: text("notes"),
  contractValue: decimal("contractValue", { precision: 12, scale: 2 }),
  collectedAmount: decimal("collectedAmount", { precision: 12, scale: 2 }).default("0"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ==================== SURVEY TEMPLATES ====================
export const surveyTemplates = mysqlTable("survey_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  sourceId: int("sourceId"),
  pdfHeaderTitle: varchar("pdfHeaderTitle", { length: 255 }),
  pdfHeaderSubtitle: varchar("pdfHeaderSubtitle", { length: 255 }),
  pdfLogoUrl: text("pdfLogoUrl"),
  pdfLogoFileKey: varchar("pdfLogoFileKey", { length: 512 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SurveyTemplate = typeof surveyTemplates.$inferSelect;
export type InsertSurveyTemplate = typeof surveyTemplates.$inferInsert;

// ==================== SURVEY TEMPLATE FIELDS ====================
export const surveyTemplateFields = mysqlTable("survey_template_fields", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  fieldLabel: varchar("fieldLabel", { length: 255 }).notNull(),
  fieldType: mysqlEnum("fieldType", [
    "text", "number", "textarea", "select", "checkbox",
    "checkbox_group", "radio", "date", "distance", "yes_no", "section_header"
  ]).notNull(),
  fieldOptions: text("fieldOptions"),
  hasOtherOption: boolean("hasOtherOption").default(false).notNull(),
  placeholder: varchar("placeholder", { length: 255 }),
  defaultValue: text("defaultValue"),
  required: boolean("required").default(false).notNull(),
  sectionGroup: varchar("sectionGroup", { length: 100 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SurveyTemplateField = typeof surveyTemplateFields.$inferSelect;
export type InsertSurveyTemplateField = typeof surveyTemplateFields.$inferInsert;

// ==================== SURVEY TEMPLATE DATA (filled values) ====================
export const surveyTemplateData = mysqlTable("survey_template_data", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  templateId: int("templateId").notNull(),
  fieldId: int("fieldId").notNull(),
  value: text("value"),
  otherValue: text("otherValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SurveyTemplateData = typeof surveyTemplateData.$inferSelect;
export type InsertSurveyTemplateData = typeof surveyTemplateData.$inferInsert;

// ==================== PAYMENT COLLECTIONS (งวดเก็บเงิน) ====================
export const paymentCollections = mysqlTable("payment_collections", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("paymentId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  collectedAt: bigint("collectedAt", { mode: "number" }).notNull(),
  slipUrl: text("slipUrl"),
  slipFileKey: varchar("slipFileKey", { length: 512 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PaymentCollection = typeof paymentCollections.$inferSelect;
export type InsertPaymentCollection = typeof paymentCollections.$inferInsert;

// ==================== CUSTOM TECHNICAL FIELDS ====================
export const technicalFieldDefinitions = mysqlTable("technical_field_definitions", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  fieldType: mysqlEnum("fieldType", ["text", "number", "select", "textarea"]).default("text").notNull(),
  placeholder: varchar("placeholder", { length: 255 }),
  options: text("options"), // JSON array for select type e.g. ["string","micro","hybrid"]
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isBuiltIn: boolean("isBuiltIn").default(false).notNull(), // true for original hardcoded fields
  fieldKey: varchar("fieldKey", { length: 100 }), // maps to surveys column for built-in fields
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TechnicalFieldDefinition = typeof technicalFieldDefinitions.$inferSelect;
export type InsertTechnicalFieldDefinition = typeof technicalFieldDefinitions.$inferInsert;

export const surveyTechnicalValues = mysqlTable("survey_technical_values", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  fieldDefinitionId: int("fieldDefinitionId").notNull(),
  value: text("value"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SurveyTechnicalValue = typeof surveyTechnicalValues.$inferSelect;
export type InsertSurveyTechnicalValue = typeof surveyTechnicalValues.$inferInsert;


// ==================== DOCUMENT SETTINGS (ISO Document Numbers) ====================
export const documentSettings = mysqlTable("document_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(), // e.g. "survey_doc_number", "install_doc_number"
  label: varchar("label", { length: 255 }).notNull(), // Thai display label
  documentNumber: varchar("documentNumber", { length: 100 }).notNull(), // e.g. "FM-SA-01-04 REV.00"
  description: text("description"), // optional description
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DocumentSetting = typeof documentSettings.$inferSelect;
export type InsertDocumentSetting = typeof documentSettings.$inferInsert;
