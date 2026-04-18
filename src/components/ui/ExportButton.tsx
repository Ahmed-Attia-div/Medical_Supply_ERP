import { FileSpreadsheet, Download } from 'lucide-react';

interface ExportButtonProps {
    onClick: () => void;
    disabled?: boolean;
    isExporting?: boolean;
}

export function ExportButton({ onClick, disabled = false, isExporting = false }: ExportButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || isExporting}
            className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-200 shadow-sm
        ${disabled || isExporting
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-md active:scale-95'
                }
      `}
        >
            {isExporting ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ التصدير...</span>
                </>
            ) : (
                <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير إلى Excel</span>
                    <Download className="w-3 h-3" />
                </>
            )}
        </button>
    );
}
