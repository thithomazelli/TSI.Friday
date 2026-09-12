import { of, throwError } from 'rxjs';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TranslationService,
} from '@nexus/core';
import { SelectableOptionsComponent } from './selectable-options.component';

describe('SelectableOptionsComponent', () => {
  let selectableOptionServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getByGroup: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: { showSweetConfirmation: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent() {
    selectableOptionServiceMock = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getByGroup: vi.fn().mockReturnValue(of({ data: [] })),
    };
    modalServiceMock = { showSweetConfirmation: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new SelectableOptionsComponent(
      selectableOptionServiceMock as unknown as SelectableOptionService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads options for the active group on init', () => {
    const options = [{ id: 'o1' }] as SelectableOption[];
    const component = createComponent();
    selectableOptionServiceMock.getByGroup.mockReturnValue(of({ data: options }));

    component.ngOnInit();

    expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalledWith(SelectableOptionGroup.AddressType);
    expect(component.options).toBe(options);
    expect(component.loading).toBe(false);
  });

  it('stops loading and keeps options empty when the load request errors out', () => {
    const component = createComponent();
    selectableOptionServiceMock.getByGroup.mockReturnValue(throwError(() => new Error('boom')));

    component.ngOnInit();

    expect(component.loading).toBe(false);
  });

  it('isEventTypeGroup reflects whether the active group is EventType', () => {
    const component = createComponent();
    expect(component.isEventTypeGroup).toBe(false);

    component.activeGroup = SelectableOptionGroup.EventType;
    expect(component.isEventTypeGroup).toBe(true);
  });

  describe('selectGroup', () => {
    it('switches the active group, clears newValue, and reloads', () => {
      const component = createComponent();
      component.newValue = 'draft';

      component.selectGroup(SelectableOptionGroup.EventType);

      expect(component.activeGroup).toBe(SelectableOptionGroup.EventType);
      expect(component.newValue).toBe('');
      expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalledWith(SelectableOptionGroup.EventType);
    });

    it('does nothing when selecting the group that is already active', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockClear();

      component.selectGroup(SelectableOptionGroup.AddressType);

      expect(selectableOptionServiceMock.getByGroup).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('does nothing for a blank value', () => {
      const component = createComponent();
      component.newValue = '   ';

      component.add();

      expect(selectableOptionServiceMock.add).not.toHaveBeenCalled();
    });

    it('does nothing while a save is already in flight', () => {
      const component = createComponent();
      component.newValue = 'Novo';
      component.saving = true;

      component.add();

      expect(selectableOptionServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds the trimmed value without a color for a non-event-type group', () => {
      const response = { status: ResponseStatus.Success, message: 'ok' };
      const component = createComponent();
      selectableOptionServiceMock.add.mockReturnValue(of(response));
      component.newValue = '  Novo  ';

      component.add();

      expect(selectableOptionServiceMock.add).toHaveBeenCalledWith({
        group: SelectableOptionGroup.AddressType,
        value: 'Novo',
        color: null,
      });
      expect(component.newValue).toBe('');
      expect(component.saving).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });

    it('includes the color for the EventType group', () => {
      const response = { status: ResponseStatus.Success, message: 'ok' };
      const component = createComponent();
      selectableOptionServiceMock.add.mockReturnValue(of(response));
      component.activeGroup = SelectableOptionGroup.EventType;
      component.newValue = 'Reunião';
      component.newColor = '#ff0000';

      component.add();

      expect(selectableOptionServiceMock.add).toHaveBeenCalledWith({
        group: SelectableOptionGroup.EventType,
        value: 'Reunião',
        color: '#ff0000',
      });
    });

    it('keeps newValue unchanged when the backend reports a non-success status', () => {
      const response = { status: ResponseStatus.Error, message: 'falhou' };
      const component = createComponent();
      selectableOptionServiceMock.add.mockReturnValue(of(response));
      component.newValue = 'Novo';

      component.add();

      expect(component.newValue).toBe('Novo');
    });

    it('shows a translated error notification and stops saving when the request errors out', () => {
      const component = createComponent();
      selectableOptionServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));
      component.newValue = 'Novo';

      component.add();

      expect(component.saving).toBe(false);
      expect(translationServiceMock.instant).toHaveBeenCalledWith('COMMON.SAVE_ERROR');
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
    });
  });

  describe('updateColor', () => {
    it('updates the option color locally on success', () => {
      const option = { id: 'o1', color: '#000000' } as SelectableOption;
      const response = { status: ResponseStatus.Success, message: 'ok' };
      const component = createComponent();
      selectableOptionServiceMock.update.mockReturnValue(of(response));

      component.updateColor(option, '#ffffff');

      expect(selectableOptionServiceMock.update).toHaveBeenCalledWith({ ...option, color: '#ffffff' });
      expect(option.color).toBe('#ffffff');
    });

    it('does not update the local color when the backend reports a non-success status', () => {
      const option = { id: 'o1', color: '#000000' } as SelectableOption;
      const response = { status: ResponseStatus.Error, message: 'falhou' };
      const component = createComponent();
      selectableOptionServiceMock.update.mockReturnValue(of(response));

      component.updateColor(option, '#ffffff');

      expect(option.color).toBe('#000000');
    });

    it('shows a translated error notification when the request errors out', () => {
      const option = { id: 'o1' } as SelectableOption;
      const component = createComponent();
      selectableOptionServiceMock.update.mockReturnValue(throwError(() => new Error('boom')));

      component.updateColor(option, '#ffffff');

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
    });
  });

  describe('remove', () => {
    it('removes the option and reloads when the user confirms', async () => {
      const option = { id: 'o1' } as SelectableOption;
      const response = { status: ResponseStatus.Success, message: 'removido' };
      const component = createComponent();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      selectableOptionServiceMock.remove.mockReturnValue(of(response));

      component.remove(option);
      await Promise.resolve();
      await Promise.resolve();

      expect(selectableOptionServiceMock.remove).toHaveBeenCalledWith(option);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });

    it('does nothing when the user cancels the confirmation', async () => {
      const option = { id: 'o1' } as SelectableOption;
      const component = createComponent();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove(option);
      await Promise.resolve();

      expect(selectableOptionServiceMock.remove).not.toHaveBeenCalled();
    });

    it('shows a translated error notification when the remove request errors out', async () => {
      const option = { id: 'o1' } as SelectableOption;
      const component = createComponent();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      selectableOptionServiceMock.remove.mockReturnValue(throwError(() => new Error('boom')));

      component.remove(option);
      await Promise.resolve();
      await Promise.resolve();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
    });
  });
});
