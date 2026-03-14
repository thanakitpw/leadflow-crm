export interface District {
  label: string
  lat: number
  lng: number
}

export interface ProvinceData {
  label: string
  lat: number
  lng: number
  districts: District[]
}

// 77 จังหวัดของประเทศไทย พร้อมพิกัดกลางจังหวัด + ย่านยอดนิยม (เฉพาะจังหวัดหลัก)
export const PROVINCES: Record<string, ProvinceData> = {
  // ========== ภาคกลาง ==========
  bangkok: {
    label: "กรุงเทพมหานคร",
    lat: 13.7563,
    lng: 100.5018,
    districts: [
      { label: "สีลม", lat: 13.7248, lng: 100.5286 },
      { label: "สยาม", lat: 13.7457, lng: 100.5334 },
      { label: "สุขุมวิท", lat: 13.7318, lng: 100.5685 },
      { label: "ทองหล่อ", lat: 13.7340, lng: 100.5780 },
      { label: "อารีย์", lat: 13.7790, lng: 100.5440 },
      { label: "รัชดา", lat: 13.7600, lng: 100.5740 },
      { label: "บางนา", lat: 13.6670, lng: 100.6050 },
      { label: "ลาดพร้าว", lat: 13.8030, lng: 100.5720 },
      { label: "สาทร", lat: 13.7210, lng: 100.5280 },
      { label: "เยาวราช", lat: 13.7420, lng: 100.5100 },
      { label: "พระราม 9", lat: 13.7570, lng: 100.5650 },
      { label: "บางกะปิ", lat: 13.7650, lng: 100.6470 },
    ],
  },
  nonthaburi: {
    label: "นนทบุรี",
    lat: 13.8621,
    lng: 100.5144,
    districts: [
      { label: "เมือง", lat: 13.8621, lng: 100.5144 },
      { label: "ปากเกร็ด", lat: 13.9125, lng: 100.4975 },
      { label: "แจ้งวัฒนะ", lat: 13.8970, lng: 100.5520 },
      { label: "บางบัวทอง", lat: 13.9170, lng: 100.4240 },
    ],
  },
  pathum_thani: {
    label: "ปทุมธานี",
    lat: 14.0208,
    lng: 100.5253,
    districts: [
      { label: "เมือง", lat: 14.0208, lng: 100.5253 },
      { label: "รังสิต", lat: 13.9653, lng: 100.5988 },
      { label: "ลำลูกกา", lat: 13.9440, lng: 100.7320 },
    ],
  },
  samut_prakan: {
    label: "สมุทรปราการ",
    lat: 13.5991,
    lng: 100.5998,
    districts: [
      { label: "เมือง", lat: 13.5991, lng: 100.5998 },
      { label: "บางพลี", lat: 13.6070, lng: 100.7040 },
      { label: "พระประแดง", lat: 13.6570, lng: 100.5330 },
    ],
  },
  samut_sakhon: {
    label: "สมุทรสาคร",
    lat: 13.5475,
    lng: 100.2743,
    districts: [
      { label: "เมือง", lat: 13.5475, lng: 100.2743 },
      { label: "กระทุ่มแบน", lat: 13.6580, lng: 100.2570 },
    ],
  },
  samut_songkhram: { label: "สมุทรสงคราม", lat: 13.4098, lng: 100.0024, districts: [] },
  nakhon_pathom: {
    label: "นครปฐม",
    lat: 13.8196,
    lng: 100.0443,
    districts: [
      { label: "เมือง", lat: 13.8196, lng: 100.0443 },
      { label: "พุทธมณฑล", lat: 13.8000, lng: 100.3190 },
      { label: "ศาลายา", lat: 13.7940, lng: 100.3240 },
    ],
  },
  ayutthaya: {
    label: "พระนครศรีอยุธยา",
    lat: 14.3532,
    lng: 100.5685,
    districts: [
      { label: "เมือง", lat: 14.3532, lng: 100.5685 },
    ],
  },
  ang_thong: { label: "อ่างทอง", lat: 14.5896, lng: 100.4549, districts: [] },
  lop_buri: { label: "ลพบุรี", lat: 14.7995, lng: 100.6534, districts: [] },
  sing_buri: { label: "สิงห์บุรี", lat: 14.8907, lng: 100.3967, districts: [] },
  chai_nat: { label: "ชัยนาท", lat: 15.1852, lng: 100.1251, districts: [] },
  saraburi: { label: "สระบุรี", lat: 14.5289, lng: 100.9103, districts: [] },

  // ========== ภาคตะวันออก ==========
  chonburi: {
    label: "ชลบุรี",
    lat: 13.3611,
    lng: 100.9847,
    districts: [
      { label: "เมือง", lat: 13.3611, lng: 100.9847 },
      { label: "พัทยา", lat: 12.9236, lng: 100.8825 },
      { label: "ศรีราชา", lat: 13.1674, lng: 100.9300 },
      { label: "บางแสน", lat: 13.2839, lng: 100.9270 },
    ],
  },
  rayong: {
    label: "ระยอง",
    lat: 12.6833,
    lng: 101.2500,
    districts: [
      { label: "เมือง", lat: 12.6833, lng: 101.2500 },
      { label: "บ้านฉาง", lat: 12.7210, lng: 101.0690 },
      { label: "มาบตาพุด", lat: 12.6830, lng: 101.1480 },
    ],
  },
  chanthaburi: { label: "จันทบุรี", lat: 12.6112, lng: 102.1041, districts: [] },
  trat: { label: "ตราด", lat: 12.2428, lng: 102.5175, districts: [] },
  sa_kaeo: { label: "สระแก้ว", lat: 13.8240, lng: 102.0645, districts: [] },
  prachin_buri: { label: "ปราจีนบุรี", lat: 14.0509, lng: 101.3717, districts: [] },
  nakhon_nayok: { label: "นครนายก", lat: 14.2069, lng: 101.2131, districts: [] },
  chachoengsao: { label: "ฉะเชิงเทรา", lat: 13.6904, lng: 101.0779, districts: [] },

  // ========== ภาคเหนือ ==========
  chiang_mai: {
    label: "เชียงใหม่",
    lat: 18.7883,
    lng: 98.9853,
    districts: [
      { label: "เมือง (คูเมือง)", lat: 18.7883, lng: 98.9853 },
      { label: "นิมมานเหมินท์", lat: 18.7980, lng: 98.9680 },
      { label: "สันทราย", lat: 18.8456, lng: 98.9800 },
      { label: "หางดง", lat: 18.6920, lng: 98.9370 },
      { label: "สันกำแพง", lat: 18.7430, lng: 99.1210 },
    ],
  },
  chiang_rai: {
    label: "เชียงราย",
    lat: 19.9105,
    lng: 99.8406,
    districts: [
      { label: "เมือง", lat: 19.9105, lng: 99.8406 },
      { label: "แม่สาย", lat: 20.4283, lng: 99.8764 },
    ],
  },
  lampang: { label: "ลำปาง", lat: 18.2888, lng: 99.4909, districts: [] },
  lamphun: { label: "ลำพูน", lat: 18.5744, lng: 99.0087, districts: [] },
  mae_hong_son: { label: "แม่ฮ่องสอน", lat: 19.2990, lng: 97.9684, districts: [] },
  nan: { label: "น่าน", lat: 18.7756, lng: 100.7730, districts: [] },
  phayao: { label: "พะเยา", lat: 19.1664, lng: 99.9019, districts: [] },
  phrae: { label: "แพร่", lat: 18.1445, lng: 100.1403, districts: [] },
  uttaradit: { label: "อุตรดิตถ์", lat: 17.6200, lng: 100.0993, districts: [] },
  tak: { label: "ตาก", lat: 16.8840, lng: 99.1259, districts: [] },
  sukhothai: { label: "สุโขทัย", lat: 17.0075, lng: 99.8230, districts: [] },
  phitsanulok: {
    label: "พิษณุโลก",
    lat: 16.8211,
    lng: 100.2659,
    districts: [
      { label: "เมือง", lat: 16.8211, lng: 100.2659 },
    ],
  },
  phichit: { label: "พิจิตร", lat: 16.4413, lng: 100.3485, districts: [] },
  phetchabun: { label: "เพชรบูรณ์", lat: 16.4189, lng: 101.1591, districts: [] },
  kamphaeng_phet: { label: "กำแพงเพชร", lat: 16.4828, lng: 99.5226, districts: [] },
  nakhon_sawan: {
    label: "นครสวรรค์",
    lat: 15.7030,
    lng: 100.1371,
    districts: [
      { label: "เมือง", lat: 15.7030, lng: 100.1371 },
    ],
  },
  uthai_thani: { label: "อุทัยธานี", lat: 15.3791, lng: 100.0245, districts: [] },

  // ========== ภาคตะวันออกเฉียงเหนือ ==========
  nakhon_ratchasima: {
    label: "นครราชสีมา",
    lat: 14.9799,
    lng: 102.0978,
    districts: [
      { label: "เมือง", lat: 14.9799, lng: 102.0978 },
      { label: "ปากช่อง", lat: 14.7130, lng: 101.4150 },
    ],
  },
  khon_kaen: {
    label: "ขอนแก่น",
    lat: 16.4322,
    lng: 102.8236,
    districts: [
      { label: "เมือง", lat: 16.4322, lng: 102.8236 },
      { label: "บ้านไผ่", lat: 16.0710, lng: 102.7340 },
    ],
  },
  udon_thani: {
    label: "อุดรธานี",
    lat: 17.4138,
    lng: 102.7870,
    districts: [
      { label: "เมือง", lat: 17.4138, lng: 102.7870 },
    ],
  },
  ubon_ratchathani: {
    label: "อุบลราชธานี",
    lat: 15.2448,
    lng: 104.8473,
    districts: [
      { label: "เมือง", lat: 15.2448, lng: 104.8473 },
    ],
  },
  buri_ram: { label: "บุรีรัมย์", lat: 14.9930, lng: 103.1029, districts: [] },
  surin: { label: "สุรินทร์", lat: 14.8821, lng: 103.4936, districts: [] },
  si_sa_ket: { label: "ศรีสะเกษ", lat: 15.1186, lng: 104.3220, districts: [] },
  chaiyaphum: { label: "ชัยภูมิ", lat: 15.8068, lng: 102.0313, districts: [] },
  maha_sarakham: { label: "มหาสารคาม", lat: 16.1847, lng: 103.3005, districts: [] },
  roi_et: { label: "ร้อยเอ็ด", lat: 16.0538, lng: 103.6520, districts: [] },
  kalasin: { label: "กาฬสินธุ์", lat: 16.4315, lng: 103.5059, districts: [] },
  sakon_nakhon: { label: "สกลนคร", lat: 17.1545, lng: 104.1348, districts: [] },
  nakhon_phanom: { label: "นครพนม", lat: 17.3920, lng: 104.7695, districts: [] },
  mukdahan: { label: "มุกดาหาร", lat: 16.5442, lng: 104.7235, districts: [] },
  yasothon: { label: "ยโสธร", lat: 15.7930, lng: 104.1451, districts: [] },
  amnat_charoen: { label: "อำนาจเจริญ", lat: 15.8656, lng: 104.6263, districts: [] },
  nong_khai: { label: "หนองคาย", lat: 17.8783, lng: 102.7419, districts: [] },
  loei: { label: "เลย", lat: 17.4860, lng: 101.7223, districts: [] },
  nong_bua_lamphu: { label: "หนองบัวลำภู", lat: 17.2041, lng: 102.4260, districts: [] },
  bueng_kan: { label: "บึงกาฬ", lat: 18.3609, lng: 103.6462, districts: [] },

  // ========== ภาคตะวันตก ==========
  kanchanaburi: {
    label: "กาญจนบุรี",
    lat: 14.0227,
    lng: 99.5328,
    districts: [
      { label: "เมือง", lat: 14.0227, lng: 99.5328 },
    ],
  },
  ratchaburi: { label: "ราชบุรี", lat: 13.5283, lng: 99.8134, districts: [] },
  suphan_buri: { label: "สุพรรณบุรี", lat: 14.4744, lng: 100.1177, districts: [] },
  phetchaburi: { label: "เพชรบุรี", lat: 13.1119, lng: 99.9398, districts: [] },
  prachuap: {
    label: "ประจวบคีรีขันธ์",
    lat: 11.8126,
    lng: 99.7957,
    districts: [
      { label: "เมือง", lat: 11.8126, lng: 99.7957 },
      { label: "หัวหิน", lat: 12.5684, lng: 99.9577 },
    ],
  },

  // ========== ภาคใต้ ==========
  surat_thani: {
    label: "สุราษฎร์ธานี",
    lat: 9.1382,
    lng: 99.3217,
    districts: [
      { label: "เมือง", lat: 9.1382, lng: 99.3217 },
      { label: "เกาะสมุย", lat: 9.5120, lng: 100.0136 },
    ],
  },
  nakhon_si: {
    label: "นครศรีธรรมราช",
    lat: 8.4304,
    lng: 99.9631,
    districts: [
      { label: "เมือง", lat: 8.4304, lng: 99.9631 },
    ],
  },
  songkhla: {
    label: "สงขลา",
    lat: 7.1896,
    lng: 100.5945,
    districts: [
      { label: "หาดใหญ่", lat: 7.0056, lng: 100.4745 },
      { label: "เมือง", lat: 7.1896, lng: 100.5945 },
    ],
  },
  phuket: {
    label: "ภูเก็ต",
    lat: 7.8804,
    lng: 98.3923,
    districts: [
      { label: "เมือง", lat: 7.8804, lng: 98.3923 },
      { label: "ป่าตอง", lat: 7.8930, lng: 98.2960 },
      { label: "กะทู้", lat: 7.9100, lng: 98.3370 },
    ],
  },
  krabi: {
    label: "กระบี่",
    lat: 8.0863,
    lng: 98.9063,
    districts: [
      { label: "เมือง", lat: 8.0863, lng: 98.9063 },
      { label: "อ่าวนาง", lat: 8.0360, lng: 98.8230 },
    ],
  },
  phang_nga: { label: "พังงา", lat: 8.4509, lng: 98.5253, districts: [] },
  ranong: { label: "ระนอง", lat: 9.9528, lng: 98.6085, districts: [] },
  chumphon: { label: "ชุมพร", lat: 10.4930, lng: 99.1800, districts: [] },
  trang: { label: "ตรัง", lat: 7.5563, lng: 99.6114, districts: [] },
  phatthalung: { label: "พัทลุง", lat: 7.6167, lng: 100.0743, districts: [] },
  pattani: { label: "ปัตตานี", lat: 6.8686, lng: 101.2508, districts: [] },
  yala: { label: "ยะลา", lat: 6.5410, lng: 101.2803, districts: [] },
  narathiwat: { label: "นราธิวาส", lat: 6.4318, lng: 101.8237, districts: [] },
  satun: { label: "สตูล", lat: 6.6238, lng: 100.0674, districts: [] },
}
