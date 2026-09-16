export const kpiData = {
  complianceRate: 92,
  totalMaterials: 1450,
  compliantMaterials: 1334,
  pendingMaterials: 89,
  ngMaterials: 27,
  expiredMaterials: 15,
  openNCR: 12,
  overdueCAPA: 3,
  trainingCompletion: 98,
};

export const ctsData = [
  {
    id: "CTS_1",
    name: "Chất bị kiểm soát (Restricted Substances)",
    status: "compliant",
    completion: 95,
    openIssues: 2,
    lastUpdate: "2026-09-10",
  },
  {
    id: "CTS_2",
    name: "Kiểm soát IQC / OQC",
    status: "warning",
    completion: 82,
    openIssues: 8,
    lastUpdate: "2026-09-12",
  },
  {
    id: "CTS_3",
    name: "VOC / SVHC",
    status: "ng",
    completion: 78,
    openIssues: 15,
    lastUpdate: "2026-09-14",
  }
];

export const materialsData = [
  {
    id: "MAT-2401",
    code: "Y0000001981", // Matched from excel
    name: "Epoxy Vitralit UC-1658",
    supplier: "Panacol",
    manufacturer: "Panacol",
    type: "Polymers",
    project: "(818-24160) - CALDERA,SIERRA 8,X2424 - Co-mold",
    category: "Raw Material-Primary",
    ctsCategory: "Direct Material",
    status: "compliant",
    expiryDate: "2028-03-05",
    dri: "Linh.Hoang",
    lastUpdate: "2026-08-20"
  },
  {
    id: "MAT-2402",
    code: "NRAW-00217",
    name: "OCA 100",
    supplier: "3M",
    manufacturer: "3M",
    type: "Polymers",
    project: "CALDERA,SIERRA 8,X2424",
    category: "Raw Material-Primary",
    ctsCategory: "Direct Material",
    status: "warning",
    expiryDate: "2026-10-05",
    dri: "Nguyen.Van.A",
    lastUpdate: "2026-09-01"
  },
  {
    id: "MAT-2403",
    code: "NRAW-00236",
    name: "Black PET 125",
    supplier: "BoyD",
    manufacturer: "BoyD",
    type: "Polymers",
    project: "CALDERA,SIERRA 8,X2424",
    category: "Raw Material-Primary",
    ctsCategory: "Direct Material",
    status: "ng",
    expiryDate: "2025-10-21",
    dri: "Tran.Thi.B",
    lastUpdate: "2026-09-14"
  }
];

export const complianceRecords = [
  { type: "RoHS", reportId: "SHAEC26004709502", lab: "SGS-CSTC Standards", issueDate: "2026-03-06", expiryDate: "2028-03-05", status: "compliant", file: "SHAEC26004709502.pdf", uploader: "Supplier" },
  { type: "Halogen-Free", reportId: "SHAEC26004709501", lab: "SGS-CSTC Standards", issueDate: "2026-03-06", expiryDate: "2028-03-05", status: "compliant", file: "SHAEC26004709501.pdf", uploader: "Supplier" },
  { type: "PFOA & PFOS", reportId: "HT41225257701", lab: "CTIC VIETNAM", issueDate: "2025-12-18", expiryDate: "2027-12-18", status: "compliant", file: "HT41225257701.pdf", uploader: "Supplier" },
  { type: "FMD", reportId: "N/A", lab: "Internal", issueDate: "2026-01-10", expiryDate: "2028-01-10", status: "compliant", file: "FMD_Co-mold.xlsx", uploader: "Linh.Hoang" },
  { type: "XRF Test-IQC", reportId: "Lot: 1691914-1", lab: "IQC Lab", issueDate: "2025-10-21", expiryDate: "2026-10-21", status: "compliant", file: "XRF_Result.xlsx", uploader: "QA Team" },
];
