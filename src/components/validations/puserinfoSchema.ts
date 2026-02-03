import * as z from 'zod';

// --- 1. กฎพื้นฐาน ---
export const phoneRule = z
  .string()
  .length(10, "เบอร์โทรศัพท์ต้องมี 10 หลัก")
  .regex(/^[0-9]+$/, "ต้องเป็นตัวเลขเท่านั้น");

export const homePhoneRule = z
  .string()
  .optional()
  .refine((val) => {
    if (!val) return true;
    const trimmed = val.trim();
    if (trimmed === "") return true;
    return /^[0-9]+$/.test(trimmed);
  }, "ต้องเป็นตัวเลขเท่านั้น")
  .refine((val) => {
    if (!val) return true;
    const trimmed = val.trim();
    if (trimmed === "") return true;
    return trimmed.length == 10;
  }, "เบอร์โทรศัพท์บ้านต้องมี 10 หลัก");

export const zipCodeRule = z
  .string()
  .min(1, "กรุณากรอกรหัสไปรษณีย์")
  .length(5, "รหัสไปรษณีย์ต้องมี 5 หลัก")
  .regex(/^[0-9]+$/, "ต้องเป็นตัวเลขเท่านั้น");

// --- 2. Schema สำหรับแก้ไขข้อมูลผู้มีภาวะพึ่งพิง ---
export const puserinfoSchema = z.object({
  takecare_fname: z.string().min(1, "กรุณากรอกชื่อ"),
  takecare_sname: z.string().min(1, "กรุณากรอกนามสกุล"),
  
  takecare_birthday: z.date({
    required_error: "กรุณาเลือกวันเกิด",
  }),

  gender_id: z.number({
    required_error: "กรุณาเลือกเพศ",
    invalid_type_error: "กรุณาเลือกเพศ",
  }).min(1, "กรุณาเลือกเพศ"),

  marry_id: z.number({
    required_error: "กรุณาเลือกสถานะการสมรส",
    invalid_type_error: "กรุณาเลือกสถานะการสมรส",
  }).min(1, "กรุณาเลือกสถานะการสมรส"),

  takecare_number: z.string().optional(),
  takecare_moo: z.string().optional(),
  takecare_road: z.string().optional(),
  takecare_tubon: z.string().min(1, "กรุณากรอกตำบล"),
  takecare_amphur: z.string().min(1, "กรุณากรอกอำเภอ"),
  takecare_province: z.string().min(1, "กรุณากรอกจังหวัด"),

  takecare_postcode: zipCodeRule, 
  takecare_tel1: phoneRule,
  takecare_tel_home: homePhoneRule,

  takecare_disease: z.string().optional(),
  takecare_drug: z.string().optional(),
});

// 3. Export Type
export type PuserinfoFormData = z.infer<typeof puserinfoSchema>;