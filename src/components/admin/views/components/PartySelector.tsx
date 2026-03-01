import { useMemo } from "react";
import type { Party } from "@/data/billing";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";

interface PartySelectorProps {
  parties: Party[];
  query: string;
  selectedPartyId: string;
  disabled?: boolean;
  onQueryChange: (value: string) => void;
  onPartyChange: (partyId: string) => void;
}

export default function PartySelector({
  parties,
  query,
  selectedPartyId,
  disabled,
  onQueryChange,
  onPartyChange,
}: PartySelectorProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(q) ||
        (party.gstin ?? "").toLowerCase().includes(q) ||
        party.phone.toLowerCase().includes(q),
    );
  }, [parties, query]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Search Party</p>
        <Input
          value={query}
          disabled={disabled}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, GSTIN, or phone"
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Select Party</p>
        <Select value={selectedPartyId} disabled={disabled} onChange={(event) => onPartyChange(event.target.value)}>
          <option value="">Select party</option>
          {filtered.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
          <option value="__new__">+ New Party</option>
        </Select>
      </div>
    </div>
  );
}
