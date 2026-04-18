/**
 * MobileActionSheet.tsx
 *
 * A mobile-first bottom sheet powered by Vaul.
 * On mobile (< 768px)  → slides up from bottom as a native-feeling drawer
 * On desktop           → renders as a regular shadcn Dialog
 *
 * Usage:
 *   <MobileActionSheet trigger={<Button>Add Item</Button>} title="إضافة صنف">
 *     <YourFormComponent />
 *   </MobileActionSheet>
 */

import { Drawer } from 'vaul';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileActionSheetProps {
    trigger: React.ReactNode;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Snap points in vh — default is [0.5, 0.9] */
    snapPoints?: number[];
    /** Max height override for desktop dialog */
    dialogMaxH?: string;
}

export function MobileActionSheet({
    trigger,
    title,
    subtitle,
    children,
    open,
    onOpenChange,
    snapPoints = [0.5, 0.9],
    dialogMaxH = '90vh',
}: MobileActionSheetProps) {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Drawer.Root
                snapPoints={snapPoints}
                open={open}
                onOpenChange={onOpenChange}
                direction="bottom"
            >
                <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>

                <Drawer.Portal>
                    {/* Scrim */}
                    <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

                    <Drawer.Content
                        dir="rtl"
                        className={cn(
                            'fixed inset-x-0 bottom-0 z-50 flex flex-col',
                            'rounded-t-2xl bg-background shadow-2xl',
                            'border-t border-border',
                            'focus:outline-none',
                        )}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                        </div>

                        {/* Header */}
                        <div className="border-b border-border px-5 py-3">
                            <Drawer.Title className="text-base font-bold text-foreground">
                                {title}
                            </Drawer.Title>
                            {subtitle && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
                            )}
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {children}
                        </div>

                        {/* Safe area for home indicator */}
                        <div className="h-safe-area-inset-bottom" />
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    // Desktop: standard dialog
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <div onClick={() => onOpenChange?.(true)}>{trigger}</div>
            <DialogContent
                dir="rtl"
                className="max-w-2xl"
                style={{ maxHeight: dialogMaxH, overflowY: 'auto' }}
            >
                <DialogHeader>
                    <DialogTitle className="text-right text-lg font-bold">{title}</DialogTitle>
                    {subtitle && (
                        <p className="text-right text-sm text-muted-foreground">{subtitle}</p>
                    )}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

// ─── Simple mobile-aware card for product rows ────────────────────────────────

interface ProductCardMobileProps {
    name: string;
    sku: string;
    category: string;
    quantity: number;
    minStock: number;
    sellingPrice: number;
    onPress?: () => void;
    actions?: React.ReactNode;
}

export function ProductCardMobile({
    name, sku, category, quantity, minStock,
    sellingPrice, onPress, actions,
}: ProductCardMobileProps) {
    const isLow = quantity <= minStock;
    const isDead = quantity === 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onPress}
            onKeyDown={e => e.key === 'Enter' && onPress?.()}
            className={cn(
                'flex items-center gap-3 rounded-xl border bg-card p-4',
                'cursor-pointer transition-colors duration-150',
                'active:scale-[0.98] hover:bg-accent/50',
                isLow && !isDead && 'border-amber-400/50 bg-amber-50/10',
                isDead && 'border-red-400/50 bg-red-50/10',
            )}
        >
            {/* Stock indicator dot */}
            <div className={cn(
                'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                isDead ? 'bg-red-500' :
                    isLow ? 'bg-amber-400' :
                        'bg-emerald-500',
            )} />

            {/* Main info */}
            <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <div className="mt-0.5 flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground">{category}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">{sku}</span>
                </div>
            </div>

            {/* Qty + Price */}
            <div className="flex-shrink-0 text-right">
                <p className={cn(
                    'text-sm font-bold',
                    isDead ? 'text-red-500' :
                        isLow ? 'text-amber-500' :
                            'text-foreground',
                )}>
                    {quantity}
                </p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                    {sellingPrice.toLocaleString('ar-EG')} ج
                </p>
            </div>

            {/* Actions slot */}
            {actions && (
                <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {actions}
                </div>
            )}
        </div>
    );
}
