import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SourceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SourceCombobox({ value, onChange, placeholder = "เลือกหรือพิมพ์แหล่งที่มา..." }: SourceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { data: sources, refetch } = trpc.source.list.useQuery();
  const createMutation = trpc.source.create.useMutation();
  const deleteMutation = trpc.source.delete.useMutation({
    onSuccess: () => { toast.success("ลบแหล่งที่มาสำเร็จ"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const sourceList = sources || [];
  const filtered = inputValue
    ? sourceList.filter((s: any) => s.name.toLowerCase().includes(inputValue.toLowerCase()))
    : sourceList;

  const showAddNew = inputValue.trim() && !sourceList.some((s: any) => s.name.toLowerCase() === inputValue.toLowerCase());

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setInputValue("");
  };

  const handleAddNew = async () => {
    const name = inputValue.trim();
    if (!name) return;
    await createMutation.mutateAsync({ name });
    onChange(name);
    setOpen(false);
    setInputValue("");
    refetch();
  };

  const handleDelete = (e: React.MouseEvent, sourceId: number, sourceName: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (value === sourceName) {
      onChange("");
    }
    deleteMutation.mutate({ id: sourceId });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 text-sm"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="พิมพ์ชื่อแหล่งที่มา..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm cursor-pointer"
                  onClick={handleAddNew}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span>เพิ่ม "{inputValue.trim()}"</span>
                </button>
              ) : (
                "ไม่พบแหล่งที่มา"
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((s: any) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => handleSelect(s.name)}
                  className="group"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === s.name ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.usageCount > 0 && (
                    <span className="text-xs text-muted-foreground mr-1">{s.usageCount}</span>
                  )}
                  <button
                    className="ml-1 p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => handleDelete(e, s.id, s.name)}
                    title="ลบแหล่งที่มา"
                    type="button"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </CommandItem>
              ))}
              {showAddNew && filtered.length > 0 && (
                <CommandItem onSelect={handleAddNew} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  <span>เพิ่ม "{inputValue.trim()}"</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
