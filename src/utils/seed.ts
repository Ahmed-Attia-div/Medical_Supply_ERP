
import { suppliersService } from '@/services/suppliersAndDoctorsService';
import { doctorsService } from '@/services/suppliersAndDoctorsService';
import { productsService } from '@/services/productsService';
import { purchasesService } from '@/services/purchasesService';
import { surgeriesService } from '@/services/surgeriesService';
import { ItemCategory, MaterialType, Supplier, Doctor, InventoryItem } from '@/types/inventory';
import { supabase } from '@/lib/supabase';

// Helper to get current user ID
const getUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || 'system_seeder';
};

const SUPPLIERS = [
    { name: 'شركة النور للمستلزمات الطبية', phone: '01012345678', email: 'info@alnoor-med.com' },
    { name: 'مؤسسة الأمل للتجارة', phone: '01123456789', email: 'sales@alamal-trade.com' },
    { name: 'تكنو ميد للأجهزة', phone: '01234567890', email: 'contact@technomed.eg' },
    { name: 'المصرية للتوريدات الطبية', phone: '01098765432', email: 'sales@egypt-med.com' },
    { name: 'أورثو كير سيستمز', phone: '01555555555', email: 'support@orthocare.eg' },
];

const DOCTORS = [
    { name: 'د. محمد علي', specialty: 'جراحة عظام', hospital: 'مستشفى السلام الدولي' },
    { name: 'د. أحمد خليل', specialty: 'مخ وأعصاب', hospital: 'المستشفى الجوي' },
    { name: 'د. سارة حسن', specialty: 'جراحة عامة', hospital: 'مستشفى الدمرداش' },
    { name: 'د. محمود سعيد', specialty: 'جراحة عظام أطفال', hospital: 'مستشفى أبو الريش' },
    { name: 'د. خالد توفيق', specialty: 'جراحة عمود فقري', hospital: 'مستشفى الهلال' },
];

// Expanded Orthopedic Product List
const PRODUCTS_DATA = [
    // --- PLATES (Dead Stock Candidates included) ---
    {
        name: 'شريحة تيتانيوم 4 ثقوب',
        sku: 'PLT-TI-004',
        category: 'plates',
        material: 'titanium',
        length: '4-hole',
        quantity: 50,
        minStock: 10,
        basePrice: 1200,
        sellingPrice: 2500,
        isDeadStock: false
    },
    {
        name: 'شريحة تيتانيوم 6 ثقوب',
        sku: 'PLT-TI-006',
        category: 'plates',
        material: 'titanium',
        length: '6-hole',
        quantity: 35,
        minStock: 10,
        basePrice: 1500,
        sellingPrice: 3200,
        isDeadStock: false
    },
    {
        name: 'شريحة تيتانيوم 8 ثقوب (قديم)',
        sku: 'PLT-TI-008-OLD',
        category: 'plates',
        material: 'titanium',
        length: '8-hole',
        quantity: 12,
        minStock: 5,
        basePrice: 1800,
        sellingPrice: 3800,
        isDeadStock: true // Explicitly making this dead stock
    },
    {
        name: 'شريحة تشريحية للكاحل',
        sku: 'PLT-ANKLE-RT',
        category: 'plates',
        material: 'titanium',
        length: '5-hole',
        quantity: 8,
        minStock: 3,
        basePrice: 4500,
        sellingPrice: 9000,
        isDeadStock: false
    },

    // --- SCREWS ---
    {
        name: 'مسمار عظمي 3.5 مم × 20 مم',
        sku: 'SCR-35-020',
        category: 'screws',
        material: 'stainless',
        diameter: '3.5mm',
        length: '20mm',
        quantity: 200,
        minStock: 50,
        basePrice: 150,
        sellingPrice: 350,
        isDeadStock: false
    },
    {
        name: 'مسمار عظمي 3.5 مم × 24 مم',
        sku: 'SCR-35-024',
        category: 'screws',
        material: 'stainless',
        diameter: '3.5mm',
        length: '24mm',
        quantity: 150,
        minStock: 40,
        basePrice: 150,
        sellingPrice: 350,
        isDeadStock: false
    },
    {
        name: 'مسمار اسفنجي 4.0 مم × 40 مم',
        sku: 'SCR-CAN-40-040',
        category: 'screws',
        material: 'titanium',
        diameter: '4.0mm',
        length: '40mm',
        quantity: 80,
        minStock: 20,
        basePrice: 450,
        sellingPrice: 950,
        isDeadStock: false
    },
    {
        name: 'مسمار هربرت (راكد)',
        sku: 'SCR-HERBERT-OLD',
        category: 'screws',
        material: 'titanium',
        diameter: '2.5mm',
        length: '16mm',
        quantity: 45, // High quantity but no movement
        minStock: 10,
        basePrice: 800,
        sellingPrice: 1600,
        isDeadStock: true
    },

    // --- NAILS ---
    {
        name: 'مسمار نخاعي تيبيا 9 مم × 320 مم',
        sku: 'NAIL-TIB-09-320',
        category: 'nails',
        material: 'titanium',
        diameter: '9.0mm',
        length: '320mm',
        quantity: 5,
        minStock: 5,
        basePrice: 3500,
        sellingPrice: 7500,
        isDeadStock: false
    },
    {
        name: 'مسمار نخاعي فيمور 10 مم × 380 مم',
        sku: 'NAIL-FEM-10-380',
        category: 'nails',
        material: 'titanium',
        diameter: '10.0mm',
        length: '380mm',
        quantity: 3,
        minStock: 4,
        basePrice: 4200,
        sellingPrice: 8800,
        isDeadStock: false
    },

    // --- WIRES & INSTRUMENTS ---
    {
        name: 'سلك كيرشنر 1.5 مم',
        sku: 'KWIRE-15',
        category: 'wires',
        material: 'stainless',
        diameter: '1.5mm',
        quantity: 300,
        minStock: 100,
        basePrice: 50,
        sellingPrice: 120,
        isDeadStock: false
    },
    {
        name: 'سلك سيركلاج 1.0 مم',
        sku: 'WIRE-CER-10',
        category: 'wires',
        material: 'stainless',
        diameter: '1.0mm',
        quantity: 50, // Low stock
        minStock: 60,
        basePrice: 80,
        sellingPrice: 180,
        isDeadStock: false
    },

    // --- CONSUMABLES (Fast moving) ---
    {
        name: 'شاش معقم كبير',
        sku: 'CONS-GAUZE-L',
        category: 'consumables',
        quantity: 1000,
        minStock: 200,
        basePrice: 5,
        sellingPrice: 15,
        isDeadStock: false
    },
    {
        name: 'طقم غيار معقم',
        sku: 'KIT-STERILE-1',
        category: 'consumables',
        quantity: 0, // Out of stock
        minStock: 50,
        basePrice: 120,
        sellingPrice: 250,
        isDeadStock: false
    },

    // --- Dead Stock Specific ---
    {
        name: 'مثبت خارجي اليزاروف (موديل قديم)',
        sku: 'FIX-ILIZ-OLD',
        category: 'instruments',
        material: 'stainless',
        quantity: 3,
        minStock: 1,
        basePrice: 15000,
        sellingPrice: 25000,
        isDeadStock: true
    },
    {
        name: 'طقم آلات ميكرو (راكد)',
        sku: 'INST-MICRO-SET',
        category: 'instruments',
        material: 'stainless',
        quantity: 1,
        minStock: 1,
        basePrice: 45000,
        sellingPrice: 60000,
        isDeadStock: true
    }
];

export async function seedDatabase() {
    console.log('Starting massive seed...');

    try {
        const userId = await getUserId();

        // 1. Create Suppliers
        const suppliers: Supplier[] = [];
        const existingSuppliers = await suppliersService.getAll();

        for (const s of SUPPLIERS) {
            let supplier = existingSuppliers.find(ex => ex.name === s.name);
            if (!supplier) {
                supplier = await suppliersService.create(s);
            }
            suppliers.push(supplier);
        }
        console.log(`Suppliers prepared: ${suppliers.length}`);

        // 2. Create Doctors
        const doctors: Doctor[] = [];
        const existingDoctors = await doctorsService.getAll();

        for (const d of DOCTORS) {
            let doctor = existingDoctors.find(ex => ex.name === d.name);
            if (!doctor) {
                doctor = await doctorsService.create(d);
            }
            doctors.push(doctor);
        }
        console.log(`Doctors prepared: ${doctors.length}`);

        // 3. Create Products with Dead Stock Logic
        const products: InventoryItem[] = [];
        // Calculate a date 8 months ago for dead stock
        const deadStockDate = new Date();
        deadStockDate.setMonth(deadStockDate.getMonth() - 8);

        for (const p of PRODUCTS_DATA) {
            // Check if product exists by SKU
            let product = await productsService.getBySku(p.sku);

            if (!product) {
                product = await productsService.create({
                    name: p.name,
                    sku: p.sku,
                    category: p.category as ItemCategory,
                    material: p.material as MaterialType,
                    diameter: (p as any).diameter,
                    length: (p as any).length,
                    quantity: p.quantity,
                    minStock: p.minStock,
                    basePrice: p.basePrice,
                    sellingPrice: p.sellingPrice,
                    createdBy: userId,
                } as any);

                // If it's intended to be dead stock, update its lastMovementDate
                if (p.isDeadStock) {
                    await productsService.update(product.id, {
                        lastMovementDate: deadStockDate
                    } as any);
                    console.log(`Set dead stock date for: ${p.name}`);
                }
            } else {
                console.log(`Product exists: ${p.sku}`);
                // Ensure dead stock logic is applied even if product exists
                if (p.isDeadStock) {
                    await productsService.update(product.id, {
                        lastMovementDate: deadStockDate
                    } as any);
                }
            }

            products.push(product);
        }
        console.log(`Products prepared: ${products.length}`);


        // 4. Generate Random Purchases (Only for non-dead stock items, mostly)
        // We want history.
        if (suppliers.length > 0 && products.length > 0) {
            for (let i = 0; i < 15; i++) {
                const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
                const product = products[Math.floor(Math.random() * products.length)];

                // Skip some dead stock items to ensure they stay dead
                if ((product as any).name.includes('راكد') || (product as any).name.includes('قديم')) {
                    continue;
                }

                // Random date within last 3 months
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 90));

                await purchasesService.create({
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    itemId: product.id,
                    itemName: product.name,
                    quantity: Math.floor(Math.random() * 50) + 5,
                    unitCost: product.basePrice,
                    totalCost: product.basePrice * (Math.floor(Math.random() * 50) + 5),
                    date: date,
                    notes: `فاتورة توريد #${i + 1}`,
                    createdBy: userId,
                    isLocked: true
                });
            }
        }

        // 5. Generate Random Surgeries (Active Movement)
        if (doctors.length > 0 && products.length > 0) {
            const activeProducts = products.filter(p => !p.name.includes('راكد') && !p.name.includes('قديم'));

            for (let i = 0; i < 10; i++) {
                const doctor = doctors[Math.floor(Math.random() * doctors.length)];
                const surgeryDate = new Date();
                surgeryDate.setDate(surgeryDate.getDate() - Math.floor(Math.random() * 60)); // Last 2 months

                // Pick 1-3 random items for the surgery
                const surgeryItems = [];
                const numItems = Math.floor(Math.random() * 3) + 1;

                for (let j = 0; j < numItems; j++) {
                    const prod = activeProducts[Math.floor(Math.random() * activeProducts.length)];
                    surgeryItems.push({
                        itemId: prod.id,
                        itemName: prod.name,
                        quantity: Math.floor(Math.random() * 2) + 1,
                        basePrice: prod.basePrice,
                        sellingPrice: prod.sellingPrice
                    });
                }

                await surgeriesService.create({
                    doctorId: doctor.id,
                    patientId: `PT-${Math.floor(Math.random() * 1000)}`,
                    patientName: `مريض تجريبي ${i + 1}`,
                    date: surgeryDate,
                    type: ['تثبيت كسر', 'تركيب شريحة', 'رفع شريحة', 'منظار ركبة'][Math.floor(Math.random() * 4)],
                    items: surgeryItems,
                    notes: 'عملية ناجحة وتم الخروج',
                    createdBy: userId,
                    totalBaseValue: 0,
                    totalSellingValue: 0,
                    profit: 0
                });
            }
        }

        return { success: true, message: 'تم تحديث البيانات وإضافة مخزون راكد بنجاح' };
    } catch (error: any) {
        console.error('Seed error:', error);
        return { success: false, message: `حدث خطأ: ${error.message}` };
    }
}
