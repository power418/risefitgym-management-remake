import { prisma } from "./schema";
import { hashPassword } from "../utils/hash";

console.log("🌱 Memulai seeding database RiseFit...");

// 1. Membership Plans
const membershipsData = [
  { name: "Bulanan", price: 150_000, durationDays: 30, description: "Akses penuh gym selama 30 hari" },
  { name: "3 Bulan", price: 400_000, durationDays: 90, description: "Akses penuh gym selama 90 hari (Hemat 50rb)" },
  { name: "Tahunan", price: 1_200_000, durationDays: 365, description: "Akses penuh gym selama 1 tahun (Best Value)" },
];

for (const m of membershipsData) {
  const existing = await prisma.membership.findFirst({ where: { name: m.name } });
  if (!existing) {
    await prisma.membership.create({ data: m });
  }
}
console.log("✅ Data Membership berhasil di-seed");

// 2. Admin User
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@risefit.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

const adminUser = await prisma.user.upsert({
  where: { email: adminEmail },
  update: {
    name: "Admin RiseFit",
    role: "ADMIN",
  },
  create: {
    name: "Admin RiseFit",
    email: adminEmail,
    passwordHash: await hashPassword(adminPassword),
    role: "ADMIN",
    cart: { create: {} },
  },
});
console.log(`✅ Admin user siap: ${adminEmail} / ${adminPassword}`);

// 3. Member User (untuk testing belanja & attendance)
const memberEmail = "member@risefit.local";
const memberPassword = "member123";

const memberUser = await prisma.user.upsert({
  where: { email: memberEmail },
  update: {
    name: "John Member",
    role: "USER",
  },
  create: {
    name: "John Member",
    email: memberEmail,
    passwordHash: await hashPassword(memberPassword),
    role: "USER",
    cart: { create: {} },
  },
});

// Berikan membership aktif ke John Member agar bisa test attendance
const monthlyPlan = await prisma.membership.findFirst({ where: { name: "Bulanan" } });
if (monthlyPlan) {
  const existingUserMembership = await prisma.userMembership.findFirst({
    where: { userId: memberUser.id, status: "ACTIVE" },
  });

  if (!existingUserMembership) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    await prisma.userMembership.create({
      data: {
        userId: memberUser.id,
        membershipId: monthlyPlan.id,
        startDate,
        endDate,
        status: "ACTIVE",
      },
    });
  }
}
console.log(`✅ Member tester siap: ${memberEmail} / ${memberPassword} (Membership Aktif)`);

// 4. Supplier / Vendor (Agent)
const suppliers = [
  {
    name: "PT Fit Supply Nusantara",
    email: "supplier@fitsupply.id",
    phone: "081234567890",
  },
  {
    name: "CV Barbell Power Gym Gear",
    email: "gear@barbellpower.id",
    phone: "081298765432",
  },
];

const seededSuppliers = [];
for (const s of suppliers) {
  const agent = await prisma.agent.upsert({
    where: { email: s.email },
    update: { name: s.name, phone: s.phone },
    create: s,
  });
  seededSuppliers.push(agent);
}
console.log(`✅ ${seededSuppliers.length} Vendor/Supplier berhasil di-seed`);

// 5. Produk Peralatan Gym, Suplemen & Aksesoris
const productsData = [
  // Suplemen & Nutrisi
  {
    sku: "RF-WHEY-CHOC",
    name: "RiseFit Whey Protein Isolate 2 Lbs (Belgian Choco)",
    description: "27g protein per serving, rendah lemak, 100% whey isolate untuk pembentukan massa otot optimal.",
    price: 450_000,
    stock: 45,
    supplierIndex: 0,
  },
  {
    sku: "RF-CREAT-300",
    name: "RiseFit Pure Creatine Monohydrate 300g",
    description: "100% Micronized Creatine murni tanpa perasa. Meningkatkan power, kekuatan, dan ketahanan otot.",
    price: 185_000,
    stock: 60,
    supplierIndex: 0,
  },
  {
    sku: "RF-PRE-BERRY",
    name: "RiseFit Pre-Workout Surge 30 Servings (Berry Blast)",
    description: "Booster energi tinggi dengan kandungan kafein, beta-alanine, dan citrulline malate.",
    price: 260_000,
    stock: 30,
    supplierIndex: 0,
  },
  // Peralatan & Fitness Gear
  {
    sku: "RF-DUMB-HEX10",
    name: "Rubber Hexagonal Dumbbell 10 Kg (Sepasang)",
    description: "Dumbbell hexagonal lapis karet anti-benturan & pegangan chrome ergonomis non-slip.",
    price: 650_000,
    stock: 12,
    supplierIndex: 1,
  },
  {
    sku: "RF-BAND-SET",
    name: "Resistance Loop Bands Set 5 Level + Pouch",
    description: "Set karet elastis latex premium 5 tingkat resistensi untuk warm up, stretching, dan glute workouts.",
    price: 95_000,
    stock: 50,
    supplierIndex: 1,
  },
  {
    sku: "RF-STRAP-PAD",
    name: "RiseFit Padded Heavy Duty Lifting Straps",
    description: "Tali angkat beban berbahan cotton tebal dilengkapi busa neoprene pelindung pergelangan tangan.",
    price: 75_000,
    stock: 80,
    supplierIndex: 1,
  },
  {
    sku: "RF-BELT-LTHR",
    name: "RiseFit Leather Weightlifting Belt 10mm (Size L)",
    description: "Sabuk angkat beban kulit sapi sintetis tebal 10mm, support pinggang maksimal saat squat & deadlift.",
    price: 340_000,
    stock: 20,
    supplierIndex: 1,
  },
  {
    sku: "RF-GLOVE-PRO",
    name: "RiseFit Gym Gloves Pro Anti-Slip Breathable",
    description: "Sarung tangan gym berpori anti-kapalan dengan bantalan silikon ekstra grip.",
    price: 85_000,
    stock: 40,
    supplierIndex: 1,
  },
  // Aksesoris & Apparel
  {
    sku: "RF-SHAKE-700",
    name: "RiseFit Stealth Shaker Bottle 700ml",
    description: "Botol shaker anti-bocor dengan saringan mixer ball stainless steel, BPA free.",
    price: 55_000,
    stock: 100,
    supplierIndex: 0,
  },
  {
    sku: "RF-TOWEL-MF",
    name: "Handuk Gym Microfiber Quick-Dry RiseFit",
    description: "Handuk olahraga daya serap tinggi, cepat kering dan ringkas dimasukkan ke tas gym.",
    price: 45_000,
    stock: 75,
    supplierIndex: 0,
  },
  {
    sku: "RF-SHIRT-BLK",
    name: "RiseFit Oversized Heavyweight Cotton T-Shirt (Hitam)",
    description: "Kaos gym oversized premium 100% cotton combed 20s, adem dan fleksibel untuk workout.",
    price: 145_000,
    stock: 35,
    supplierIndex: 1,
  },
];

for (const item of productsData) {
  const supplier = seededSuppliers[item.supplierIndex];

  const product = await prisma.product.upsert({
    where: { sku: item.sku },
    update: {
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      isActive: true,
    },
    create: {
      sku: item.sku,
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      isActive: true,
    },
  });

  // Catat riwayat barang masuk (InventoryMovement: IN) jika belum pernah ada
  const existingMovement = await prisma.inventoryMovement.findFirst({
    where: {
      productId: product.id,
      type: "IN",
    },
  });

  if (!existingMovement) {
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        agentId: supplier?.id,
        type: "IN",
        quantity: item.stock,
        note: `Pengadaan barang masuk stok awal dari ${supplier?.name ?? "Supplier"}`,
      },
    });
  }
}
console.log(`✅ ${productsData.length} Produk & Riwayat Inventaris Masuk berhasil di-seed`);

await prisma.$disconnect();
console.log("🎉 Seeding selesai dengan sukses!");
