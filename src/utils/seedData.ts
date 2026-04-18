import { supabase } from '@/lib/supabase';
import { subDays } from 'date-fns';

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    return url && url !== 'YOUR_SUPABASE_URL_HERE';
};

// Wathqq Medical Products - Realistic orthopedic inventory
const wathqqProducts = [
    // DCP Plates (Dynamic Compression Plates)
    { name: 'شريحة DCP ضيقة', sku: 'DCP-N-4.5-6H', category: 'plates', material: 'titanium', diameter: '4.5mm', length: '6-hole', basePrice: 1800, sellingPrice: 2500 },
    { name: 'شريحة DCP ضيقة', sku: 'DCP-N-4.5-8H', category: 'plates', material: 'titanium', diameter: '4.5mm', length: '8-hole', basePrice: 2200, sellingPrice: 3000 },
    { name: 'شريحة DCP عريضة', sku: 'DCP-B-4.5-10H', category: 'plates', material: 'titanium', diameter: '4.5mm', length: '10-hole', basePrice: 2600, sellingPrice: 3500 },
    { name: 'شريحة DCP عريضة', sku: 'DCP-B-4.5-12H', category: 'plates', material: 'titanium', diameter: '4.5mm', length: '12-hole', basePrice: 3000, sellingPrice: 4000 },

    // LCP Plates (Locking Compression Plates)
    { name: 'شريحة LCP', sku: 'LCP-3.5-6H', category: 'plates', material: 'titanium', diameter: '3.5mm', length: '6-hole', basePrice: 2000, sellingPrice: 2800 },
    { name: 'شريحة LCP', sku: 'LCP-3.5-8H', category: 'plates', material: 'titanium', diameter: '3.5mm', length: '8-hole', basePrice: 2400, sellingPrice: 3200 },

    // Cortical Screws
    { name: 'برغي قشري', sku: 'CS-TI-4.5-20', category: 'screws', material: 'titanium', diameter: '4.5mm', length: '20mm', basePrice: 250, sellingPrice: 350 },
    { name: 'برغي قشري', sku: 'CS-TI-4.5-30', category: 'screws', material: 'titanium', diameter: '4.5mm', length: '30mm', basePrice: 280, sellingPrice: 380 },
    { name: 'برغي قشري', sku: 'CS-TI-4.5-40', category: 'screws', material: 'titanium', diameter: '4.5mm', length: '40mm', basePrice: 300, sellingPrice: 420 },
    { name: 'برغي قشري', sku: 'CS-TI-3.5-16', category: 'screws', material: 'titanium', diameter: '3.5mm', length: '16mm', basePrice: 220, sellingPrice: 300 },
    { name: 'برغي قشري', sku: 'CS-TI-3.5-20', category: 'screws', material: 'titanium', diameter: '3.5mm', length: '20mm', basePrice: 240, sellingPrice: 330 },

    // Cancellous Screws
    { name: 'برغي إسفنجي', sku: 'CAN-TI-6.5-40', category: 'screws', material: 'titanium', diameter: '6.5mm', length: '40mm', basePrice: 350, sellingPrice: 480 },
    { name: 'برغي إسفنجي', sku: 'CAN-TI-6.5-50', category: 'screws', material: 'titanium', diameter: '6.5mm', length: '50mm', basePrice: 380, sellingPrice: 520 },

    // Locking Screws
    { name: 'برغي قفل', sku: 'LS-TI-3.5-20', category: 'screws', material: 'titanium', diameter: '3.5mm', length: '20mm', basePrice: 320, sellingPrice: 450 },
    { name: 'برغي قفل', sku: 'LS-TI-4.5-30', category: 'screws', material: 'titanium', diameter: '4.5mm', length: '30mm', basePrice: 350, sellingPrice: 480 },

    // Intramedullary Nails
    { name: 'مسمار نخاعي للفخذ', sku: 'IMN-TI-11-340', category: 'nails', material: 'titanium', diameter: '11mm', length: '340mm', basePrice: 8500, sellingPrice: 12000 },
    { name: 'مسمار نخاعي للساق', sku: 'IMN-TI-9-280', category: 'nails', material: 'titanium', diameter: '9mm', length: '280mm', basePrice: 7000, sellingPrice: 10000 },

    // K-Wires
    { name: 'سلك كيرشنر', sku: 'KW-SS-2.0-150', category: 'wires', material: 'stainless', diameter: '2.0mm', length: '150mm', basePrice: 25, sellingPrice: 45 },
    { name: 'سلك كيرشنر', sku: 'KW-SS-2.4-200', category: 'wires', material: 'stainless', diameter: '2.4mm', length: '200mm', basePrice: 30, sellingPrice: 50 },
];

const surgeryTypes = [
    'تثبيت كسر عظمة الفخذ',
    'تثبيت كسر العمود الفقري',
    'تثبيت كسر الساق',
    'جراحة اليد',
    'تغيير مفصل الركبة',
    'تثبيت كسر عظمة العضد',
    'منظار ركبة',
    'تثبيت كسر الحوض',
    'جراحة القدم والكاحل',
];

const patientNames = [
    'أحمد محمود', 'فاطمة علي', 'محمد سعيد', 'سارة أحمد', 'خالد عبدالله',
    'نور الدين', 'ليلى حسن', 'عمر فاروق', 'مريم يوسف', 'طارق رشيد',
    'هدى إبراهيم', 'ياسر محمد', 'رنا خالد', 'كريم عادل', 'دينا سمير',
];

const doctorIds = ['d1', 'd2', 'd3', 'd4', 'd5'];
const doctorNames: Record<string, string> = {
    d1: 'د. أحمد الشافعي',
    d2: 'د. محمد عبدالرحمن',
    d3: 'د. سارة أحمد',
    d4: 'د. خالد محمود',
    d5: 'د. فاطمة علي',
};

export const seedDatabase = async () => {
    try {
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
            console.warn('⚠️ Supabase is not configured. Please set up your .env file with valid credentials.');
            console.log('💡 The application is currently using mock data.');
            return false;
        }

        console.log('🌱 Starting database seeding...');

        // 1. Seed Inventory with Wathqq products
        console.log('📦 Seeding inventory items...');
        const inventoryPayload = wathqqProducts.map((item) => ({
            name: item.name,
            sku: item.sku,
            category: item.category,
            material: item.material || null,
            diameter: item.diameter || null,
            length: item.length || null,
            quantity: Math.floor(Math.random() * 50) + 10, // Random stock 10-60
            min_stock: Math.floor(Math.random() * 15) + 5, // Random min stock 5-20
            base_price: item.basePrice,
            selling_price: item.sellingPrice,
            last_movement_date: subDays(new Date(), Math.floor(Math.random() * 180)).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'system',
        }));

        const { error: invError } = await supabase.from('inventory').upsert(inventoryPayload, {
            onConflict: 'sku',
            ignoreDuplicates: false
        });

        if (invError) {
            console.error('❌ Error seeding inventory:', invError);
        } else {
            console.log(`✅ Seeded ${inventoryPayload.length} inventory items`);
        }

        // 2. Generate and Seed Surgeries
        console.log('🏥 Seeding surgery records...');
        const surgeries = [];

        for (let i = 0; i < 25; i++) {
            const doctorId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
            const type = surgeryTypes[Math.floor(Math.random() * surgeryTypes.length)];
            const patientName = patientNames[Math.floor(Math.random() * patientNames.length)];
            const date = subDays(new Date(), Math.floor(Math.random() * 365));

            // Select 1-4 random items for the surgery
            const numItems = Math.floor(Math.random() * 3) + 1;
            let totalBase = 0;
            let totalSelling = 0;

            for (let j = 0; j < numItems; j++) {
                const item = wathqqProducts[Math.floor(Math.random() * wathqqProducts.length)];
                const qty = Math.floor(Math.random() * 4) + 1;
                totalBase += item.basePrice * qty;
                totalSelling += item.sellingPrice * qty;
            }

            const profit = totalSelling - totalBase;

            surgeries.push({
                doctor_id: doctorId,
                doctor_name: doctorNames[doctorId],
                patient_name: patientName,
                date: date.toISOString(),
                type: type,
                total_base_value: totalBase,
                total_selling_value: totalSelling,
                profit: profit,
                notes: `عملية ${type} - تمت بنجاح`,
                created_by: 'system',
                created_at: new Date().toISOString(),
            });
        }

        const { error: surgError } = await supabase.from('surgeries').insert(surgeries);

        if (surgError) {
            console.error('❌ Error seeding surgeries:', surgError);
            // Try camelCase fallback
            console.log('🔄 Retrying with camelCase...');
            const surgeriesCamel = surgeries.map(s => ({
                doctorId: s.doctor_id,
                doctorName: s.doctor_name,
                patientName: s.patient_name,
                date: s.date,
                type: s.type,
                totalBaseValue: s.total_base_value,
                totalSellingValue: s.total_selling_value,
                profit: s.profit,
                notes: s.notes,
                createdBy: s.created_by,
                createdAt: s.created_at,
            }));
            const { error: retryError } = await supabase.from('surgeries').insert(surgeriesCamel);
            if (retryError) {
                console.error('❌ Retry failed:', retryError);
                return false;
            }
        }

        console.log(`✅ Seeded ${surgeries.length} surgery records`);
        console.log('🎉 Database seeding completed successfully!');
        return true;

    } catch (error) {
        console.error('💥 Seed function failed:', error);
        return false;
    }
};
