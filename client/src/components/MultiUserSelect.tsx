import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface UserOption {
  id: number;
  name: string;
  role?: string;
}

interface MultiUserSelectProps {
  users: UserOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  label?: string;
}

export function MultiUserSelect({ users, selectedIds, onChange, placeholder = "เลือกผู้รับผิดชอบ...", label }: MultiUserSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleUser = (userId: number) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const removeUser = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== userId));
  };

  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));

  const roleLabel = (role?: string) => {
    if (role === "superadmin") return "Super Admin";
    if (role === "admin") return "Admin";
    return "Sales";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-auto min-h-9 text-sm py-1.5"
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedUsers.length > 0 ? (
              selectedUsers.map((u) => (
                <Badge key={u.id} variant="secondary" className="text-xs font-normal gap-1 pr-1">
                  {u.name}
                  <button
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    onClick={(e) => removeUser(u.id, e)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาชื่อ..." />
          <CommandList>
            <CommandEmpty>ไม่พบผู้ใช้</CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => toggleUser(u.id)}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(u.id) ? "opacity-100" : "opacity-0")} />
                  <span>{u.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{roleLabel(u.role)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
