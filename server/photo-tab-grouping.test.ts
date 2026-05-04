import { describe, expect, it } from "vitest";

/**
 * Test the photo tab category grouping logic used in SurveyDetail.
 * This mirrors the useMemo logic in SurveyDetail.tsx for:
 * 1. Building categoryMap (merge static PHOTO_CATEGORY_MAP + DB categories)
 * 2. Grouping photos by category
 * 3. Building allPhotoCategories list (DB order + extra from photos)
 */

// Mirror of PHOTO_CATEGORY_MAP from client/src/lib/constants.ts
const PHOTO_CATEGORY_MAP: Record<string, string> = {
  roof_overview: "ภาพรวมหลังคา",
  roof_detail: "รายละเอียดหลังคา",
  electrical_panel: "ตู้ไฟ",
  meter: "มิเตอร์",
  inverter_location: "ตำแหน่งอินเวอร์เตอร์",
  surroundings: "บริเวณรอบบ้าน",
  other: "อื่นๆ",
};

// Helper functions that mirror the logic in SurveyDetail.tsx

function buildCategoryMap(
  photoCategories: { key: string; label: string }[] | undefined
): Record<string, string> {
  const map: Record<string, string> = { ...PHOTO_CATEGORY_MAP };
  if (photoCategories) {
    for (const cat of photoCategories) {
      map[cat.key] = cat.label;
    }
  }
  return map;
}

function groupPhotosByCategory(
  photos: { category?: string }[] | undefined
): Record<string, any[]> {
  if (!photos) return {};
  const grouped: Record<string, any[]> = {};
  for (const photo of photos) {
    const cat = photo.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(photo);
  }
  return grouped;
}

function buildAllPhotoCategories(
  photoCategories: { key: string }[] | undefined,
  photos: { category?: string }[] | undefined
): string[] {
  const cats: string[] = [];
  const seen = new Set<string>();
  // First: categories from DB in sortOrder
  if (photoCategories) {
    for (const cat of photoCategories) {
      if (!seen.has(cat.key)) {
        cats.push(cat.key);
        seen.add(cat.key);
      }
    }
  }
  // Then: any categories from existing photos not in DB
  if (photos) {
    for (const photo of photos) {
      if (photo.category && !seen.has(photo.category)) {
        cats.push(photo.category);
        seen.add(photo.category);
      }
    }
  }
  return cats;
}

describe("Photo Tab Category Grouping Logic", () => {
  const dbCategories = [
    { key: "รูปหน้าบ้าน_อาคาร", label: "รูปหน้าบ้าน/อาคาร (ถ่ายไกลให้เห็นทั้งหลัง)", sortOrder: 1 },
    { key: "รูปบริเวณโดยรอบ", label: "รูปบริเวณโดยรอบ (ซ้าย-ขวา-หน้า-หลัง)", sortOrder: 2 },
    { key: "ทางเข้า", label: "ทางเข้า (ดูว่ารถเครน/ขนของเข้าได้ไหม)", sortOrder: 3 },
    { key: "หลังคามุมกว้าง", label: "หลังคามุมกว้าง (ภาพโดรน)", sortOrder: 4 },
    { key: "หลังคาซูมใกล้", label: "หลังคาซูมใกล้ (วัสดุ/โครงสร้าง)", sortOrder: 5 },
    { key: "ตู้ไฟ_เปิดฝา", label: "ตู้ไฟ (เปิดฝา)", sortOrder: 6 },
    { key: "มิเตอร์ไฟฟ้า", label: "มิเตอร์ไฟฟ้า", sortOrder: 7 },
    { key: "จุดติดตั้ง_Inverter", label: "จุดติดตั้ง Inverter", sortOrder: 8 },
    { key: "เส้นทางเดินสาย", label: "เส้นทางเดินสาย บนล่าง ผนังเจาะ", sortOrder: 9 },
    { key: "จุดอันตราย", label: "จุดอันตราย / อุปสรรค", sortOrder: 10 },
    { key: "บิลค่าไฟ", label: "บิลค่าไฟ", sortOrder: 11 },
    { key: "อื่นๆ", label: "อื่นๆ", sortOrder: 99 },
  ];

  const samplePhotos = [
    { id: 1, category: "รูปหน้าบ้าน_อาคาร", url: "https://example.com/1.jpg" },
    { id: 2, category: "รูปบริเวณโดยรอบ", url: "https://example.com/2.jpg" },
    { id: 3, category: "รูปบริเวณโดยรอบ", url: "https://example.com/3.jpg" },
    { id: 4, category: "หลังคามุมกว้าง", url: "https://example.com/4.jpg" },
    { id: 5, category: "ตู้ไฟ_เปิดฝา", url: "https://example.com/5.jpg" },
    { id: 6, category: "มิเตอร์ไฟฟ้า", url: "https://example.com/6.jpg" },
    { id: 7, category: "มิเตอร์ไฟฟ้า", url: "https://example.com/7.jpg" },
    { id: 8, category: "มิเตอร์ไฟฟ้า", url: "https://example.com/8.jpg" },
  ];

  describe("buildCategoryMap", () => {
    it("should merge PHOTO_CATEGORY_MAP with DB categories", () => {
      const map = buildCategoryMap(dbCategories);
      // DB categories should override static ones
      expect(map["รูปหน้าบ้าน_อาคาร"]).toBe("รูปหน้าบ้าน/อาคาร (ถ่ายไกลให้เห็นทั้งหลัง)");
      expect(map["ตู้ไฟ_เปิดฝา"]).toBe("ตู้ไฟ (เปิดฝา)");
      // Static fallback still available for old keys
      expect(map["roof_overview"]).toBe("ภาพรวมหลังคา");
      expect(map["other"]).toBe("อื่นๆ");
    });

    it("should use static map when no DB categories", () => {
      const map = buildCategoryMap(undefined);
      expect(map["roof_overview"]).toBe("ภาพรวมหลังคา");
      expect(map["other"]).toBe("อื่นๆ");
      expect(Object.keys(map).length).toBe(7);
    });

    it("DB categories should override static labels", () => {
      const map = buildCategoryMap([
        { key: "other", label: "อื่นๆ (ปรับแต่ง)" },
      ]);
      expect(map["other"]).toBe("อื่นๆ (ปรับแต่ง)");
    });
  });

  describe("groupPhotosByCategory", () => {
    it("should group photos by their category field", () => {
      const grouped = groupPhotosByCategory(samplePhotos);
      expect(grouped["รูปหน้าบ้าน_อาคาร"]).toHaveLength(1);
      expect(grouped["รูปบริเวณโดยรอบ"]).toHaveLength(2);
      expect(grouped["หลังคามุมกว้าง"]).toHaveLength(1);
      expect(grouped["ตู้ไฟ_เปิดฝา"]).toHaveLength(1);
      expect(grouped["มิเตอร์ไฟฟ้า"]).toHaveLength(3);
    });

    it("should default to 'other' when category is missing", () => {
      const photos = [
        { id: 1, url: "test.jpg" },
        { id: 2, category: "", url: "test2.jpg" },
      ];
      const grouped = groupPhotosByCategory(photos);
      expect(grouped["other"]).toHaveLength(2);
    });

    it("should return empty object for undefined photos", () => {
      const grouped = groupPhotosByCategory(undefined);
      expect(grouped).toEqual({});
    });

    it("should return empty object for empty array", () => {
      const grouped = groupPhotosByCategory([]);
      expect(grouped).toEqual({});
    });
  });

  describe("buildAllPhotoCategories", () => {
    it("should list DB categories first in order", () => {
      const cats = buildAllPhotoCategories(dbCategories, samplePhotos);
      expect(cats[0]).toBe("รูปหน้าบ้าน_อาคาร");
      expect(cats[1]).toBe("รูปบริเวณโดยรอบ");
      expect(cats[2]).toBe("ทางเข้า");
      expect(cats[cats.length - 1]).toBe("อื่นๆ");
    });

    it("should include all DB categories even if no photos exist for them", () => {
      const cats = buildAllPhotoCategories(dbCategories, []);
      expect(cats).toHaveLength(12);
      expect(cats).toContain("ทางเข้า");
      expect(cats).toContain("จุดอันตราย");
      expect(cats).toContain("บิลค่าไฟ");
    });

    it("should append photo categories not in DB", () => {
      const photosWithExtraCategory = [
        ...samplePhotos,
        { id: 99, category: "custom_new_category", url: "test.jpg" },
      ];
      const cats = buildAllPhotoCategories(dbCategories, photosWithExtraCategory);
      expect(cats).toContain("custom_new_category");
      // Custom category should be at the end
      expect(cats[cats.length - 1]).toBe("custom_new_category");
    });

    it("should not have duplicates", () => {
      const cats = buildAllPhotoCategories(dbCategories, samplePhotos);
      const unique = new Set(cats);
      expect(unique.size).toBe(cats.length);
    });

    it("should handle undefined DB categories", () => {
      const cats = buildAllPhotoCategories(undefined, samplePhotos);
      // Should only have categories from photos
      expect(cats).toContain("รูปหน้าบ้าน_อาคาร");
      expect(cats).toContain("รูปบริเวณโดยรอบ");
      expect(cats).not.toContain("ทางเข้า"); // not in photos
    });
  });

  describe("Integration: category display in photo tab", () => {
    it("each category should show Thai label from categoryMap", () => {
      const map = buildCategoryMap(dbCategories);
      const allCats = buildAllPhotoCategories(dbCategories, samplePhotos);

      for (const catKey of allCats) {
        const label = map[catKey] || catKey;
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it("empty categories should still appear in the list", () => {
      const allCats = buildAllPhotoCategories(dbCategories, samplePhotos);
      const grouped = groupPhotosByCategory(samplePhotos);

      // These categories have no photos but should still show
      expect(allCats).toContain("ทางเข้า");
      expect(grouped["ทางเข้า"]).toBeUndefined();

      expect(allCats).toContain("จุดอันตราย");
      expect(grouped["จุดอันตราย"]).toBeUndefined();
    });

    it("photo count per category should be accurate", () => {
      const grouped = groupPhotosByCategory(samplePhotos);
      expect((grouped["มิเตอร์ไฟฟ้า"] || []).length).toBe(3);
      expect((grouped["รูปบริเวณโดยรอบ"] || []).length).toBe(2);
      expect((grouped["ทางเข้า"] || []).length).toBe(0);
    });
  });
});
