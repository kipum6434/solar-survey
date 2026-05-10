/**
 * Seed script: สร้าง Template "Gulf SSR" พร้อมฟิลด์ตาม PDF ตัวอย่าง
 * Run: node seed-gulf-template.mjs
 */

const BASE_URL = "http://localhost:3000";

async function callTrpc(path, input) {
  // Use batch format for mutations
  const res = await fetch(`${BASE_URL}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`Error calling ${path}:`, JSON.stringify(json, null, 2));
    throw new Error(`API error: ${res.status}`);
  }
  return json;
}

async function callTrpcQuery(path, input) {
  const encoded = encodeURIComponent(JSON.stringify(input));
  const res = await fetch(`${BASE_URL}/api/trpc/${path}?input=${encoded}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  return json;
}

async function main() {
  console.log("=== Seeding Gulf SSR Template ===\n");

  // Step 1: Check if Gulf source exists, get its ID
  console.log("1. Checking sources...");
  const sourcesRes = await callTrpcQuery("source.list", {});
  const sources = sourcesRes?.result?.data || [];
  let gulfSource = sources.find(s => s.name === "Gulf");
  
  if (!gulfSource) {
    console.log("   Gulf source not found. Creating...");
    const createRes = await callTrpc("source.create", { name: "Gulf", category: "partner" });
    gulfSource = createRes?.result?.data;
    console.log(`   Created Gulf source with ID: ${gulfSource?.id}`);
  } else {
    console.log(`   Found Gulf source with ID: ${gulfSource.id}`);
  }

  // Step 2: Check if template already exists
  console.log("\n2. Checking existing templates...");
  const templatesRes = await callTrpcQuery("surveyTemplate.list", {});
  const templates = templatesRes?.result?.data || [];
  const existing = templates.find(t => t.name === "Gulf SSR");
  
  if (existing) {
    console.log(`   Template "Gulf SSR" already exists (ID: ${existing.id}). Skipping creation.`);
    console.log("   Done!");
    return;
  }

  // Step 3: Create template
  console.log("\n3. Creating template 'Gulf SSR'...");
  const templateRes = await callTrpc("surveyTemplate.create", {
    name: "Gulf SSR",
    sourceId: gulfSource?.id || null,
    pdfHeaderTitle: "ปันอาทิตย์ by GULF1",
    pdfHeaderSubtitle: "Site Survey Report",
  });
  const templateId = templateRes?.result?.data?.id;
  console.log(`   Created template ID: ${templateId}`);

  if (!templateId) {
    console.error("   Failed to create template. Aborting.");
    return;
  }

  // Step 4: Add fields
  console.log("\n4. Adding fields...");

  const fields = [
    // === Section 1: ข้อมูลโปรเจค ===
    { fieldName: "section_project", fieldLabel: "1. ข้อมูลโปรเจค", fieldType: "section_header", sectionGroup: "ข้อมูลโปรเจค" },
    { fieldName: "project_name", fieldLabel: "Project Name", fieldType: "text", placeholder: "ชื่อโปรเจค เช่น งานติดตั้งระบบโซล่าเซลล์ขนาด 5.12 kW", required: true, sectionGroup: "ข้อมูลโปรเจค" },
    { fieldName: "date_of_survey", fieldLabel: "Date of Survey", fieldType: "date", required: true, sectionGroup: "ข้อมูลโปรเจค" },

    // === Section 2: Installation Capacity ===
    { fieldName: "section_capacity", fieldLabel: "2. Installation Capacity", fieldType: "section_header", sectionGroup: "Installation Capacity" },
    { fieldName: "installation_capacity", fieldLabel: "Installation Capacity", fieldType: "checkbox_group", fieldOptions: JSON.stringify(["3 kW 1P", "5 kW 1P", "5 kW 3P", "10 kW 1P", "10 kW 3P"]), hasOtherOption: true, required: true, sectionGroup: "Installation Capacity" },
    { fieldName: "price_type", fieldLabel: "Price", fieldType: "checkbox_group", fieldOptions: JSON.stringify(["Standard", "Additional"]), sectionGroup: "Installation Capacity" },
    { fieldName: "shadow_panel", fieldLabel: "เงาบังแผง", fieldType: "radio", fieldOptions: JSON.stringify(["มี", "ไม่มี"]), sectionGroup: "Installation Capacity" },
    { fieldName: "battery", fieldLabel: "Battery", fieldType: "text", placeholder: "เช่น 7 kW + Controller", sectionGroup: "Installation Capacity" },

    // === Section 3: Roofing Material ===
    { fieldName: "section_roofing", fieldLabel: "3. Roofing Material", fieldType: "section_header", sectionGroup: "Roofing Material" },
    { fieldName: "roofing_material", fieldLabel: "Roofing Material", fieldType: "checkbox_group", fieldOptions: JSON.stringify(["CPAC", "Flat Tile", "Concrete Slab", "Metal Sheet"]), hasOtherOption: true, sectionGroup: "Roofing Material" },
    { fieldName: "metal_sheet_thickness", fieldLabel: "Metal Sheet thickness (mm)", fieldType: "number", placeholder: "mm", sectionGroup: "Roofing Material" },

    // === Section 4: Grid Connection ===
    { fieldName: "section_grid", fieldLabel: "4. Grid Connection", fieldType: "section_header", sectionGroup: "Grid Connection" },
    { fieldName: "grid_connection", fieldLabel: "Grid Connection", fieldType: "radio", fieldOptions: JSON.stringify(["MEA", "PEA"]), required: true, sectionGroup: "Grid Connection" },
    { fieldName: "voltage", fieldLabel: "Voltage (V)", fieldType: "number", placeholder: "V", sectionGroup: "Grid Connection" },
    { fieldName: "transformer_size", fieldLabel: "Transformer Size (KVA)", fieldType: "number", placeholder: "KVA", sectionGroup: "Grid Connection" },
    { fieldName: "transformer_type", fieldLabel: "TR. Type", fieldType: "radio", fieldOptions: JSON.stringify(["Oil", "Dry"]), sectionGroup: "Grid Connection" },

    // === Section 5: Connection Point ===
    { fieldName: "section_connection", fieldLabel: "5. Connection Point", fieldType: "section_header", sectionGroup: "Connection Point" },
    { fieldName: "distance_module_to_inverter", fieldLabel: "Distance of Module to Inverter (meter)", fieldType: "number", placeholder: "meter", sectionGroup: "Connection Point" },
    { fieldName: "distance_inverter_to_sdb", fieldLabel: "Distance of Inverter to SDB (meter)", fieldType: "number", placeholder: "meter", sectionGroup: "Connection Point" },
    { fieldName: "distance_sdb_to_mdb", fieldLabel: "Distance of SDB to MDB/Consumer Unit (meter)", fieldType: "number", placeholder: "meter", sectionGroup: "Connection Point" },

    // === Section 6: Wifi ===
    { fieldName: "section_wifi", fieldLabel: "6. Wifi - Hotspot", fieldType: "section_header", sectionGroup: "Wifi" },
    { fieldName: "wifi_status", fieldLabel: "Wifi - Hotspot", fieldType: "checkbox_group", fieldOptions: JSON.stringify(["Found", "Not found", "Use original wifi", "Additional Installation"]), sectionGroup: "Wifi" },
    { fieldName: "internet_speed", fieldLabel: "ความเร็ว Internet ณ จุดติดตั้ง Inverter (Mbps)", fieldType: "number", placeholder: "Mbps", sectionGroup: "Wifi" },

    // === Section 7: Additional Items ===
    { fieldName: "section_additional", fieldLabel: "7. Additional Items", fieldType: "section_header", sectionGroup: "Additional Items" },
    { fieldName: "dc_ac_cable", fieldLabel: "สายไฟ DC/AC/สัญญาณ CT (meter)", fieldType: "number", placeholder: "meter", sectionGroup: "Additional Items" },
    { fieldName: "scaffolding", fieldLabel: "นั่งร้าน (ชุด)", fieldType: "number", placeholder: "ชุด", sectionGroup: "Additional Items" },
    { fieldName: "concrete_rooftop", fieldLabel: "คอนกรีตดาดฟ้า (ก้อน)", fieldType: "number", placeholder: "ก้อน", sectionGroup: "Additional Items" },
    { fieldName: "breaker", fieldLabel: "เบรคเกอร์ (Unit)", fieldType: "number", placeholder: "Unit", sectionGroup: "Additional Items" },
    { fieldName: "breaker_box", fieldLabel: "ตู้เบรคเกอร์ (Unit)", fieldType: "number", placeholder: "Unit", sectionGroup: "Additional Items" },
    { fieldName: "additional_other", fieldLabel: "อื่นๆ", fieldType: "text", placeholder: "ระบุรายการเพิ่มเติม", sectionGroup: "Additional Items" },

    // === Section 8: Rooftop Equipment ===
    { fieldName: "section_rooftop_equip", fieldLabel: "8. Rooftop Equipment", fieldType: "section_header", sectionGroup: "Rooftop Equipment" },
    { fieldName: "rooftop_equipment", fieldLabel: "อุปกรณ์เสริมบนหลังคา", fieldType: "checkbox_group", fieldOptions: JSON.stringify(["Optimizer", "ตาข่ายกันนก"]), hasOtherOption: true, sectionGroup: "Rooftop Equipment" },

    // === Section 9: Measuring / Meter ===
    { fieldName: "section_measuring", fieldLabel: "9. Measuring & Meter", fieldType: "section_header", sectionGroup: "Measuring & Meter" },
    { fieldName: "full_load", fieldLabel: "Full load (A)", fieldType: "number", placeholder: "A", sectionGroup: "Measuring & Meter" },
    { fieldName: "meter_owner", fieldLabel: "ชื่อเจ้าของมิเตอร์", fieldType: "text", sectionGroup: "Measuring & Meter" },
    { fieldName: "meter_type", fieldLabel: "ประเภทมิเตอร์", fieldType: "radio", fieldOptions: JSON.stringify(["TOD", "TOU"]), sectionGroup: "Measuring & Meter" },

    // === Section 10: ผู้สำรวจ ===
    { fieldName: "section_surveyor", fieldLabel: "10. ผู้สำรวจ", fieldType: "section_header", sectionGroup: "ผู้สำรวจ" },
    { fieldName: "surveyor_se", fieldLabel: "ผู้สำรวจ (SE)", fieldType: "text", sectionGroup: "ผู้สำรวจ" },
    { fieldName: "surveyor_sm", fieldLabel: "ผู้ตรวจสอบ (SM)", fieldType: "text", sectionGroup: "ผู้สำรวจ" },
  ];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    try {
      await callTrpc("surveyTemplate.addField", {
        templateId,
        ...field,
        sortOrder: i + 1,
        required: field.required || false,
        hasOtherOption: field.hasOtherOption || false,
      });
      console.log(`   [${i + 1}/${fields.length}] Added: ${field.fieldLabel}`);
    } catch (err) {
      console.error(`   [${i + 1}/${fields.length}] FAILED: ${field.fieldLabel} — ${err.message}`);
    }
  }

  console.log("\n=== Done! Gulf SSR Template created with all fields ===");
  console.log(`Template ID: ${templateId}`);
  console.log(`Total fields: ${fields.length}`);
}

main().catch(console.error);
