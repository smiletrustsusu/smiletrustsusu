/**
 * Compact Ghana region → district cascade for member registration.
 * District lists are practical collections commonly used in field forms (not a full gazetteer).
 */

export const GHANA_REGION_DISTRICTS = Object.freeze({
  "Greater Accra": [
    "Accra Metropolitan",
    "Tema Metropolitan",
    "Ashaiman Municipal",
    "Ga East Municipal",
    "Ga West Municipal",
    "Ga South Municipal",
    "Ga Central Municipal",
    "Ga North Municipal",
    "Ledzokuku Municipal",
    "Krowor Municipal",
    "La Nkwantanang Madina",
    "La Dade Kotopon",
    "Adenta Municipal",
    "Shai Osudoku",
    "Ningo Prampram",
    "Ada East",
    "Ada West"
  ],
  Ashanti: [
    "Kumasi Metropolitan",
    "Asokwa Municipal",
    "Oforikrom Municipal",
    "Suame Municipal",
    "Old Tafo Municipal",
    "Kwadaso Municipal",
    "Ejisu Municipal",
    "Juaben Municipal",
    "Asante Akim Central",
    "Asante Akim North",
    "Asante Akim South",
    "Bekwai Municipal",
    "Obuasi Municipal",
    "Mampong Municipal",
    "Offinso Municipal",
    "Atwima Nwabiagya",
    "Atwima Kwanwoma",
    "Bosomtwe",
    "Afigya Kwabre"
  ],
  Western: [
    "Sekondi Takoradi Metropolitan",
    "Effia Kwesimintsim",
    "Shama",
    "Ahanta West",
    "Nzema East",
    "Ellembelle",
    "Jomoro",
    "Wassa East",
    "Mpohor",
    "Prestea Huni-Valley",
    "Tarkwa Nsuaem"
  ],
  "Western North": [
    "Sefwi Wiawso Municipal",
    "Bibiani Anhwiaso Bekwai",
    "Aowin",
    "Suaman",
    "Bodi",
    "Bia East",
    "Bia West",
    "Juaboso",
    "Akontombra"
  ],
  Central: [
    "Cape Coast Metropolitan",
    "Komenda Edina Eguafo Abirem",
    "Abura Asebu Kwamankese",
    "Mfantseman",
    "Ajumako Enyan Essiam",
    "Gomoa East",
    "Gomoa West",
    "Gomoa Central",
    "Effutu Municipal",
    "Awutu Senya East",
    "Awutu Senya West",
    "Agona East",
    "Agona West",
    "Assin North",
    "Assin South",
    "Assin Central",
    "Twifo Atti-Morkwa",
    "Upper Denkyira East",
    "Upper Denkyira West"
  ],
  Eastern: [
    "New Juaben South",
    "New Juaben North",
    "Akuapem North",
    "Akuapem South",
    "Yilo Krobo",
    "Lower Manya Krobo",
    "Upper Manya Krobo",
    "East Akim",
    "West Akim",
    "Birim Central",
    "Birim North",
    "Birim South",
    "Achiase",
    "Kwahu East",
    "Kwahu West",
    "Kwahu South",
    "Fanteakwa North",
    "Fanteakwa South",
    "Suhum Municipal",
    "Nsawam Adoagyiri"
  ],
  Volta: [
    "Ho Municipal",
    "Ho West",
    "Hohoe Municipal",
    "Keta Municipal",
    "Anloga",
    "Ketu South",
    "Ketu North",
    "Akatsi South",
    "Akatsi North",
    "North Dayi",
    "South Dayi",
    "Afadzato South",
    "Adaklu",
    "Agotime Ziope"
  ],
  Oti: [
    "Jasikan",
    "Kadjebi",
    "Krachi East",
    "Krachi West",
    "Krachi Nchumuru",
    "Nkwanta South",
    "Nkwanta North",
    "Biakoye"
  ],
  Northern: [
    "Tamale Metropolitan",
    "Sagnarigu Municipal",
    "Savelugu Municipal",
    "Nanton",
    "Tolon",
    "Kumbungu",
    "Gushegu Municipal",
    "Karaga",
    "Yendi Municipal",
    "Mion",
    "Zabzugu",
    "Tatale Sanguli",
    "Saboba"
  ],
  Savannah: [
    "Damongo",
    "West Gonja",
    "Central Gonja",
    "East Gonja",
    "North Gonja",
    "Bole",
    "Sawla Tuna Kalba",
    "North East Gonja"
  ],
  "North East": [
    "Nalerigu",
    "East Mamprusi",
    "West Mamprusi",
    "Yunyoo Nasuan",
    "Bunkpurugu Nyankpanduri",
    "Chereponi"
  ],
  "Upper East": [
    "Bolgatanga Municipal",
    "Bongo",
    "Kassena Nankana East",
    "Kassena Nankana West",
    "Bawku Municipal",
    "Bawku West",
    "Binduri",
    "Garu",
    "Tempane",
    "Pusiga",
    "Talensi",
    "Nabdam",
    "Builsa North",
    "Builsa South"
  ],
  "Upper West": [
    "Wa Municipal",
    "Wa East",
    "Wa West",
    "Nadowli Kaleo",
    "Daffiama Bussie Issa",
    "Jirapa Municipal",
    "Lambussie Karni",
    "Lawra Municipal",
    "Nandom Municipal",
    "Sissala East",
    "Sissala West"
  ],
  Bono: [
    "Sunyani Municipal",
    "Sunyani West",
    "Berekum East",
    "Berekum West",
    "Dormaa Central",
    "Dormaa East",
    "Dormaa West",
    "Wenchi Municipal",
    "Tain",
    "Banda",
    "Jaman North",
    "Jaman South"
  ],
  "Bono East": [
    "Techiman Municipal",
    "Techiman North",
    "Kintampo North",
    "Kintampo South",
    "Nkoranza North",
    "Nkoranza South",
    "Atebubu Amantin",
    "Sene East",
    "Sene West",
    "Pru East",
    "Pru West"
  ],
  Ahafo: [
    "Goaso",
    "Asunafo North",
    "Asunafo South",
    "Asutifi North",
    "Asutifi South",
    "Tano North",
    "Tano South"
  ]
});

export function listGhanaRegions() {
  return Object.keys(GHANA_REGION_DISTRICTS);
}

export function districtsForRegion(region) {
  const key = String(region || "").trim();
  if (!key) return [];
  const exact = GHANA_REGION_DISTRICTS[key];
  if (exact) return exact.slice();
  const match = listGhanaRegions().find((name) => name.toLowerCase() === key.toLowerCase());
  return match ? GHANA_REGION_DISTRICTS[match].slice() : [];
}

export function regionSelectOptionsHtml(selected = "", escapeAttr = (v) => String(v ?? "")) {
  const current = String(selected || "").trim();
  const regions = listGhanaRegions();
  const options = [
    `<option value="">Select region</option>`,
    ...regions.map(
      (region) =>
        `<option value="${escapeAttr(region)}" ${region === current ? "selected" : ""}>${escapeAttr(region)}</option>`
    )
  ];
  if (current && !regions.includes(current)) {
    options.push(`<option value="${escapeAttr(current)}" selected>${escapeAttr(current)}</option>`);
  }
  return options.join("");
}

export function districtSelectOptionsHtml(region, selected = "", escapeAttr = (v) => String(v ?? "")) {
  const current = String(selected || "").trim();
  const districts = districtsForRegion(region);
  const options = [
    `<option value="">${region ? "Select district" : "Select region first"}</option>`,
    ...districts.map(
      (district) =>
        `<option value="${escapeAttr(district)}" ${district === current ? "selected" : ""}>${escapeAttr(district)}</option>`
    )
  ];
  if (current && !districts.includes(current)) {
    options.push(`<option value="${escapeAttr(current)}" selected>${escapeAttr(current)}</option>`);
  }
  return options.join("");
}
