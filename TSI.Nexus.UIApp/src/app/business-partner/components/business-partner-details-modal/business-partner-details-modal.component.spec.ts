import { MatDialogRef } from '@angular/material/dialog';
import { BusinessPartner, BusinessPartnerType, TranslationService } from '@nexus/core';
import { BusinessPartnerDetailsModalComponent } from './business-partner-details-modal.component';

describe('BusinessPartnerDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): BusinessPartnerDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    return new BusinessPartnerDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<BusinessPartnerDetailsModalComponent>,
      dialogData,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults to add mode with no data when there is no dialog data', () => {
    const component = createComponent();

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({});
    expect(component.id).toBeNull();
  });

  it('initializes from dialog data in edit mode', () => {
    const businessPartner = {
      id: 'bp1',
      type: BusinessPartnerType.Client,
    } as BusinessPartner;
    const component = createComponent({ isEdit: true, data: businessPartner, id: 'bp1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(businessPartner);
    expect(component.id).toBe('bp1');
  });

  it('falls back to defaults when dialog data omits data/id', () => {
    const component = createComponent({ isEdit: true });

    expect(component.data).toEqual({});
    expect(component.id).toBeNull();
  });

  describe('ngOnInit / initializeTitle', () => {
    it('builds an "add client" title when adding a client', () => {
      const component = createComponent({
        isEdit: false,
        data: { type: BusinessPartnerType.Client },
      });

      component.ngOnInit();

      expect(translationServiceMock.instant).toHaveBeenCalledWith('SIDEBAR.CLIENTS');
      expect(translationServiceMock.instant).toHaveBeenCalledWith('COMMON.ADD_ENTITY', {
        entity: 'SIDEBAR.CLIENTS',
      });
      expect(component.title).toBe('COMMON.ADD_ENTITY');
    });

    it('builds an "edit supplier" title when editing a supplier', () => {
      const component = createComponent({
        isEdit: true,
        data: { type: BusinessPartnerType.Supplier },
      });

      component.ngOnInit();

      expect(translationServiceMock.instant).toHaveBeenCalledWith('SIDEBAR.SUPPLIERS');
      expect(translationServiceMock.instant).toHaveBeenCalledWith('COMMON.EDIT_ENTITY', {
        entity: 'SIDEBAR.SUPPLIERS',
      });
    });
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
