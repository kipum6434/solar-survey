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
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
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
  electricityBill: decimal("electricityBill", { precision: 10, scale: 2 }),
  roofType: varchar("roofType", { length: 100 }),
  roofArea: decimal("roofArea", { precision: 10, scale: 2 }),
  phaseType: mysqlEnum("phaseType", ["single", "three"]),
  meterSize: varchar("meterSize", { length: 50 }),
  fullAddress: text("fullAddress"),
  statusId: int("statusId"),
  notes: text("notes"),
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
    "quoted",
    "negotiating",
    "won",
    "lost",
    "cancelled"
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
  systemType: mysqlEnum("systemType", ["string", "micro", "both"]),
  statusId: int("statusId"),
  installationDate: bigint("installationDate", { mode: "number" }),
  installationStatus: mysqlEnum("installationStatus", ["waiting", "in_progress", "completed", "delivered"]),
  completedAt: bigint("completedAt", { mode: "number" }),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

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
