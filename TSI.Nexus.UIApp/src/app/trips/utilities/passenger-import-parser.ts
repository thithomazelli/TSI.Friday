import { Passenger } from '@nexus/core';

/**
 * Parses passenger list rows (comma or tab separated: Nome, Documento, Assento, Telefone) coming
 * from an uploaded CSV/TXT file, the same convention already used by the paste-based import.
 */
export function parsePassengerRows(text: string, tripId: string): Passenger[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const columns = line.includes('\t') ? line.split('\t') : line.split(',');
      return {
        name: columns[0].trim(),
        documentNumber: (columns[1] ?? '').trim(),
        seat: (columns[2] ?? '').trim(),
        phone: (columns[3] ?? '').trim(),
        tripId,
      } as Passenger;
    })
    .filter((passenger) => passenger.name.length > 0);
}
