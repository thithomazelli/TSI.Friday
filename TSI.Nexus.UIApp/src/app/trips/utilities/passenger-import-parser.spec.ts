import { parsePassengerRows } from './passenger-import-parser';

describe('parsePassengerRows', () => {
  const tripId = 'trip-1';

  it('parses comma-separated rows into Passenger objects', () => {
    const result = parsePassengerRows('Ana Silva,123.456.789-00,12,11999999999', tripId);

    expect(result).toEqual([
      {
        name: 'Ana Silva',
        documentNumber: '123.456.789-00',
        seat: '12',
        phone: '11999999999',
        tripId,
      },
    ]);
  });

  it('parses tab-separated rows into Passenger objects', () => {
    const result = parsePassengerRows('Ana Silva\t123.456.789-00\t12\t11999999999', tripId);

    expect(result).toEqual([
      {
        name: 'Ana Silva',
        documentNumber: '123.456.789-00',
        seat: '12',
        phone: '11999999999',
        tripId,
      },
    ]);
  });

  it('trims whitespace from every column', () => {
    const result = parsePassengerRows('  Ana Silva ,  123 , 12 , 999 ', tripId);

    expect(result[0]).toEqual({
      name: 'Ana Silva',
      documentNumber: '123',
      seat: '12',
      phone: '999',
      tripId,
    });
  });

  it('parses multiple lines, skipping blank lines', () => {
    const result = parsePassengerRows(
      'Ana Silva,123,12,999\n\nJoao Souza,456,13,888\n',
      tripId,
    );

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Ana Silva');
    expect(result[1].name).toBe('Joao Souza');
  });

  it('defaults missing trailing columns to empty strings', () => {
    const result = parsePassengerRows('Ana Silva', tripId);

    expect(result[0]).toEqual({
      name: 'Ana Silva',
      documentNumber: '',
      seat: '',
      phone: '',
      tripId,
    });
  });

  it('filters out rows with no name', () => {
    const result = parsePassengerRows(',123,12,999\nAna Silva,456,13,888', tripId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ana Silva');
  });

  it('returns an empty array for empty input', () => {
    expect(parsePassengerRows('', tripId)).toEqual([]);
  });
});
