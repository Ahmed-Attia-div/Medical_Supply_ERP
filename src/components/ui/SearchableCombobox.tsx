import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SearchableComboboxOption {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  options: SearchableComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  className?: string;
  dir?: 'ltr' | 'rtl';
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'اختر أو ابحث...',
  allowCustom = false,
  customPlaceholder = 'أدخل قيمة مخصصة...',
  className,
  dir = 'rtl',
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const displayLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : value;
  }, [value, options]);

  const isCustomValue = value && !options.some((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-10 px-3',
            className,
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0 opacity-50">
            {value && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="hover:bg-muted rounded-full p-0.5 cursor-pointer hover:text-destructive transition-colors mr-1"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4" />
          </div>
        </Button>
      </PopoverTrigger>
      {/* Popover content renders in a portal, solving clipping issues */}
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <Command filter={(val, search) => {
          if (val.includes(search)) return 1;
          return 0;
        }}>
          {/** 
             * Note: In cmdk/shadcn Command, filtering is usually automatic based on 'value' prop 
             * of CommandItem. However, here we might have complex labels. 
             * We'll rely on cmdk's default filtering but ensure we pass searchable text.
             */}
          <CommandInput
            placeholder={allowCustom && inputVal ? customPlaceholder : 'ابحث...'}
            value={inputVal}
            onValueChange={setInputVal}
            className="text-right"
          />
          <CommandList className='max-h-[300px]'>
            <CommandEmpty className="py-2 px-4 text-sm text-center text-muted-foreground">
              {allowCustom && inputVal ? (
                <button
                  className="w-full text-right text-primary hover:underline"
                  onClick={() => {
                    onChange(inputVal);
                    setOpen(false);
                    setInputVal('');
                  }}
                >
                  إضافة "{inputVal}"
                </button>
              ) : (
                'لا توجد نتائج'
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // Search by label not value ID
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setInputVal('');
                  }}
                  className="flex justify-between items-center cursor-pointer aria-selected:bg-accent"
                >
                  <span>{option.label}</span>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
