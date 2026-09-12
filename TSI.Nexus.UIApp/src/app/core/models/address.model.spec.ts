import { Address } from './address.model';

describe('Address', () => {
  it('copies every field from the initializer', () => {
    const address = new Address({
      id: '1',
      name: 'Matriz',
      street: 'Rua A',
      number: 100,
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      country: 'Brasil',
      comments: 'Fundos',
      type: 'Comercial',
      businessPartnerId: 'bp1',
      isDefault: true,
    });

    expect(address).toMatchObject({
      id: '1',
      name: 'Matriz',
      street: 'Rua A',
      number: 100,
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      country: 'Brasil',
      comments: 'Fundos',
      type: 'Comercial',
      businessPartnerId: 'bp1',
      isDefault: true,
    });
  });

  it('leaves every field undefined when constructed with no initializer', () => {
    const address = new Address();

    expect(address.street).toBeUndefined();
    expect(address.number).toBeUndefined();
    expect(address.city).toBeUndefined();
  });

  describe('address getter', () => {
    it('joins every field when all are present', () => {
      const address = new Address({
        street: 'Rua A',
        number: 100,
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01000-000',
        country: 'Brasil',
      });

      expect(address.address).toBe('Rua A, 100 - São Paulo, SP, 01000-000, Brasil');
    });

    it('falls back to an empty string for each missing field', () => {
      const address = new Address();

      expect(address.address).toBe(',  - , , , ');
    });
  });
});
