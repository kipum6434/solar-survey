export const SURVEY_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "รอดำเนินการ", color: "text-stone-600", bg: "bg-stone-100" },
  scheduled: { label: "นัดสำรวจแล้ว", color: "text-blue-700", bg: "bg-blue-50" },
  in_progress: { label: "กำลังสำรวจ", color: "text-amber-700", bg: "bg-amber-50" },
  surveyed: { label: "สำรวจเสร็จ", color: "text-emerald-700", bg: "bg-emerald-50" },
  follow_up: { label: "รอติดตาม", color: "text-cyan-700", bg: "bg-cyan-50" },
  quoted: { label: "เสนอราคาแล้ว", color: "text-purple-700", bg: "bg-purple-50" },
  negotiating: { label: "เจรจาต่อรอง", color: "text-orange-700", bg: "bg-orange-50" },
  won: { label: "ปิดการขาย", color: "text-green-700", bg: "bg-green-100" },
  lost: { label: "ไม่สำเร็จ", color: "text-red-700", bg: "bg-red-50" },
  cancelled: { label: "ยกเลิก", color: "text-gray-500", bg: "bg-gray-100" },
  postponed: { label: "เลื่อนสำรวจ", color: "text-yellow-700", bg: "bg-yellow-50" },
};

export const INSTALLATION_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: "รอติดตั้ง", color: "text-blue-700", bg: "bg-blue-50" },
  in_progress: { label: "กำลังติดตั้ง", color: "text-amber-700", bg: "bg-amber-50" },
  completed: { label: "ติดตั้งเสร็จ", color: "text-green-700", bg: "bg-green-50" },
  delivered: { label: "ส่งมอบแล้ว", color: "text-emerald-700", bg: "bg-emerald-50" },
  postponed: { label: "เลื่อนติดตั้ง", color: "text-yellow-700", bg: "bg-yellow-50" },
  cancelled: { label: "ยกเลิกติดตั้ง", color: "text-red-700", bg: "bg-red-50" },
};

export const SOURCE_MAP: Record<string, string> = {
  walk_in: "Walk-in",
  telesale: "Telesale",
  facebook: "Facebook",
  line: "LINE",
  website: "Website",
  referral: "แนะนำ",
  other: "อื่นๆ",
};

export const PHOTO_CATEGORY_MAP: Record<string, string> = {
  roof_overview: "ภาพรวมหลังคา",
  roof_detail: "รายละเอียดหลังคา",
  electrical_panel: "ตู้ไฟ",
  meter: "มิเตอร์",
  inverter_location: "ตำแหน่งอินเวอร์เตอร์",
  surroundings: "บริเวณรอบบ้าน",
  other: "อื่นๆ",
};

export const FOLLOW_UP_METHOD_MAP: Record<string, string> = {
  phone: "โทรศัพท์",
  line: "LINE",
  visit: "เข้าพบ",
  email: "อีเมล",
  other: "อื่นๆ",
};

export const DOC_TYPE_MAP: Record<string, string> = {
  quotation: "ใบเสนอราคา",
  simulation: "ผล Simulation",
  contract: "สัญญา",
  other: "อื่นๆ",
};
