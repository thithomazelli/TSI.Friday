import {
  Address,
  AddressService,
  BusinessPartner,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { AddressComponent } from './address.component';

describe('AddressComponent', () => {
  let addressChanged$: Subject<void>;
  let addressServiceMock: {
    addressChanged$: Subject<void>;
    getAllByBusinessPartnerId: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): AddressComponent {
    addressChanged$ = new Subject();
    addressServiceMock = {
      addressChanged$,
      getAllByBusinessPartnerId: vi.fn(),
      delete: vi.fn(),
      refresh: vi.fn(),
      update: vi.fn(),
    };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new AddressComponent(
      addressServiceMock as unknown as AddressService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('rebuilds the column definitions when the language changes', () => {
    const component = createComponent();
    const before = component.columnDefs;

    language$.next('en');

    expect(component.columnDefs).not.toBe(before);
  });

  describe('ngOnInit / addressChanged$', () => {
    it('reloads the addresses whenever addressChanged$ emits', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1' } as BusinessPartner;
      addressServiceMock.getAllByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1' }] }),
      );
      component.ngOnInit();

      addressChanged$.next();

      expect(addressServiceMock.getAllByBusinessPartnerId).toHaveBeenCalledWith('bp1');
      expect(component.rowData).toEqual([{ id: 'a1' }]);
    });

    it('stops reloading after ngOnDestroy', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1' } as BusinessPartner;
      component.ngOnInit();
      component.ngOnDestroy();

      addressChanged$.next();

      expect(addressServiceMock.getAllByBusinessPartnerId).not.toHaveBeenCalled();
    });
  });

  describe('deleteAddress', () => {
    it('refuses to delete the default address', () => {
      const component = createComponent();

      component.deleteAddress({ id: 'a1', isDefault: true } as Address);

      expect(addressServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'ADDRESS.CANNOT_DELETE_DEFAULT',
        'warning',
      );
    });

    it('removes a non-default address from the grid on success', () => {
      const component = createComponent();
      component.rowData = [{ id: 'a1' } as Address, { id: 'a2' } as Address];
      addressServiceMock.delete.mockReturnValue(of({ message: 'OK' }));

      component.deleteAddress({ id: 'a1', isDefault: false } as Address);

      expect(component.rowData).toEqual([{ id: 'a2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
    });
  });

  describe('refreshAddresses', () => {
    it('reloads the row data and notifies on success', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1' } as BusinessPartner;
      addressServiceMock.refresh.mockReturnValue(of({ data: [{ id: 'a1' }] }));

      component.refreshAddresses();

      expect(component.rowData).toEqual([{ id: 'a1' }]);
      expect(component.loading).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'ADDRESS.ADDRESSES_REFRESHED',
      );
    });

    it('stops loading and notifies an error on failure', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1' } as BusinessPartner;
      addressServiceMock.refresh.mockReturnValue(throwError(() => new Error('fail')));

      component.refreshAddresses();

      expect(component.loading).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'ADDRESS.ADDRESSES_REFRESH_ERROR',
      );
    });
  });

  describe('updateDefaultAddress', () => {
    it('marks the address as default, saves, and reloads', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1' } as BusinessPartner;
      const address = { id: 'a1', isDefault: false } as Address;
      addressServiceMock.update.mockReturnValue(of({ message: 'OK' }));
      addressServiceMock.getAllByBusinessPartnerId.mockReturnValue(of({ data: [] }));

      component.updateDefaultAddress(address);

      expect(address.isDefault).toBe(true);
      expect(addressServiceMock.update).toHaveBeenCalledWith(address);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
    });
  });

  describe('getAddresses (via ngOnInit trigger)', () => {
    it('clears the row data when there is no parent id yet', () => {
      const component = createComponent();
      component.parentData = null;
      component.ngOnInit();

      addressChanged$.next();

      expect(component.rowData).toEqual([]);
      expect(addressServiceMock.getAllByBusinessPartnerId).not.toHaveBeenCalled();
    });
  });

  describe('isDefault column cell renderer', () => {
    it('renders a checked, disabled checkbox for the default address', () => {
      const component = createComponent();
      const column = component.columnDefs.find((c) => c.field === 'isDefault')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: true });

      expect(html).toContain('checked');
      expect(html).toContain('disabled');
    });

    it('renders an unchecked, enabled checkbox otherwise', () => {
      const component = createComponent();
      const column = component.columnDefs.find((c) => c.field === 'isDefault')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: false });

      expect(html).not.toContain('checked');
      expect(html).not.toContain('disabled');
    });
  });
});
