'use client';

import { useEffect, useRef, useState } from 'react';
import { searchPatientsForSelect } from '@/actions/patients';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { SPECIES_EMOJI, type PatientSpecies } from '@sincvete/shared';

interface PatientPickerProps {
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  error?: string;
}

export function PatientPicker({
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  error,
}: PatientPickerProps) {
  const [query, setQuery] = useState(defaultPatientName ?? '');
  const [patientId, setPatientId] = useState(defaultPatientId ?? '');
  const [ownerId, setOwnerId] = useState(defaultOwnerId ?? '');
  const [ownerName, setOwnerName] = useState(defaultOwnerName ?? '');
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string;
      species: string;
      owner_id: string;
      owner_full_name: string;
    }>
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchPatientsForSelect(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPatient = (patient: (typeof results)[number]) => {
    setPatientId(patient.id);
    setOwnerId(patient.owner_id);
    setOwnerName(patient.owner_full_name);
    setQuery(patient.name);
    setOpen(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="patientSearch">Paciente *</Label>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <div className="relative">
        <Input
          id="patientSearch"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPatientId('');
            setOwnerId('');
            setOwnerName('');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar paciente por nombre o microchip..."
          autoComplete="off"
        />
        {open && (results.length > 0 || loading) && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
            {loading && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Buscando...</li>
            )}
            {results.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-accent',
                    patientId === patient.id && 'bg-accent'
                  )}
                  onClick={() => selectPatient(patient)}
                >
                  {SPECIES_EMOJI[patient.species as PatientSpecies]} {patient.name}
                  <span className="block text-xs text-muted-foreground">
                    {patient.owner_full_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {ownerName && (
        <p className="text-xs text-muted-foreground">Propietario: {ownerName}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!patientId && query && !loading && (
        <p className="text-xs text-muted-foreground">Seleccioná un paciente de la lista</p>
      )}
    </div>
  );
}
