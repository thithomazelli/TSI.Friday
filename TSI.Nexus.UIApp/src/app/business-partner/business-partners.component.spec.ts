import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import {
  BusinessPartner,
  BusinessPartnerService,
  BusinessPartnerType,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of, throwError } from 'rxjs';
import { BusinessPartnersComponent } from './business-partners.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('BusinessPartnersComponent', () => {
  let businessPartnerChanged$: Subject<void>;
  let businessPartnerServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    businessPartnerChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let routerMock: { url: string };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(url: string): BusinessPartnersComponent {
    businessPartnerChanged$ = new Subject();
    businessPartnerServiceMock = {
      getAllPaged: vi.fn(),
      businessPartnerChanged$,
      delete: vi.fn(),
      refresh: vi.fn(),
    };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    routerMock = { url };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    cdrMock = { markForCheck: vi.fn() };

    return new BusinessPartnersComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockGridRef(): GridComponent<BusinessPartner> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<BusinessPartner>;
  }

  it('should create', () => {
    expect(createComponent('/clients')).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('detects the clients route', () => {
      const component = createComponent('/clients');
      component.ngOnInit();

      expect(component.baseEndPoint).toBe('clients');
      expect(component.businessPartnerType).toBe(BusinessPartnerType.Client);
      expect(component.columnDefs.length).toBeGreaterThan(0);
    });

    it('detects the suppliers route', () => {
      const component = createComponent('/suppliers');
      component.ngOnInit();

      expect(component.baseEndPoint).toBe('suppliers');
      expect(component.businessPartnerType).toBe(BusinessPartnerType.Supplier);
    });

    it('re-initializes on language change', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('ignores the first (replay) emission but purges the cache on later changes', () => {
      const component = createComponent('/clients');
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      businessPartnerChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      businessPartnerChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent('/clients');
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      component.ngOnDestroy();

      businessPartnerChanged$.next();
      businessPartnerChanged$.next();

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });

    it('does not throw when destroyed before ngOnInit ever subscribed', () => {
      const component = createComponent('/clients');

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('falls back to an empty title/baseEndPoint when the url matches neither route', () => {
      const component = createComponent('/other');
      component.ngOnInit();

      expect(component.baseEndPoint).toBe('');
      expect(component.title).toBe('');
    });
  });

  describe('pagedDataSource', () => {
    it('requests the correct partner type', () => {
      const component = createComponent('/suppliers');
      component.ngOnInit();

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(businessPartnerServiceMock.getAllPaged).toHaveBeenCalledWith(
        BusinessPartnerType.Supplier,
        { page: 1, pageSize: 10 },
      );
    });
  });

  describe('openModal', () => {
    it('tags the initial state with the client type', () => {
      const component = createComponent('/clients');
      component.ngOnInit();

      component.openModal({ isEdit: false, data: {} });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: { type: BusinessPartnerType.Client } }),
      );
    });

    it('tags the initial state with the supplier type', () => {
      const component = createComponent('/suppliers');
      component.ngOnInit();

      component.openModal({ isEdit: false, data: {} });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: { type: BusinessPartnerType.Supplier } }),
      );
    });
  });

  describe('deleteBusinessPartner', () => {
    it('purges the grid cache and notifies on success', () => {
      const component = createComponent('/clients');
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      businessPartnerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteBusinessPartner({ id: 'bp1' } as BusinessPartner);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not purge the grid cache when the deletion fails', () => {
      const component = createComponent('/clients');
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      businessPartnerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteBusinessPartner({ id: 'bp1' } as BusinessPartner);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
    });
  });

  describe('refreshBusinessPartners', () => {
    it('shows a clients-specific success message', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      businessPartnerServiceMock.refresh.mockReturnValue(of(undefined));

      component.refreshBusinessPartners();

      expect(businessPartnerServiceMock.refresh).toHaveBeenCalledWith(
        BusinessPartnerType.Client,
      );
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'BUSINESS_PARTNER.CLIENTS_REFRESHED',
      );
    });

    it('shows a suppliers-specific success message', () => {
      const component = createComponent('/suppliers');
      component.ngOnInit();
      businessPartnerServiceMock.refresh.mockReturnValue(of(undefined));

      component.refreshBusinessPartners();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'BUSINESS_PARTNER.SUPPLIERS_REFRESHED',
      );
    });

    it('shows a suppliers-specific error message on failure', () => {
      const component = createComponent('/suppliers');
      component.ngOnInit();
      businessPartnerServiceMock.refresh.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.refreshBusinessPartners();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'BUSINESS_PARTNER.SUPPLIERS_REFRESH_ERROR',
      );
    });

    it('shows a clients-specific error message on failure', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      businessPartnerServiceMock.refresh.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.refreshBusinessPartners();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'BUSINESS_PARTNER.CLIENTS_REFRESH_ERROR',
      );
    });
  });

  describe('CPF/CNPJ column cell renderer', () => {
    it('formats an 11-digit CPF for an individual', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.headerName === 'BUSINESS_PARTNER.CPF_CNPJ',
      )!;

      const result = (column.cellRenderer as (params: any) => string)({
        data: { documentType: 'Física', socialSecurityCard: '52998224725' },
      });

      expect(result).toBe('529.982.247-25');
    });

    it('formats a 14-digit CNPJ for a company', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.headerName === 'BUSINESS_PARTNER.CPF_CNPJ',
      )!;

      const result = (column.cellRenderer as (params: any) => string)({
        data: { documentType: 'Jurídica', nationalRegistry: '11222333000181' },
      });

      expect(result).toBe('11.222.333/0001-81');
    });

    it('falls back to an empty string when the individual document is missing', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.headerName === 'BUSINESS_PARTNER.CPF_CNPJ',
      )!;

      const result = (column.cellRenderer as (params: any) => string)({
        data: { documentType: 'Física' },
      });

      expect(result).toBe('');
    });

    it('falls back to an empty string when the company document is missing', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.headerName === 'BUSINESS_PARTNER.CPF_CNPJ',
      )!;

      const result = (column.cellRenderer as (params: any) => string)({
        data: { documentType: 'Jurídica' },
      });

      expect(result).toBe('');
    });

    it('returns the raw value when the digit count matches neither CPF nor CNPJ', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.headerName === 'BUSINESS_PARTNER.CPF_CNPJ',
      )!;

      const result = (column.cellRenderer as (params: any) => string)({
        data: { documentType: 'Física', socialSecurityCard: '123' },
      });

      expect(result).toBe('123');
    });
  });

  describe('name column cell renderer', () => {
    it('renders the value as a link, falling back to an empty string when missing', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'name')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Cliente A' })).toContain(
        'Cliente A',
      );
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });
  });

  describe('email column cell renderer', () => {
    it('renders the value as a link, falling back to an empty string when missing', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'email')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'a@b.com' })).toContain(
        'a@b.com',
      );
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });
  });

  describe('phone column cell renderer', () => {
    it('formats a 10-digit phone number', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'phone')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '1122223333' })).toBe(
        '(11) 2222-3333',
      );
    });

    it('returns the raw value when it does not have 10 digits', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'phone')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '123' })).toBe('123');
    });

    it('treats a missing value as an empty string', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'phone')!;

      expect((column.cellRenderer as (p: any) => string)({ value: null })).toBe('');
    });
  });

  describe('mobile column cell renderer', () => {
    it('formats an 11-digit mobile number', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'mobile')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '11922223333' })).toBe(
        '(11) 9 2222-3333',
      );
    });

    it('returns the raw value when it does not have 11 digits', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'mobile')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '123' })).toBe('123');
    });

    it('treats a missing value as an empty string', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'mobile')!;

      expect((column.cellRenderer as (p: any) => string)({ value: null })).toBe('');
    });
  });

  describe('actions column cell renderer', () => {
    it('renders the view, edit and delete buttons', () => {
      const component = createComponent('/clients');
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as () => string)();

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
